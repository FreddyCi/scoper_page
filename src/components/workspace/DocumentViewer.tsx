import { useEffect, useMemo, useRef, useState } from 'react'

import { PdfPageCanvas } from '@/components/workspace/PdfPageCanvas'
import { PdfViewerToolbar } from '@/components/workspace/PdfViewerToolbar'
import { MarkdownDocumentViewer } from '@/components/workspace/MarkdownDocumentViewer'
import { OfficeDocumentPreview } from '@/components/workspace/OfficeDocumentPreview'
import { SpreadsheetDocumentPreview } from '@/components/workspace/SpreadsheetDocumentPreview'
import { isSpreadsheetDocument, isWordDocument } from '@/lib/document-preview'
import { useCommentedBlockIds } from '@/hooks/use-block-comments'
import { usePdfDocument } from '@/hooks/use-pdf-document'
import type { Bbox } from '@/lib/types'
import { blockToCitation } from '@/lib/types'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { redefineBlockRegion } from '@/services/block-adjust'
import { focusCitation } from '@/services/citation-bridge'
import { useSessionStore } from '@/store/session-store'
import type { DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'

type DocumentViewerProps = {
  document: DocumentMeta
  initialPage?: number
  onPageChange?: (page: number) => void
  theme?: 'light' | 'dark'
  className?: string
}

function ViewerState({
  title,
  message,
  className,
}: {
  title: string
  message: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-border bg-surface text-muted-foreground flex h-full min-h-[20rem] flex-col items-center justify-center gap-2 rounded-panel border px-6 text-center text-sm',
        className,
      )}
    >
      <p className="text-foreground font-medium">{title}</p>
      <p className="text-subtle-foreground max-w-sm text-xs">{message}</p>
    </div>
  )
}

function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1
  return Math.min(Math.max(page, 1), totalPages)
}

export function DocumentViewer({
  document,
  initialPage = 1,
  onPageChange,
  theme = 'light',
  className,
}: DocumentViewerProps) {
  const isDark = theme === 'dark'
  const selectedCitation = useSessionStore((state) => state.selectedCitation)
  const citationFocusSeq = useSessionStore((state) => state.citationFocusSeq)
  const canvasAnchorRef = useRef<HTMLDivElement>(null)
  const pdfBytes = useMemo(
    () => getDocumentBytes(document.doc_id),
    [document.doc_id],
  )
  const { pdf, loading, error } = usePdfDocument(pdfBytes)
  const [page, setPage] = useState(initialPage)
  const [scale, setScale] = useState(1.25)
  const [adjustingRegion, setAdjustingRegion] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const totalPages = pdf?.numPages ?? 0
  const activeCitation =
    selectedCitation?.doc_id === document.doc_id ? selectedCitation : null
  const currentPage = clampPage(page, totalPages)
  const { blockIds: commentedBlockIds } = useCommentedBlockIds(document.doc_id)
  const activeCitationHasComment = activeCitation
    ? commentedBlockIds.has(activeCitation.block_id)
    : false

  useEffect(() => {
    setPage(initialPage)
  }, [document.doc_id, initialPage])

  useEffect(() => {
    if (activeCitation?.page_num != null) {
      setPage(activeCitation.page_num)
    }
  }, [activeCitation?.page_num, activeCitation?.block_id, citationFocusSeq])

  useEffect(() => {
    if (!activeCitation || activeCitation.page_num !== currentPage) return
    canvasAnchorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeCitation, citationFocusSeq, currentPage])

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  function updatePage(nextPage: number) {
    const resolved = clampPage(nextPage, totalPages)
    setPage(resolved)
    setAdjustError(null)
    onPageChange?.(resolved)
  }

  async function handleRegionAdjust(bbox: Bbox) {
    if (!activeCitation?.block_id) return

    setAdjustError(null)
    setAdjustingRegion(true)
    try {
      const newBlock = await redefineBlockRegion({
        docId: document.doc_id,
        pageNum: currentPage,
        bbox,
        seedBlockId: activeCitation.block_id,
      })
      focusCitation(blockToCitation(newBlock))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to adjust block region'
      setAdjustError(message)
      console.error('[document-viewer] block region adjust failed', error)
    } finally {
      setAdjustingRegion(false)
    }
  }

  const canAdjustRegion = Boolean(
    activeCitation?.bbox &&
      activeCitation.page_num === currentPage &&
      !loading &&
      pdf,
  )

  if (document.mime === 'text/markdown') {
    return <MarkdownDocumentViewer document={document} className={className} />
  }

  if (isWordDocument(document)) {
    return <OfficeDocumentPreview document={document} className={className} />
  }

  if (isSpreadsheetDocument(document)) {
    return <SpreadsheetDocumentPreview document={document} className={className} />
  }

  if (document.mime !== 'application/pdf') {
    return (
      <ViewerState
        className={className}
        title="Preview unavailable"
        message={`${document.filename} is not supported for preview. Use PDF, Markdown, Word, or spreadsheet formats (.xlsx, .ods).`}
      />
    )
  }

  if (!pdfBytes) {
    return (
      <ViewerState
        className={className}
        title="PDF not in memory"
        message="Original file bytes are unavailable for this session. Re-upload the document to preview it."
      />
    )
  }

  if (error) {
    return (
      <ViewerState
        className={className}
        title="Failed to open PDF"
        message={error.message}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden',
        isDark
          ? 'border-zinc-700 bg-zinc-900'
          : 'border-border bg-surface rounded-panel border',
        className,
      )}
    >
      <PdfViewerToolbar
        filename={document.filename}
        page={currentPage}
        totalPages={totalPages}
        scale={scale}
        theme={theme}
        hint={
          adjustError ??
          (canAdjustRegion
            ? adjustingRegion
              ? 'Updating block region…'
              : 'Drag the highlight to adjust the extract block'
            : null)
        }
        hintTone={adjustError ? 'error' : 'muted'}
        onPageChange={updatePage}
        onScaleChange={setScale}
      />

      <div
        className={cn(
          'min-h-0 flex-1 overflow-auto p-4',
          isDark ? 'bg-zinc-950' : 'bg-workspace',
        )}
      >
        {loading || !pdf ? (
          <div
            className={cn(
              'flex h-full min-h-[16rem] items-center justify-center text-sm',
              isDark ? 'text-zinc-400' : 'text-muted-foreground',
            )}
          >
            Loading PDF…
          </div>
        ) : (
          <div ref={canvasAnchorRef} className="mx-auto w-fit">
            <PdfPageCanvas
              pdf={pdf}
              pageNumber={currentPage}
              scale={scale}
              citation={activeCitation}
              hasBlockComment={activeCitationHasComment}
              editable={canAdjustRegion}
              adjusting={adjustingRegion}
              onRegionCommit={handleRegionAdjust}
            />
          </div>
        )}
      </div>
    </div>
  )
}
