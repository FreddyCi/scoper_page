import { useEffect, useMemo, useRef, useState } from 'react'
import { SparklesIcon } from 'lucide-react'
import { Streamdown } from 'streamdown'

import { EnhancePassagePanel } from '@/components/workspace/EnhancePassagePanel'
import { MarkdownDocumentViewer } from '@/components/workspace/MarkdownDocumentViewer'
import { useDocumentBlocks } from '@/hooks/use-document-blocks'
import { useCommentedBlockIds } from '@/hooks/use-block-comments'
import { blockToCitation } from '@/lib/types'
import type { BlockRecord, DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import { groupBlocksForMarkdownRead, commonSectionPathPrefix, compactSectionPathLabel } from '@/services/document-blocks'
import { focusCitation } from '@/services/citation-bridge'
import { useSessionStore } from '@/store/session-store'

type AnnotatedMarkdownViewProps = {
  document: DocumentMeta
  className?: string
  pendingCommentFocus?: { commentId: string; blockId: string } | null
  onPendingCommentFocusHandled?: () => void
}

function SectionHeading({ label }: { label: string }) {
  const trimmed = label.trim()
  if (
    trimmed === 'Document' ||
    trimmed === 'Unpaged' ||
    /^page \d+$/i.test(trimmed)
  ) {
    return null
  }

  return (
    <h2 className="text-violet-950 border-violet-200/70 scroll-mt-4 border-b pb-1 text-base font-semibold tracking-tight">
      {label}
    </h2>
  )
}

function AnnotatedParagraph({
  block,
  selected,
  hasEnhancement,
  focusSeq,
  onSelect,
  onEnhanceClick,
}: {
  block: BlockRecord
  selected: boolean
  hasEnhancement: boolean
  focusSeq: number
  onSelect: () => void
  onEnhanceClick: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selected, focusSeq, block.block_id])

  return (
    <div
      ref={rowRef}
      className={cn(
        'group/paragraph relative rounded-xl px-3 py-2.5 transition-colors',
        selected && 'bg-violet-50 ring-1 ring-violet-300',
        hasEnhancement && !selected && 'border-violet-300/80 bg-violet-50/40 border-l-2',
        selected && hasEnhancement && 'border-violet-400 bg-violet-50 ring-2 ring-violet-300',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
          aria-current={selected ? 'true' : undefined}
        >
          {(selected || hasEnhancement) && (
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              {selected ? (
                <span className="bg-violet-100 text-violet-900 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Selected
                </span>
              ) : null}
              {hasEnhancement ? (
                <span className="bg-violet-100 text-violet-900 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  <SparklesIcon className="size-3" />
                  Enhanced
                </span>
              ) : null}
            </div>
          )}
          <Streamdown
            mode="static"
            className="text-foreground prose-sm max-w-none text-sm leading-relaxed [&_p:last-child]:mb-0 [&_p]:my-0"
          >
            {block.text}
          </Streamdown>
        </button>
        <button
          type="button"
          aria-label={
            hasEnhancement ? 'View passage enhancement' : 'Enhance this passage'
          }
          className={cn(
            'text-muted-foreground mt-0.5 shrink-0 rounded-full p-1.5 transition-colors',
            'opacity-0 group-hover/paragraph:opacity-100 focus:opacity-100',
            'hover:bg-violet-50 hover:text-violet-800',
            hasEnhancement && 'text-violet-700 opacity-100',
          )}
          onClick={onEnhanceClick}
        >
          <SparklesIcon className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

/** Markdown context reader — annotated paragraphs with enhancements and citations. */
export function AnnotatedMarkdownView({
  document,
  className,
  pendingCommentFocus = null,
  onPendingCommentFocusHandled,
}: AnnotatedMarkdownViewProps) {
  const [enhanceOpen, setEnhanceOpen] = useState(false)
  const { blocks, loading, error } = useDocumentBlocks(document.doc_id)
  const { blockIds: enhancedBlockIds, refresh: refreshEnhancedBlockIds } =
    useCommentedBlockIds(document.doc_id)
  const selectedCitation = useSessionStore((state) => state.selectedCitation)
  const citationFocusSeq = useSessionStore((state) => state.citationFocusSeq)

  const sectionGroups = useMemo(() => groupBlocksForMarkdownRead(blocks), [blocks])
  const sectionPathPrefix = useMemo(
    () => commonSectionPathPrefix(sectionGroups.map((group) => group.label)),
    [sectionGroups],
  )
  const activeBlockId =
    selectedCitation?.doc_id === document.doc_id ? selectedCitation.block_id : null
  const activeBlock = blocks.find((block) => block.block_id === activeBlockId) ?? null

  useEffect(() => {
    if (!pendingCommentFocus) return

    const block = blocks.find((entry) => entry.block_id === pendingCommentFocus.blockId)
    if (!block) return

    focusCitation(blockToCitation(block))
    setEnhanceOpen(true)
    onPendingCommentFocusHandled?.()
  }, [blocks, onPendingCommentFocusHandled, pendingCommentFocus])

  function openEnhanceForBlock(block: BlockRecord) {
    focusCitation(blockToCitation(block))
    setEnhanceOpen(true)
  }

  if (!loading && !error && blocks.length === 0) {
    return <MarkdownDocumentViewer document={document} className={className} />
  }

  return (
    <section
      className={cn(
        'border-border bg-surface relative flex min-h-0 flex-1 flex-col overflow-hidden',
        className,
      )}
    >
      <header className="border-border/70 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-foreground truncate text-sm font-semibold">{document.filename}</h2>
          <p className="text-violet-800 text-xs">
            Context document · click a passage to cite or enhance
          </p>
        </div>
        <span className="border-violet-200/70 bg-violet-50/80 text-violet-950 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium">
          Markdown
        </span>
      </header>

      <EnhancePassagePanel
        block={activeBlock}
        open={enhanceOpen}
        onOpenChange={setEnhanceOpen}
        onRecorded={() => {
          void refreshEnhancedBlockIds()
          window.dispatchEvent(
            new CustomEvent('scoper:comments-imported', {
              detail: { docId: document.doc_id },
            }),
          )
        }}
      />

      <div className="bg-workspace min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {loading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Loading document…</p>
        ) : null}

        {error ? (
          <p className="text-destructive py-8 text-center text-sm">{error.message}</p>
        ) : null}

        {!loading && !error && sectionGroups.length > 0 ? (
          <article className="mx-auto max-w-3xl space-y-6">
            {sectionGroups.map((group) => (
              <section key={group.label} className="space-y-3">
                <SectionHeading
                  label={compactSectionPathLabel(group.label, sectionPathPrefix)}
                />
                <div className="space-y-2">
                  {group.blocks.map((block) => (
                    <AnnotatedParagraph
                      key={block.block_id}
                      block={block}
                      selected={activeBlockId === block.block_id}
                      hasEnhancement={enhancedBlockIds.has(block.block_id)}
                      focusSeq={citationFocusSeq}
                      onSelect={() => focusCitation(blockToCitation(block))}
                      onEnhanceClick={() => openEnhanceForBlock(block)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </article>
        ) : null}
      </div>
    </section>
  )
}
