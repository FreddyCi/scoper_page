import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DownloadIcon, InfoIcon, Maximize2Icon, Minimize2Icon } from 'lucide-react'

import { AnnotatedMarkdownView } from '@/components/workspace/AnnotatedMarkdownView'
import { CommentNavigator } from '@/components/workspace/CommentNavigator'
import { DocumentViewer } from '@/components/workspace/DocumentViewer'
import { DrawingTakeoffPanel } from '@/components/workspace/drawing-takeoff-panel'
import { ExtractedTextPane } from '@/components/workspace/ExtractedTextPane'
import { MarkdownDocumentViewer } from '@/components/workspace/MarkdownDocumentViewer'
import { OfficeDocumentPreview } from '@/components/workspace/OfficeDocumentPreview'
import { SpreadsheetDocumentPreview } from '@/components/workspace/SpreadsheetDocumentPreview'
import { Button } from '@/components/ui/button'
import {
  BrandDropdownContent,
  BrandMenuSection,
  BrandMenuSectionHeader,
  brandMenuItemClass,
} from '@/components/ui/brand-menu'
import { MenuOptionContent } from '@/components/ui/menu-option-content'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { brandAccentStyles } from '@/lib/brand-accent'
import {
  isMarkdownDocument,
  isSpreadsheetDocument,
  isWordDocument,
  readLayoutKind,
  usesReadPreviewLayout,
} from '@/lib/document-preview'
import { useCommentedBlockIds } from '@/hooks/use-block-comments'
import { useDocumentComments } from '@/hooks/use-document-comments'
import { useDocumentBlocks } from '@/hooks/use-document-blocks'
import { useSplitPaneRatio } from '@/hooks/use-split-pane-ratio'
import { DOCUMENT_ROLE_LABELS } from '@/lib/document-roles'
import { aggregateDrawingTakeoff } from '@/lib/drawing-takeoff'
import { beginBlobSave } from '@/lib/download-blob'
import { blockToCitation } from '@/lib/types'
import type { DocumentMeta, PdfDrawingAnnotation, WorkspaceMode } from '@/lib/types'
import { SCOUT_TARGETS, scoutTargetProps } from '@/lib/scout/targets'
import {
  SCOUT_UI_EVENTS,
  dispatchScoutUiEvent,
  type ScoutJumpToTakeoffMarkDetail,
} from '@/lib/scout/scout-ui-events'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import {
  commonSectionPathPrefix,
  compactSectionPathLabel,
} from '@/services/document-blocks'
import { useSessionStore } from '@/store/session-store'

type SplitPaneTab = 'read' | 'preview' | 'extract' | 'original' | 'profiles'

/** Immersive PDF workspace — maximizes canvas for plan/drawing mark-up. */
type PdfFocusLayout = 'normal' | 'page' | 'split'

export type AnnotatedPdfFooterExportRequest = {
  commentMode: 'markup' | 'burned-in'
  includeDrawingMarks?: boolean
}

type SplitDocumentViewProps = {
  document: DocumentMeta
  initialPage?: number
  className?: string
}

const MODE_CTA: Record<WorkspaceMode, string> = {
  rfp: 'Qualify document',
  proposal: 'Open proposal workspace',
}

function ExtractViewHelpButton({ layoutKind }: { layoutKind: ReturnType<typeof readLayoutKind> }) {
  const accent = layoutKind === 'pdf' ? 'sky' : 'violet'
  const styles = brandAccentStyles(accent)
  const isReadable = layoutKind !== 'pdf'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              layoutKind === 'word'
                ? 'Word view help'
                : layoutKind === 'spreadsheet'
                  ? 'Spreadsheet view help'
                  : isReadable
                    ? 'Read view help'
                    : 'Extract view help'
            }
            className={cn('rounded-full', styles.trigger, 'border-transparent hover:border-current/20')}
          />
        }
      >
        <InfoIcon className="size-4" />
      </DropdownMenuTrigger>
      <BrandDropdownContent align="start" sideOffset={8}>
        <BrandMenuSection accent={accent}>
          <BrandMenuSectionHeader
            accent={accent}
            title={
              layoutKind === 'word'
                ? 'Word views'
                : layoutKind === 'spreadsheet'
                  ? 'Spreadsheet views'
                  : isReadable
                    ? 'Markdown views'
                    : 'Extract & comments'
            }
            description={
              layoutKind === 'word'
                ? 'Read to select checklist passages for chat · Preview for a clean formatted layout.'
                : layoutKind === 'spreadsheet'
                  ? 'Read to select rows for chat · Preview for the full sheet grid (Excel, Google export, .ods).'
                  : isReadable
                    ? 'Read for citations and review notes · Preview for tables and document structure.'
                    : 'Select blocks in the extract pane and sync highlights with the PDF preview.'
            }
          />
          <ul className="text-muted-foreground space-y-2 px-3 pb-3 text-xs leading-relaxed">
            {layoutKind === 'word' ? (
              <>
                <li>
                  <span className={cn('font-medium', styles.title)}>Read</span> — select paragraphs
                  for chat citations (keyword checklist review).
                </li>
                <li>
                  <span className={cn('font-medium', styles.title)}>Preview</span> — full extracted
                  text in a readable document layout.
                </li>
                <li>Original Word formatting is not rendered; content comes from ingest blocks.</li>
              </>
            ) : layoutKind === 'spreadsheet' ? (
              <>
                <li>
                  <span className={cn('font-medium', styles.title)}>Read</span> — select ingested rows
                  for chat citations.
                </li>
                <li>
                  <span className={cn('font-medium', styles.title)}>Preview</span> — sheet grid with
                  tabs; highlights the row when you select a block in Read.
                </li>
                <li>
                  Upload .xlsx (including Google Sheets download), legacy .xls, or LibreOffice .ods.
                </li>
              </>
            ) : isReadable ? (
              <>
                <li>
                  <span className={cn('font-medium', styles.title)}>Read</span> — annotated
                  paragraphs for citations and enhancements.
                </li>
                <li>
                  <span className={cn('font-medium', styles.title)}>Preview</span> — full rendered
                  markdown with tables, lists, and formatting.
                </li>
                <li>Click a passage in Read to select it for chat citations.</li>
                <li>Use the sparkles icon to enhance a passage with Scoper 1.7.</li>
                <li>
                  Edit the instruction, click <span className="font-medium">Change</span> to
                  regenerate, then <span className="font-medium">Recorded</span> to apply.
                </li>
                <li className="border-border/70 border-t pt-2">
                  <span className={cn('font-medium', styles.title)}>Violet highlight</span> = selected
                  passage.{' '}
                  <span className={cn('font-medium', styles.title)}>Violet ring</span> = enhanced
                  passage.
                </li>
              </>
            ) : (
              <>
                <li>Click a block to highlight the matching passage in the PDF preview.</li>
                <li>Drag the blue highlight on the PDF to resize or move the extract region.</li>
                <li>Use the comment icon on a block row to attach a review note.</li>
                <li>When review notes exist, use the footer navigator to step through each note.</li>
                <li>Use Export to download markdown/PDF (toggleable markup, burned-in notes, drawing marks) or convert a PDF into a chat context tab.</li>
                <li className="border-border/70 border-t pt-2">
                  <span className={cn('font-medium', styles.title)}>Blue highlight</span> = selected
                  block.{' '}
                  <span className="text-amber-800 font-medium">Amber ring</span> = block with a review
                  note.
                </li>
              </>
            )}
          </ul>
        </BrandMenuSection>
      </BrandDropdownContent>
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
  drawingMarkCount = 0,
  windowMarkCount = 0,
  onTakeoffOpenClick,
  onExportTakeoffCsvClick,
  onExportMenuOpenChange,
  markdownExportLoading = false,
  onExportMarkdownClick,
  markdownExportDescription,
  contextConvertLoading = false,
  onConvertToContextClick,
  contextConvertDescription,
  compact = false,
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
  onExportClick?: (request: AnnotatedPdfFooterExportRequest) => void
  drawingMarkCount?: number
  windowMarkCount?: number
  onTakeoffOpenClick?: () => void
  onExportTakeoffCsvClick?: () => void
  onExportMenuOpenChange?: (open: boolean) => void
  markdownExportLoading?: boolean
  onExportMarkdownClick?: () => void
  markdownExportDescription?: string
  contextConvertLoading?: boolean
  onConvertToContextClick?: () => void
  contextConvertDescription?: string
  compact?: boolean
}) {
  return (
    <footer
      className={cn(
        'border-border bg-surface flex shrink-0 items-center justify-between gap-3 border-t px-4',
        compact ? 'py-2' : 'py-3',
      )}
    >
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
        {windowMarkCount > 0 && onTakeoffOpenClick ? (
          <button
            {...scoutTargetProps(SCOUT_TARGETS.takeoffFooterPill)}
            type="button"
            className="rounded-pill bg-rose-50 text-rose-900 hover:bg-rose-100/90 inline-flex items-center px-3 py-1 text-xs font-medium transition-colors"
            onClick={onTakeoffOpenClick}
          >
            {windowMarkCount} window mark{windowMarkCount === 1 ? '' : 's'}
          </button>
        ) : null}
        {commentNavigator}
      </div>
      <div className="flex items-center gap-2">
        {onExportClick || onExportMarkdownClick || onConvertToContextClick ? (
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) onExportMenuOpenChange?.(true)
            }}
          >
            <DropdownMenuTrigger
              disabled={
                exportDisabled || exportLoading || markdownExportLoading || contextConvertLoading
              }
              render={
                <Button
                  {...scoutTargetProps(SCOUT_TARGETS.splitExportMenu)}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    exportDisabled ||
                    exportLoading ||
                    markdownExportLoading ||
                    contextConvertLoading
                  }
                  className="border-sky-200/80 bg-surface hover:bg-sky-50/80 rounded-full"
                />
              }
            >
              <DownloadIcon className="size-3.5" />
              {exportLoading || markdownExportLoading || contextConvertLoading
                ? 'Working…'
                : onExportClick || onExportMarkdownClick || onConvertToContextClick
                  ? 'Export'
                  : exportLabel}
            </DropdownMenuTrigger>
            <BrandDropdownContent align="end" side="top" sideOffset={10}>
              {onExportMarkdownClick ? (
                <BrandMenuSection accent="sky">
                  <BrandMenuSectionHeader
                    accent="sky"
                    title="Export Markdown"
                    description={
                      markdownExportDescription ??
                      'PDF annotations, form fields, and Scoper review notes.'
                    }
                  />
                  <div className="flex flex-col gap-1 p-1.5 pt-0">
                    <DropdownMenuItem
                      className={brandMenuItemClass('sky')}
                      onClick={onExportMarkdownClick}
                    >
                      <MenuOptionContent
                        title="Download .md"
                        description="Browser-only conversion like the LiteParse demo — no server upload."
                        titleClassName={brandAccentStyles('sky').title}
                      />
                    </DropdownMenuItem>
                  </div>
                </BrandMenuSection>
              ) : null}
              {onConvertToContextClick ? (
                <BrandMenuSection accent="violet">
                  <BrandMenuSectionHeader
                    accent="violet"
                    title="Convert to context"
                    description={
                      contextConvertDescription ??
                      'Parse this PDF to markdown and add it as a supporting context tab in chat.'
                    }
                  />
                  <div className="flex flex-col gap-1 p-1.5 pt-0">
                    <DropdownMenuItem
                      className={brandMenuItemClass('violet')}
                      onClick={onConvertToContextClick}
                    >
                      <MenuOptionContent
                        title="Add context tab"
                        description="Ingests markdown blocks, pins the file to chat, and opens it in the workspace tab row."
                        titleClassName={brandAccentStyles('violet').title}
                      />
                    </DropdownMenuItem>
                  </div>
                </BrandMenuSection>
              ) : null}
              {onExportClick ? (
                <BrandMenuSection accent="amber">
                  <BrandMenuSectionHeader
                    accent="amber"
                    title="Export PDF"
                    description="Choose how review notes and highlights appear in the exported file."
                  />
                  <div className="flex flex-col gap-1 p-1.5 pt-0">
                    <DropdownMenuItem
                      className={brandMenuItemClass('amber')}
                      onClick={() => onExportClick({ commentMode: 'markup' })}
                    >
                      <MenuOptionContent
                        title="Toggleable markup"
                        description={
                          drawingMarkCount > 0
                            ? 'Highlights, drawing markers, and voice notations you can hide in Preview or Acrobat.'
                            : 'Highlights and notes you can hide in Preview or Acrobat.'
                        }
                        titleClassName={brandAccentStyles('amber').title}
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={brandMenuItemClass('amber')}
                      onClick={() => onExportClick({ commentMode: 'burned-in' })}
                    >
                      <MenuOptionContent
                        title="Burned-in notes"
                        description={
                          drawingMarkCount > 0
                            ? 'Always-visible review notes. Drawing stamps stay on the page; hover a comment pin or use the PDF markup panel to read voice notation.'
                            : 'Always-visible yellow boxes on the page for sharing outside PDF viewers.'
                        }
                        titleClassName={brandAccentStyles('amber').title}
                      />
                    </DropdownMenuItem>
                  </div>
                </BrandMenuSection>
              ) : null}
              {onExportClick && drawingMarkCount > 0 ? (
                <BrandMenuSection accent="rose">
                  <BrandMenuSectionHeader
                    accent="rose"
                    title="Drawing marks"
                    description={`${drawingMarkCount} vector mark${drawingMarkCount === 1 ? '' : 's'} on this document — stamps burn in; voice notation is a hover/toggle PDF comment.`}
                  />
                  <div className="flex flex-col gap-1 p-1.5 pt-0">
                    <DropdownMenuItem
                      className={brandMenuItemClass('rose')}
                      onClick={() => onTakeoffOpenClick?.()}
                    >
                      <MenuOptionContent
                        title="Stamp takeoff"
                        description="Grouped window marks with counts, pages, and voice notes — click a row to jump on the plan."
                        titleClassName={brandAccentStyles('rose').title}
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={brandMenuItemClass('rose')}
                      onClick={() => onExportTakeoffCsvClick?.()}
                      {...scoutTargetProps(SCOUT_TARGETS.takeoffCsvExport)}
                    >
                      <MenuOptionContent
                        title="Export takeoff CSV"
                        description="Window stamp counts grouped by label, color, page, and voice notation."
                        titleClassName={brandAccentStyles('rose').title}
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={brandMenuItemClass('rose')}
                      onClick={() =>
                        onExportClick({ commentMode: 'burned-in', includeDrawingMarks: true })
                      }
                    >
                      <MenuOptionContent
                        title="Export PDF with drawing marks"
                        description="Burned-in review notes and drawing stamps. Voice notation is a comment you can hover, click, or hide in Preview/Acrobat."
                        titleClassName={brandAccentStyles('rose').title}
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={brandMenuItemClass('rose')}
                      onClick={() =>
                        onExportClick({ commentMode: 'burned-in', includeDrawingMarks: false })
                      }
                    >
                      <MenuOptionContent
                        title="Burned-in notes only"
                        description="Same yellow note boxes without merging drawing marks into the file."
                        titleClassName={brandAccentStyles('rose').title}
                      />
                    </DropdownMenuItem>
                  </div>
                </BrandMenuSection>
              ) : null}
            </BrandDropdownContent>
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
  const isMarkdown = isMarkdownDocument(document)
  const usesReadLayout = usesReadPreviewLayout(document)
  const layoutKind = readLayoutKind(document)
  const isSpreadsheet = layoutKind === 'spreadsheet'
  const defaultTab: SplitPaneTab = usesReadLayout ? 'read' : 'extract'
  const [activeTab, setActiveTab] = useState<SplitPaneTab>(defaultTab)
  const [buildingProfiles, setBuildingProfiles] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingMarkdown, setExportingMarkdown] = useState(false)
  const [convertingToContext, setConvertingToContext] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [commentNavIndex, setCommentNavIndex] = useState(0)
  const [pendingCommentFocus, setPendingCommentFocus] = useState<{
    commentId: string
    blockId: string
  } | null>(null)
  const { ratio, containerRef, onResizeStart } = useSplitPaneRatio(0.44)
  const [pdfFocusLayout, setPdfFocusLayout] = useState<PdfFocusLayout>('normal')
  const chatCollapsedBeforeFocusRef = useRef<boolean | null>(null)
  const mode = useSessionStore((state) => state.mode)
  const setChatCollapsed = useSessionStore((state) => state.setChatCollapsed)
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
    setActiveTab(usesReadLayout ? 'read' : 'extract')
  }, [document.doc_id, usesReadLayout])

  useEffect(() => {
    if (selectedCitation?.doc_id === document.doc_id) {
      setActiveTab(usesReadLayout ? 'read' : 'extract')
    }
  }, [
    selectedCitation?.block_id,
    citationFocusSeq,
    document.doc_id,
    selectedCitation?.doc_id,
    usesReadLayout,
  ])

  useEffect(() => {
    if (document.mime === 'application/pdf') {
      void import('@/services/export-annotated-pdf')
    }
  }, [document.mime])

  const statusLabel = useMemo(() => {
    if (blocksLoading) return 'Loading extracted blocks…'

    const blockCountLabel = `${blocks.length} block${blocks.length === 1 ? '' : 's'}`
    const sectionPaths = blocks
      .map((block) => block.section_path?.trim())
      .filter((path): path is string => Boolean(path))
    const sectionPathPrefix = commonSectionPathPrefix(sectionPaths)

    if (selectedCitation?.doc_id === document.doc_id) {
      const selectedBlock = blocks.find((block) => block.block_id === selectedCitation.block_id)

      if (usesReadLayout) {
        if (selectedBlock?.section_path?.trim()) {
          const label = compactSectionPathLabel(selectedBlock.section_path, sectionPathPrefix)
          return `${blockCountLabel} · ${label} selected`
        }
        return `${blockCountLabel} · Passage selected`
      }

      if (selectedCitation.page_num != null) {
        return `${blockCountLabel} · Page ${selectedCitation.page_num} selected`
      }

      if (selectedBlock?.section_path) {
        return `${blockCountLabel} · ${selectedBlock.section_path} selected`
      }
    }

    return `${blockCountLabel} · ${document.filename}`
  }, [blocks, blocks.length, blocksLoading, document.doc_id, document.filename, usesReadLayout, selectedCitation])

  const canExportPdf = document.mime === 'application/pdf'
  const canExportMarkdown =
    canExportPdf || isWordDocument(document) || isSpreadsheetDocument(document)
  const canConvertToContext = canExportMarkdown

  const markdownExportDescription =
    layoutKind === 'word'
      ? 'Headings and paragraphs exported from Word (mammoth, browser-only).'
      : layoutKind === 'spreadsheet'
        ? 'Sheets as markdown tables — Excel, CSV, ODS, or Google export.'
        : undefined

  const contextConvertDescription =
    layoutKind === 'word' || layoutKind === 'spreadsheet'
      ? 'Export to markdown and add a supporting context tab for chat (same as PDF convert).'
      : undefined
  const exportStatusHint =
    commentedBlockIds.size > 0
      ? isMarkdown
        ? `${commentedBlockIds.size} enhancement${commentedBlockIds.size === 1 ? '' : 's'}`
        : `${commentedBlockIds.size} review note${commentedBlockIds.size === 1 ? '' : 's'}`
      : document.role !== 'unknown'
        ? `Role: ${DOCUMENT_ROLE_LABELS[document.role]}`
        : null

  const ocrEnabled = useSessionStore((state) => state.ocrEnabled)

  const [drawingMarkCount, setDrawingMarkCount] = useState(0)
  const [drawingAnnotationsAll, setDrawingAnnotationsAll] = useState<PdfDrawingAnnotation[]>([])
  const [takeoffPanelOpen, setTakeoffPanelOpen] = useState(false)
  const [markFocusRequest, setMarkFocusRequest] = useState<{
    page: number
    annotationId: string
    seq: number
  } | null>(null)

  const takeoffRows = useMemo(
    () => aggregateDrawingTakeoff(drawingAnnotationsAll),
    [drawingAnnotationsAll],
  )
  const windowMarkCount = useMemo(
    () => drawingAnnotationsAll.filter((annotation) => annotation.geometry.kind === 'stamp').length,
    [drawingAnnotationsAll],
  )

  const refreshDrawingMarkCount = useCallback(async () => {
    if (!canExportPdf) {
      setDrawingMarkCount(0)
      setDrawingAnnotationsAll([])
      return
    }

    try {
      const { fetchPdfDrawingAnnotationsForDoc } = await import(
        '@/services/pdf-drawing-annotations'
      )
      const rows = await fetchPdfDrawingAnnotationsForDoc(document.doc_id)
      setDrawingAnnotationsAll(rows)
      setDrawingMarkCount(rows.length)
    } catch (error) {
      console.error('[split-document-view] drawing mark count failed', error)
      setDrawingMarkCount(0)
      setDrawingAnnotationsAll([])
    }
  }, [canExportPdf, document.doc_id])

  const openTakeoffPanel = useCallback(() => {
    setTakeoffPanelOpen(true)
    void refreshDrawingMarkCount()
    dispatchScoutUiEvent(SCOUT_UI_EVENTS.openTakeoffPanel)
  }, [refreshDrawingMarkCount])

  const handleTakeoffRowActivate = useCallback(
    (row: (typeof takeoffRows)[number]) => {
      const annotationId = row.annotationIds[0]
      if (!annotationId) return

      const pdfViewerVisible =
        (layoutKind === 'pdf' && pdfFocusLayout !== 'normal') ||
        activeTab === 'extract' ||
        activeTab === 'original'
      if (!pdfViewerVisible) {
        setActiveTab('extract')
      }

      setMarkFocusRequest({
        page: row.page,
        annotationId,
        seq: Date.now(),
      })
      dispatchScoutUiEvent(SCOUT_UI_EVENTS.markJumpTriggered)
    },
    [activeTab, layoutKind, pdfFocusLayout],
  )

  useEffect(() => {
    function onScoutOpenTakeoffPanel() {
      setTakeoffPanelOpen(true)
      void refreshDrawingMarkCount()
    }

    function onScoutJumpToTakeoffMark(event: Event) {
      const detail = (event as CustomEvent<ScoutJumpToTakeoffMarkDetail>).detail
      if (!detail?.annotationId) return

      const pdfViewerVisible =
        (layoutKind === 'pdf' && pdfFocusLayout !== 'normal') ||
        activeTab === 'extract' ||
        activeTab === 'original'
      if (!pdfViewerVisible) {
        setActiveTab('extract')
      }

      setTakeoffPanelOpen(true)
      void refreshDrawingMarkCount()
      setMarkFocusRequest({
        page: detail.page,
        annotationId: detail.annotationId,
        seq: Date.now(),
      })
    }

    window.addEventListener(SCOUT_UI_EVENTS.openTakeoffPanel, onScoutOpenTakeoffPanel)
    window.addEventListener(SCOUT_UI_EVENTS.jumpToTakeoffMark, onScoutJumpToTakeoffMark)
    return () => {
      window.removeEventListener(SCOUT_UI_EVENTS.openTakeoffPanel, onScoutOpenTakeoffPanel)
      window.removeEventListener(SCOUT_UI_EVENTS.jumpToTakeoffMark, onScoutJumpToTakeoffMark)
    }
  }, [activeTab, layoutKind, pdfFocusLayout, refreshDrawingMarkCount])

  useEffect(() => {
    void refreshDrawingMarkCount()
  }, [refreshDrawingMarkCount])

  const isPdfLayout = layoutKind === 'pdf'
  const pdfFocusActive = isPdfLayout && pdfFocusLayout !== 'normal'

  const enterPdfFocus = useCallback(
    (layout: Exclude<PdfFocusLayout, 'normal'>) => {
      if (!isPdfLayout) return
      const store = useSessionStore.getState()
      chatCollapsedBeforeFocusRef.current = store.chatCollapsed
      if (!store.chatCollapsed) {
        setChatCollapsed(true)
      }
      setPdfFocusLayout(layout)
      setActiveTab(layout === 'split' ? 'extract' : 'original')
    },
    [isPdfLayout, setChatCollapsed],
  )

  const exitPdfFocus = useCallback(() => {
    setPdfFocusLayout('normal')
    if (chatCollapsedBeforeFocusRef.current === false) {
      setChatCollapsed(false)
    }
    chatCollapsedBeforeFocusRef.current = null
  }, [setChatCollapsed])

  useEffect(() => {
    if (!pdfFocusActive) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        exitPdfFocus()
      }
    }

    globalThis.document.addEventListener('keydown', onKeyDown)
    return () => globalThis.document.removeEventListener('keydown', onKeyDown)
  }, [exitPdfFocus, pdfFocusActive])

  useEffect(() => {
    if (!isPdfLayout && pdfFocusLayout !== 'normal') {
      setPdfFocusLayout('normal')
    }
  }, [isPdfLayout, pdfFocusLayout])

  const pdfOriginalPane = (
    <DocumentViewer
      document={document}
      initialPage={initialPage}
      focusDrawingMark={markFocusRequest}
      onFocusDrawingMarkHandled={() => setMarkFocusRequest(null)}
      theme="dark"
      className="h-full min-h-0 flex-1 rounded-none border-0"
    />
  )

  const pdfSplitPane = (
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
      <div
        className="bg-surface min-h-0 min-w-[14rem] overflow-hidden"
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

      <div className="min-h-0 min-w-[14rem] flex-1 overflow-hidden">{pdfOriginalPane}</div>
    </div>
  )

  function handleExportPdf(request: AnnotatedPdfFooterExportRequest = { commentMode: 'markup' }) {
    if (!canExportPdf || exportingPdf) return

    const { commentMode, includeDrawingMarks } = request
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
        const pdfBytes = await exportAnnotatedPdf(document, { commentMode, includeDrawingMarks })
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

  function handleExportTakeoffCsv() {
    setExportError(null)

    void (async () => {
      try {
        const { downloadDrawingTakeoffCsv } = await import('@/services/export-drawing-takeoff-csv')
        await downloadDrawingTakeoffCsv({
          baselineFilename: document.filename,
          annotations: drawingAnnotationsAll,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return

        const message = error instanceof Error ? error.message : 'Takeoff CSV export failed'
        setExportError(message)
        console.error('[split-document-view] takeoff csv export failed', error)
      }
    })()
  }

  function handleExportMarkdown() {
    if (!canExportMarkdown || exportingMarkdown) return

    setExportError(null)
    setExportingMarkdown(true)

    void (async () => {
      try {
        const { exportDocumentMarkdownBlob } = await import('@/services/export-document-markdown')
        const { blob, filename } = await exportDocumentMarkdownBlob(document, {
          ocrEnabled,
          includeScoperComments: document.mime === 'application/pdf',
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

  function handleConvertToContext() {
    if (!canConvertToContext || convertingToContext) return

    setExportError(null)
    setConvertingToContext(true)

    void (async () => {
      try {
        const { convertDocumentToContextDocument } = await import(
          '@/services/convert-document-to-context'
        )
        await convertDocumentToContextDocument(document, {
          ocrEnabled,
          includeScoperComments: document.mime === 'application/pdf',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Context conversion failed'
        setExportError(message)
        console.error('[split-document-view] context conversion failed', error)
      } finally {
        setConvertingToContext(false)
      }
    })()
  }

  function handleCtaClick() {
    if (mode === 'proposal') {
      setWorkspaceView('profiles')
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
        pdfFocusActive && 'fixed inset-0 z-[100] rounded-none border-0 shadow-elevated',
        className,
      )}
    >
      {pdfFocusActive ? (
        <>
          <div className="border-border/70 bg-surface flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={exitPdfFocus}>
                <Minimize2Icon className="size-3.5" />
                Exit full page
              </Button>
              <Tabs
                value={pdfFocusLayout}
                onValueChange={(value) => {
                  if (value === 'page' || value === 'split') {
                    setPdfFocusLayout(value)
                  }
                }}
              >
                <TabsList variant="segmented" aria-label="Full page layout">
                  <TabsTrigger value="page">Full page</TabsTrigger>
                  <TabsTrigger value="split">Split</TabsTrigger>
                </TabsList>
              </Tabs>
              <span className="text-muted-foreground hidden text-xs sm:inline">Esc to exit</span>
            </div>
            <p className="text-muted-foreground min-w-0 truncate text-xs">{document.filename}</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {pdfFocusLayout === 'split' ? pdfSplitPane : pdfOriginalPane}
          </div>

          <SplitDocumentViewFooter
            compact
            statusLabel={statusLabel}
            commentNavigator={
              documentCommentsLoading || documentComments.length > 0 ? (
                <CommentNavigator
                  entries={documentComments}
                  activeIndex={commentNavIndex}
                  loading={documentCommentsLoading}
                  variant={isMarkdown ? 'enhance' : 'review'}
                  onIndexChange={navigateToComment}
                />
              ) : null
            }
            exportError={exportError}
            ctaLabel={MODE_CTA[mode]}
            ctaLoading={mode === 'rfp' && buildingProfiles}
            ctaLoadingLabel="Qualifying…"
            onCtaClick={handleCtaClick}
            exportLabel={exportStatusHint ? `Export PDF (${exportStatusHint})` : 'Export PDF'}
            exportLoading={exportingPdf}
            exportDisabled={!canExportPdf && !canExportMarkdown}
            onExportClick={canExportPdf ? handleExportPdf : undefined}
            drawingMarkCount={drawingMarkCount}
            windowMarkCount={windowMarkCount}
            onTakeoffOpenClick={drawingMarkCount > 0 ? openTakeoffPanel : undefined}
            onExportTakeoffCsvClick={drawingMarkCount > 0 ? handleExportTakeoffCsv : undefined}
            onExportMenuOpenChange={() => {
              void refreshDrawingMarkCount()
            }}
            markdownExportLoading={exportingMarkdown}
            onExportMarkdownClick={canExportMarkdown ? handleExportMarkdown : undefined}
            markdownExportDescription={markdownExportDescription}
            contextConvertLoading={convertingToContext}
            onConvertToContextClick={canConvertToContext ? handleConvertToContext : undefined}
            contextConvertDescription={contextConvertDescription}
          />
        </>
      ) : (
      <>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SplitPaneTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-border/70 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <TabsList variant="segmented">
              {usesReadLayout ? (
                <>
                  <TabsTrigger value="read">Read</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="extract">Extract</TabsTrigger>
                  <TabsTrigger value="original">Original</TabsTrigger>
                </>
              )}
              <TabsTrigger value="profiles">Profiles</TabsTrigger>
            </TabsList>
            <ExtractViewHelpButton layoutKind={layoutKind} />
            {isPdfLayout ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="hidden shrink-0 sm:inline-flex"
                onClick={() => enterPdfFocus('page')}
              >
                <Maximize2Icon className="size-3.5" />
                Full page
              </Button>
            ) : null}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            {isPdfLayout ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="sm:hidden"
                aria-label="Full page view"
                onClick={() => enterPdfFocus('page')}
              >
                <Maximize2Icon className="size-4" />
              </Button>
            ) : null}
            <p className="text-muted-foreground hidden min-w-0 truncate text-xs sm:block">
              {document.filename}
            </p>
          </div>
        </div>

        <TabsContent value="read" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          <AnnotatedMarkdownView
            document={document}
            className="h-full min-h-0 rounded-none border-0 shadow-none"
            pendingCommentFocus={pendingCommentFocus}
            onPendingCommentFocusHandled={() => setPendingCommentFocus(null)}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          {isMarkdown ? (
            <MarkdownDocumentViewer
              document={document}
              variant="preview"
              className="h-full min-h-0 rounded-none border-0 shadow-none"
            />
          ) : isSpreadsheet ? (
            <SpreadsheetDocumentPreview
              document={document}
              className="h-full min-h-0 rounded-none border-0 shadow-none"
            />
          ) : (
            <OfficeDocumentPreview
              document={document}
              className="h-full min-h-0 rounded-none border-0 shadow-none"
            />
          )}
        </TabsContent>

        <TabsContent value="extract" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          {pdfSplitPane}
        </TabsContent>

        <TabsContent value="original" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          {pdfOriginalPane}
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
              variant={isMarkdown ? 'enhance' : 'review'}
              onIndexChange={navigateToComment}
            />
          ) : null
        }
        exportError={exportError}
        ctaLabel={MODE_CTA[mode]}
        ctaLoading={mode === 'rfp' && buildingProfiles}
        ctaLoadingLabel="Qualifying…"
        onCtaClick={handleCtaClick}
        exportLabel={exportStatusHint ? `Export PDF (${exportStatusHint})` : 'Export PDF'}
        exportLoading={exportingPdf}
        exportDisabled={!canExportPdf && !canExportMarkdown}
        onExportClick={canExportPdf ? handleExportPdf : undefined}
        drawingMarkCount={drawingMarkCount}
        windowMarkCount={windowMarkCount}
        onTakeoffOpenClick={drawingMarkCount > 0 ? openTakeoffPanel : undefined}
        onExportTakeoffCsvClick={drawingMarkCount > 0 ? handleExportTakeoffCsv : undefined}
        onExportMenuOpenChange={() => {
          void refreshDrawingMarkCount()
        }}
        markdownExportLoading={exportingMarkdown}
        onExportMarkdownClick={canExportMarkdown ? handleExportMarkdown : undefined}
        markdownExportDescription={markdownExportDescription}
        contextConvertLoading={convertingToContext}
        onConvertToContextClick={canConvertToContext ? handleConvertToContext : undefined}
        contextConvertDescription={contextConvertDescription}
      />
      </>
      )}
      <DrawingTakeoffPanel
        open={takeoffPanelOpen}
        onOpenChange={setTakeoffPanelOpen}
        rows={takeoffRows}
        documentFilename={document.filename}
        onRowActivate={handleTakeoffRowActivate}
      />
    </div>
  )
}
