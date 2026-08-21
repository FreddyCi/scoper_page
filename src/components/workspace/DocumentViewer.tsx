import { useEffect, useMemo, useRef, useState, useCallback } from 'react'

import { PdfPageCanvas } from '@/components/workspace/PdfPageCanvas'
import { PdfMarkupToolbar, type PdfMarkupStrokeWidth } from '@/components/workspace/PdfMarkupToolbar'
import { PdfViewerToolbar } from '@/components/workspace/PdfViewerToolbar'
import { MarkdownDocumentViewer } from '@/components/workspace/MarkdownDocumentViewer'
import { OfficeDocumentPreview } from '@/components/workspace/OfficeDocumentPreview'
import { SpreadsheetDocumentPreview } from '@/components/workspace/SpreadsheetDocumentPreview'
import { isSpreadsheetDocument, isWordDocument } from '@/lib/document-preview'
import { useCommentedBlockIds } from '@/hooks/use-block-comments'
import type {
  PdfDrawingShapeCommit,
  PdfDrawingStampCommit,
  PdfDrawingStrokeCommit,
  PdfDrawingTextCommit,
} from '@/components/workspace/PdfDrawingOverlay'
import { usePdfDrawingAnnotations } from '@/hooks/use-pdf-drawing-annotations'
import { useMarkDictation } from '@/hooks/use-mark-dictation'
import { usePdfDocument } from '@/hooks/use-pdf-document'
import type { Bbox, PdfDrawingGeometry } from '@/lib/types'
import { blockToCitation } from '@/lib/types'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { redefineBlockRegion } from '@/services/block-adjust'
import { focusCitation } from '@/services/citation-bridge'
import { useSessionStore } from '@/store/session-store'
import type { DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  isPdfMarkupShortcutTarget,
  pdfMarkupToolForKey,
} from '@/lib/pdf-markup-tool-shortcuts'

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
  const pdfMarkDrawingMode = useSessionStore((state) => state.pdfMarkDrawingMode)
  const pdfMarkTool = useSessionStore((state) => state.pdfMarkTool)
  const pdfMarkColor = useSessionStore((state) => state.pdfMarkColor)
  const pdfMarkStrokeWidth = useSessionStore((state) => state.pdfMarkStrokeWidth)
  const setPdfMarkDrawingMode = useSessionStore((state) => state.setPdfMarkDrawingMode)
  const applyPdfMarkupToolbarChange = useSessionStore((state) => state.applyPdfMarkupToolbarChange)
  const setPdfMarkTool = useSessionStore((state) => state.setPdfMarkTool)
  /** Mark mode on the PDF original pane (session-backed; toolbar toggle in BDA-234). */
  const markMode = pdfMarkDrawingMode
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
  const [selectedDrawingAnnotationIds, setSelectedDrawingAnnotationIds] = useState<string[]>([])

  const totalPages = pdf?.numPages ?? 0
  const activeCitation =
    selectedCitation?.doc_id === document.doc_id ? selectedCitation : null
  const currentPage = clampPage(page, totalPages)
  const { blockIds: commentedBlockIds } = useCommentedBlockIds(document.doc_id)
  const {
    annotations: drawingAnnotations,
    loading: drawingAnnotationsLoading,
    refresh: refreshDrawingAnnotations,
    commitStroke,
    commitShape,
    commitText,
    commitStamp,
    eraseAnnotation,
    eraseAnnotations,
    moveDrawingMark,
    updateMarkVoiceNote,
    undoDrawingMark,
    redoDrawingMark,
    canUndoDrawingMark,
    canRedoDrawingMark,
  } = usePdfDrawingAnnotations(document.doc_id, currentPage)

  const {
    available: dictationAvailable,
    isDictating,
    targetAnnotationId: dictationTargetId,
    draftNote: dictationDraft,
    committedPreview: dictationPreview,
    handleSpaceKeyDown,
    handleSpaceKeyUp,
    onSelectionChange: onDictationSelectionChange,
    onWindowBlur: onDictationWindowBlur,
  } = useMarkDictation({
    markMode,
    selectedAnnotationIds: selectedDrawingAnnotationIds,
    annotations: drawingAnnotationsLoading ? [] : drawingAnnotations,
    updateMarkVoiceNote,
  })

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
      pdf &&
      !markMode,
  )

  useEffect(() => {
    setSelectedDrawingAnnotationIds([])
  }, [currentPage, document.doc_id])

  useEffect(() => {
    if (!markMode) return

    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey
      if (!mod || event.key.toLowerCase() !== 'z') return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return
      }

      event.preventDefault()
      if (event.shiftKey) {
        void redoDrawingMark()
      } else {
        void undoDrawingMark()
      }
    }

    globalThis.document.addEventListener('keydown', onKeyDown)
    return () => globalThis.document.removeEventListener('keydown', onKeyDown)
  }, [markMode, redoDrawingMark, undoDrawingMark])

  useEffect(() => {
    if (!markMode) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isPdfMarkupShortcutTarget(event.target)) return

      const tool = pdfMarkupToolForKey(event.key)
      if (!tool) return

      event.preventDefault()
      setPdfMarkTool(tool)
    }

    globalThis.document.addEventListener('keydown', onKeyDown)
    return () => globalThis.document.removeEventListener('keydown', onKeyDown)
  }, [markMode, setPdfMarkTool])

  useEffect(() => {
    if (!markMode) return

    function onKeyDown(event: KeyboardEvent) {
      if (handleSpaceKeyDown(event)) {
        event.preventDefault()
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      handleSpaceKeyUp(event)
    }

    globalThis.window.addEventListener('keydown', onKeyDown)
    globalThis.window.addEventListener('keyup', onKeyUp)
    return () => {
      globalThis.window.removeEventListener('keydown', onKeyDown)
      globalThis.window.removeEventListener('keyup', onKeyUp)
    }
  }, [handleSpaceKeyDown, handleSpaceKeyUp, markMode])

  useEffect(() => {
    if (!markMode) return

    function onBlur() {
      onDictationWindowBlur()
    }

    function onVisibilityChange() {
      if (globalThis.document.visibilityState === 'hidden') {
        onDictationWindowBlur()
      }
    }

    globalThis.window.addEventListener('blur', onBlur)
    globalThis.document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      globalThis.window.removeEventListener('blur', onBlur)
      globalThis.document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [markMode, onDictationWindowBlur])

  async function persistDrawingMark<T>(
    action: () => Promise<T>,
    errorLabel: string,
  ): Promise<T | undefined> {
    try {
      return await action()
    } catch (error) {
      console.error(`[document-viewer] ${errorLabel}`, error)
      await refreshDrawingAnnotations()
      return undefined
    }
  }

  const handleStrokeCommit = async (commit: PdfDrawingStrokeCommit) => {
    await persistDrawingMark(() => commitStroke(commit), 'drawing stroke commit failed')
  }

  const handleShapeCommit = async (commit: PdfDrawingShapeCommit) => {
    await persistDrawingMark(() => commitShape(commit), 'drawing shape commit failed')
  }

  const handleTextCommit = async (commit: PdfDrawingTextCommit) => {
    await persistDrawingMark(() => commitText(commit), 'drawing text commit failed')
  }

  const handleStampCommit = async (commit: PdfDrawingStampCommit) => {
    await persistDrawingMark(() => commitStamp(commit), 'drawing stamp commit failed')
  }

  const handleEraseAnnotation = async (annotationId: string) => {
    await persistDrawingMark(
      () => eraseAnnotation(annotationId),
      'erase annotation failed',
    )
    setSelectedDrawingAnnotationIds((previous) =>
      previous.filter((id) => id !== annotationId),
    )
  }

  const handleMoveAnnotation = async (annotationId: string, geometry: PdfDrawingGeometry) => {
    await persistDrawingMark(
      () => moveDrawingMark(annotationId, geometry),
      'move annotation failed',
    )
  }

  const handleDeleteSelectedMarks = async () => {
    if (selectedDrawingAnnotationIds.length === 0) return
    const ids = [...selectedDrawingAnnotationIds]
    await persistDrawingMark(
      () => eraseAnnotations(ids),
      'delete selected marks failed',
    )
    setSelectedDrawingAnnotationIds([])
  }

  useEffect(() => {
    if (!markMode || pdfMarkTool !== 'select' || selectedDrawingAnnotationIds.length === 0) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return
      }

      event.preventDefault()
      void handleDeleteSelectedMarks()
    }

    globalThis.document.addEventListener('keydown', onKeyDown)
    return () => globalThis.document.removeEventListener('keydown', onKeyDown)
  }, [handleDeleteSelectedMarks, markMode, pdfMarkTool, selectedDrawingAnnotationIds.length])

  const handleDrawingSelectionChange = useCallback(
    (annotationIds: string[]) => {
      onDictationSelectionChange(annotationIds)
      setSelectedDrawingAnnotationIds(annotationIds)
    },
    [onDictationSelectionChange],
  )

  const effectiveMarkStrokeWidth =
    pdfMarkTool === 'highlighter'
      ? Math.max(pdfMarkStrokeWidth, 8)
      : pdfMarkStrokeWidth
  const markColor = pdfMarkColor
  const pageDrawingAnnotations = drawingAnnotationsLoading ? [] : drawingAnnotations

  const markDictationHint =
    markMode && isDictating
      ? 'Listening… release Space to save'
      : markMode && !dictationAvailable
        ? 'Voice notation requires HTTPS + Chrome/Edge speech support'
        : markMode && selectedDrawingAnnotationIds.length === 1
          ? 'Hold Space to dictate notation'
          : null

  const toolbarHint =
    adjustError ??
    markDictationHint ??
    (markMode
      ? `Mark window locations on the plan · Page ${currentPage} of ${totalPages || '—'} · ${Math.round(scale * 100)}%`
      : canAdjustRegion
        ? adjustingRegion
          ? 'Updating block region…'
          : 'Drag the highlight to adjust the extract block'
        : null)

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
        hint={toolbarHint}
        hintTone={adjustError ? 'error' : 'muted'}
        markMode={markMode}
        onMarkModeChange={setPdfMarkDrawingMode}
        markToolbar={
          <PdfMarkupToolbar
            theme={theme}
            tool={pdfMarkTool}
            color={pdfMarkColor}
            strokeWidth={pdfMarkStrokeWidth as PdfMarkupStrokeWidth}
            onChange={applyPdfMarkupToolbarChange}
            onUndo={() => {
              void undoDrawingMark()
            }}
            onRedo={() => {
              void redoDrawingMark()
            }}
            canUndo={canUndoDrawingMark}
            canRedo={canRedoDrawingMark}
            selectionCount={selectedDrawingAnnotationIds.length}
            onDeleteSelection={() => {
              void handleDeleteSelectedMarks()
            }}
            speechNotesAvailable={dictationAvailable}
          />
        }
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
              drawingAnnotations={pageDrawingAnnotations}
              markMode={markMode}
              markTool={pdfMarkTool}
              markColor={markColor}
              markStrokeWidth={effectiveMarkStrokeWidth}
              onStrokeCommit={
                markMode && (pdfMarkTool === 'pen' || pdfMarkTool === 'highlighter')
                  ? handleStrokeCommit
                  : undefined
              }
              onShapeCommit={
                markMode && (pdfMarkTool === 'rect' || pdfMarkTool === 'ellipse')
                  ? handleShapeCommit
                  : undefined
              }
              onTextCommit={markMode && pdfMarkTool === 'text' ? handleTextCommit : undefined}
              onStampCommit={markMode && pdfMarkTool === 'stamp' ? handleStampCommit : undefined}
              onEraseAnnotation={
                markMode && pdfMarkTool === 'eraser' ? handleEraseAnnotation : undefined
              }
              selectedAnnotationIds={
                markMode && pdfMarkTool === 'select' ? selectedDrawingAnnotationIds : undefined
              }
              onSelectionChange={
                markMode && pdfMarkTool === 'select' ? handleDrawingSelectionChange : undefined
              }
              onMoveAnnotation={
                markMode && pdfMarkTool === 'hand' ? handleMoveAnnotation : undefined
              }
              dictationTargetId={dictationTargetId}
              dictationDraft={dictationDraft}
              dictationPreview={dictationPreview}
              isDictating={isDictating}
            />
          </div>
        )}
      </div>
    </div>
  )
}
