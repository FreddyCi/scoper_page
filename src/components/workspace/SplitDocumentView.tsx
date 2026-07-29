import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DownloadIcon, InfoIcon } from 'lucide-react'

import { CommentNavigator } from '@/components/workspace/CommentNavigator'
import { DocumentViewer } from '@/components/workspace/DocumentViewer'
import { ExtractedTextPane } from '@/components/workspace/ExtractedTextPane'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MenuOptionContent, MenuOptionHeader } from '@/components/ui/menu-option-content'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCommentedBlockIds } from '@/hooks/use-block-comments'
import { useDocumentComments } from '@/hooks/use-document-comments'
import { useDocumentBlocks } from '@/hooks/use-document-blocks'
import { useSplitPaneRatio } from '@/hooks/use-split-pane-ratio'
import { compareScope } from '@/services/compare-scope'
import { DOCUMENT_ROLE_LABELS } from '@/lib/document-roles'
import { beginBlobSave } from '@/lib/download-blob'
import { blockToCitation } from '@/lib/types'
import type { DocumentMeta, WorkspaceMode } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import { useSessionStore } from '@/store/session-store'

type SplitPaneTab = 'extract' | 'original' | 'profiles'

type SplitDocumentViewProps = {
  document: DocumentMeta
  initialPage?: number
  className?: string
}

const MODE_CTA: Record<WorkspaceMode, string> = {
  rfp: 'Qualify document',
  scope_creep: 'Compare scope',
}

function ExtractViewHelpButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Extract view help"
            className="text-muted-foreground"
          />
        }
      >
        <InfoIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-3">
        <p className="text-foreground text-sm font-semibold">Extract &amp; comments</p>
        <ul className="text-muted-foreground mt-2 space-y-2 text-xs leading-relaxed">
          <li>Click a block to highlight the matching passage in the PDF preview.</li>
          <li>Drag the blue highlight on the PDF to resize or move the extract region.</li>
          <li>Use the comment icon on a block row to attach a review note.</li>
          <li>When review notes exist, use the footer navigator to step through each note.</li>
          <li>Use Export for PDF markup or a LiteParse markdown file with PDF context.</li>
          <li>
            <span className="text-sky-800 font-medium">Blue highlight</span> = selected block.
            {' '}
            <span className="text-amber-800 font-medium">Amber ring</span> = block with a review
            note.
          </li>
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SplitDocumentViewFooter({
  statusLabel,
  commentNavigator = null,
  exportError = null,
  ctaLabel,
  ctaLoading = false,
  ctaLoadingLabel,
  onCtaClick,
  exportLabel = 'Export PDF',
  exportLoading = false,
  exportDisabled = false,
  onExportClick,
  markdownExportLoading = false,
  onExportMarkdownClick,
}: {
  statusLabel: string
  commentNavigator?: ReactNode
  exportError?: string | null
  ctaLabel: string
  ctaLoading?: boolean
  ctaLoadingLabel?: string
  onCtaClick: () => void
  exportLabel?: string
  exportLoading?: boolean
  exportDisabled?: boolean
  onExportClick?: (mode: 'markup' | 'burned-in') => void
  markdownExportLoading?: boolean
  onExportMarkdownClick?: () => void
}) {
  return (
    <footer className="border-border bg-surface flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-pill inline-flex items-center px-3 py-1 text-xs font-medium',
            exportError
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {exportError ?? statusLabel}
        </span>
        {commentNavigator}
      </div>
      <div className="flex items-center gap-2">
        {onExportClick || onExportMarkdownClick ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={exportDisabled || exportLoading || markdownExportLoading}
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={exportDisabled || exportLoading || markdownExportLoading}
                />
              }
            >
              <DownloadIcon className="size-3.5" />
              {exportLoading || markdownExportLoading
                ? 'Exporting…'
                : onExportClick && onExportMarkdownClick
                  ? 'Export'
                  : onExportMarkdownClick
                    ? 'Export Markdown'
                    : exportLabel}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-72 p-0">
              {onExportMarkdownClick ? (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-0 py-0 font-normal">
                      <MenuOptionHeader
                        title="Export Markdown"
                        description="LiteParse WASM — structured text, PDF annotations, form fields, and Scoper review notes."
                      />
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <DropdownMenuItem
                      className="items-start rounded-md px-3 py-2.5"
                      onClick={onExportMarkdownClick}
                    >
                      <MenuOptionContent
                        title="Download .md"
                        description="Browser-only conversion like the LiteParse demo — no server upload."
                      />
                    </DropdownMenuItem>
                  </div>
                  {onExportClick ? <DropdownMenuSeparator /> : null}
                </>
              ) : null}
              {onExportClick ? (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-0 py-0 font-normal">
                      <MenuOptionHeader
                        title="Export PDF"
                        description="Choose how review notes and highlights appear in the exported file."
                      />
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <DropdownMenuItem
                      className="items-start rounded-md px-3 py-2.5"
                      onClick={() => onExportClick('markup')}
                    >
                      <MenuOptionContent
                        title="Toggleable markup"
                        description="Highlights and notes you can hide in Preview or Acrobat. Best for re-importing comments."
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="items-start rounded-md px-3 py-2.5"
                      onClick={() => onExportClick('burned-in')}
                    >
                      <MenuOptionContent
                        title="Burned-in notes"
                        description="Always-visible yellow boxes on the page for sharing outside PDF viewers."
                      />
                    </DropdownMenuItem>
                  </div>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button type="button" size="sm" variant="default" onClick={onCtaClick} disabled={ctaLoading}>
          {ctaLoading ? (ctaLoadingLabel ?? 'Working…') : ctaLabel}
        </Button>
      </div>
    </footer>
  )
}

export function SplitDocumentView({
  document,
  initialPage = 1,
  className,
}: SplitDocumentViewProps) {
  const [activeTab, setActiveTab] = useState<SplitPaneTab>('extract')
  const [buildingProfiles, setBuildingProfiles] = useState(false)
  const [comparingScope, setComparingScope] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingMarkdown, setExportingMarkdown] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [commentNavIndex, setCommentNavIndex] = useState(0)
  const [pendingCommentFocus, setPendingCommentFocus] = useState<{
    commentId: string
    blockId: string
  } | null>(null)
  const { ratio, containerRef, onResizeStart } = useSplitPaneRatio(0.44)
  const mode = useSessionStore((state) => state.mode)
  const documents = useSessionStore((state) => state.documents)
  const selectedCitation = useSessionStore((state) => state.selectedCitation)
  const citationFocusSeq = useSessionStore((state) => state.citationFocusSeq)
  const setWorkspaceView = useSessionStore((state) => state.setWorkspaceView)
  const { blocks, loading: blocksLoading } = useDocumentBlocks(document.doc_id)
  const { blockIds: commentedBlockIds } = useCommentedBlockIds(document.doc_id)
  const { entries: documentComments, loading: documentCommentsLoading } =
    useDocumentComments(document.doc_id)

  useEffect(() => {
    if (commentNavIndex >= documentComments.length) {
      setCommentNavIndex(Math.max(0, documentComments.length - 1))
    }
  }, [commentNavIndex, documentComments.length])

  useEffect(() => {
    if (
      !selectedCitation ||
      selectedCitation.doc_id !== document.doc_id ||
      documentComments.length === 0
    ) {
      return
    }

    const index = documentComments.findIndex(
      (entry) => entry.comment.block_id === selectedCitation.block_id,
    )
    if (index >= 0) {
      setCommentNavIndex(index)
    }
  }, [document.doc_id, documentComments, selectedCitation?.block_id, citationFocusSeq])

  function navigateToComment(index: number) {
    const entry = documentComments[index]
    if (!entry) return

    setCommentNavIndex(index)
    focusCitation(blockToCitation(entry.block))
    setPendingCommentFocus({
      commentId: entry.comment.comment_id,
      blockId: entry.block.block_id,
    })
  }

  useEffect(() => {
    if (selectedCitation?.doc_id === document.doc_id) {
      setActiveTab('extract')
    }
  }, [selectedCitation?.block_id, citationFocusSeq, document.doc_id, selectedCitation?.doc_id])

  useEffect(() => {
    if (document.mime === 'application/pdf') {
      void import('@/services/export-annotated-pdf')
    }
  }, [document.mime])

  const statusLabel = useMemo(() => {
    if (blocksLoading) return 'Loading extracted blocks…'

    const blockCountLabel = `${blocks.length} block${blocks.length === 1 ? '' : 's'}`

    if (
      selectedCitation?.doc_id === document.doc_id &&
      selectedCitation.page_num != null
    ) {
      return `${blockCountLabel} · Page ${selectedCitation.page_num} selected`
    }

    return `${blockCountLabel} · ${document.filename}`
  }, [blocks.length, blocksLoading, document.doc_id, document.filename, selectedCitation])

  const canExportPdf = document.mime === 'application/pdf'
  const exportStatusHint =
    commentedBlockIds.size > 0
      ? `${commentedBlockIds.size} review note${commentedBlockIds.size === 1 ? '' : 's'}`
      : document.role !== 'unknown'
        ? `Role: ${DOCUMENT_ROLE_LABELS[document.role]}`
        : null

  const ocrEnabled = useSessionStore((state) => state.ocrEnabled)

  function handleExportPdf(commentMode: 'markup' | 'burned-in' = 'markup') {
    if (!canExportPdf || exportingPdf) return

    setExportError(null)
    setExportingPdf(true)

    void (async () => {
      try {
        const { annotatedExportFilename, exportAnnotatedPdf } = await import(
          '@/services/export-annotated-pdf'
        )
        const filename = annotatedExportFilename(document.filename, commentMode)
        const writeBlob = await beginBlobSave({
          filename,
          mime: 'application/pdf',
          extension: '.pdf',
        })
        const pdfBytes = await exportAnnotatedPdf(document, { commentMode })
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
        await writeBlob(blob)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return

        const message = error instanceof Error ? error.message : 'Export failed'
        setExportError(message)
        console.error('[split-document-view] export failed', error)
      } finally {
        setExportingPdf(false)
      }
    })()
  }

  function handleExportMarkdown() {
    if (!canExportPdf || exportingMarkdown) return

    setExportError(null)
    setExportingMarkdown(true)

    void (async () => {
      try {
        const { exportPdfMarkdownBlob } = await import('@/services/export-pdf-markdown')
        const { blob, filename } = await exportPdfMarkdownBlob(document, {
          ocrEnabled,
          includeScoperComments: true,
        })
        const writeBlob = await beginBlobSave({
          filename,
          mime: 'text/markdown',
          extension: '.md',
        })
        await writeBlob(blob)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return

        const message = error instanceof Error ? error.message : 'Markdown export failed'
        setExportError(message)
        console.error('[split-document-view] markdown export failed', error)
      } finally {
        setExportingMarkdown(false)
      }
    })()
  }

  function handleCtaClick() {
    if (mode === 'scope_creep') {
      const baseline = documents.find((doc) => doc.role === 'baseline')
      const change = documents.find((doc) => doc.role === 'change_request')

      if (!baseline || !change) {
        console.warn('[split-document-view] scope compare requires baseline + change_request roles')
        return
      }

      setComparingScope(true)
      void compareScope({
        baselineDocId: baseline.doc_id,
        candidateDocId: change.doc_id,
      })
        .then(() => {
          setWorkspaceView('profiles')
        })
        .catch((error) => {
          console.error('[split-document-view] compareScope failed', error)
        })
        .finally(() => {
          setComparingScope(false)
        })
      return
    }

    setBuildingProfiles(true)
    void useSessionStore
      .getState()
      .runRfpQualification()
      .then(() => {
        setWorkspaceView('profiles')
      })
      .catch((error) => {
        console.error('[split-document-view] runRfpQualification failed', error)
      })
      .finally(() => {
        setBuildingProfiles(false)
      })
  }

  return (
    <div
      className={cn(
        'border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border shadow-panel',
        className,
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SplitPaneTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-border/70 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <TabsList variant="segmented">
              <TabsTrigger value="extract">Extract</TabsTrigger>
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="profiles">Profiles</TabsTrigger>
            </TabsList>
            <ExtractViewHelpButton />
          </div>

          <p className="text-muted-foreground hidden min-w-0 truncate text-xs sm:block">
            {document.filename}
          </p>
        </div>

        <TabsContent value="extract" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
            <div
              className="bg-surface min-h-0 min-w-[16rem] overflow-hidden"
              style={{ width: `${ratio * 100}%` }}
            >
              <ExtractedTextPane
                docId={document.doc_id}
                className="h-full border-0 shadow-none"
                pendingCommentFocus={pendingCommentFocus}
                onPendingCommentFocusHandled={() => setPendingCommentFocus(null)}
              />
            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panes"
              onPointerDown={onResizeStart}
              className="bg-border hover:bg-muted-foreground/30 w-1 shrink-0 cursor-col-resize transition-colors"
            />

            <div className="min-h-0 min-w-[16rem] flex-1 overflow-hidden">
              <DocumentViewer
                document={document}
                initialPage={initialPage}
                theme="dark"
                className="h-full rounded-none border-0"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="original" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <DocumentViewer
            document={document}
            initialPage={initialPage}
            theme="dark"
            className="h-full min-h-[20rem] rounded-none border-0"
          />
        </TabsContent>

        <TabsContent
          value="profiles"
          className="text-muted-foreground mt-0 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center text-sm"
        >
          <p>Results profiles grid lives in the main profiles view — BDA-041.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setWorkspaceView('profiles')}>
            Open profiles
          </Button>
        </TabsContent>
      </Tabs>

      <SplitDocumentViewFooter
        statusLabel={statusLabel}
        commentNavigator={
          documentCommentsLoading || documentComments.length > 0 ? (
            <CommentNavigator
              entries={documentComments}
              activeIndex={commentNavIndex}
              loading={documentCommentsLoading}
              onIndexChange={navigateToComment}
            />
          ) : null
        }
        exportError={exportError}
        ctaLabel={MODE_CTA[mode]}
        ctaLoading={buildingProfiles || comparingScope}
        ctaLoadingLabel={comparingScope ? 'Comparing…' : 'Qualifying…'}
        onCtaClick={handleCtaClick}
        exportLabel={exportStatusHint ? `Export PDF (${exportStatusHint})` : 'Export PDF'}
        exportLoading={exportingPdf}
        exportDisabled={!canExportPdf}
        onExportClick={canExportPdf ? handleExportPdf : undefined}
        markdownExportLoading={exportingMarkdown}
        onExportMarkdownClick={canExportPdf ? handleExportMarkdown : undefined}
      />
    </div>
  )
}
