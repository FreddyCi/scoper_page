import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquareIcon, MessageSquarePlusIcon } from 'lucide-react'
import { Streamdown } from 'streamdown'

import { BlockCommentPopover } from '@/components/workspace/CommentPopover'
import { MarkdownDocumentViewer } from '@/components/workspace/MarkdownDocumentViewer'
import { useDocumentBlocks } from '@/hooks/use-document-blocks'
import { useCommentedBlockIds } from '@/hooks/use-block-comments'
import { blockToCitation } from '@/lib/types'
import type { BlockRecord, DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import { groupBlocksForMarkdownRead } from '@/services/document-blocks'
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
  hasComment,
  focusSeq,
  onSelect,
  onCommentClick,
}: {
  block: BlockRecord
  selected: boolean
  hasComment: boolean
  focusSeq: number
  onSelect: () => void
  onCommentClick: () => void
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
        hasComment && !selected && 'border-amber-300/80 bg-amber-50/30 border-l-2',
        selected && hasComment && 'border-amber-400 bg-violet-50 ring-2 ring-violet-300',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
          aria-current={selected ? 'true' : undefined}
        >
          {(selected || hasComment) && (
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              {selected ? (
                <span className="bg-violet-100 text-violet-900 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Selected
                </span>
              ) : null}
              {hasComment ? (
                <span className="bg-amber-100 text-amber-900 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  <MessageSquareIcon className="size-3" />
                  Review note
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
          aria-label={hasComment ? 'View block comment' : 'Add block comment'}
          className={cn(
            'text-muted-foreground hover:text-foreground mt-0.5 shrink-0 rounded-full p-1.5 transition-colors',
            'opacity-0 group-hover/paragraph:opacity-100 focus:opacity-100',
            hasComment && 'text-amber-700 opacity-100',
          )}
          onClick={onCommentClick}
        >
          {hasComment ? (
            <MessageSquareIcon className="size-3.5" />
          ) : (
            <MessageSquarePlusIcon className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

/** Markdown context reader — annotated paragraphs with comments and citations. */
export function AnnotatedMarkdownView({
  document,
  className,
  pendingCommentFocus = null,
  onPendingCommentFocusHandled,
}: AnnotatedMarkdownViewProps) {
  const [commentOpen, setCommentOpen] = useState(false)
  const { blocks, loading, error } = useDocumentBlocks(document.doc_id)
  const { blockIds: commentedBlockIds, refresh: refreshCommentedBlockIds } =
    useCommentedBlockIds(document.doc_id)
  const selectedCitation = useSessionStore((state) => state.selectedCitation)
  const citationFocusSeq = useSessionStore((state) => state.citationFocusSeq)

  const sectionGroups = useMemo(() => groupBlocksForMarkdownRead(blocks), [blocks])
  const activeBlockId =
    selectedCitation?.doc_id === document.doc_id ? selectedCitation.block_id : null
  const activeBlock = blocks.find((block) => block.block_id === activeBlockId) ?? null

  useEffect(() => {
    if (!pendingCommentFocus) return

    const block = blocks.find((entry) => entry.block_id === pendingCommentFocus.blockId)
    if (!block) return

    focusCitation(blockToCitation(block))
    setCommentOpen(true)
    onPendingCommentFocusHandled?.()
  }, [blocks, onPendingCommentFocusHandled, pendingCommentFocus])

  function openCommentForBlock(block: BlockRecord) {
    focusCitation(blockToCitation(block))
    setCommentOpen(true)
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
          <p className="text-violet-800 text-xs">Context document · click a passage to cite or comment</p>
        </div>
        <span className="border-violet-200/70 bg-violet-50/80 text-violet-950 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium">
          Markdown
        </span>
      </header>

      <BlockCommentPopover
        block={activeBlock}
        open={commentOpen}
        onOpenChange={setCommentOpen}
        onCommentAdded={() => {
          void refreshCommentedBlockIds()
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
                <SectionHeading label={group.label} />
                <div className="space-y-2">
                  {group.blocks.map((block) => (
                    <AnnotatedParagraph
                      key={block.block_id}
                      block={block}
                      selected={activeBlockId === block.block_id}
                      hasComment={commentedBlockIds.has(block.block_id)}
                      focusSeq={citationFocusSeq}
                      onSelect={() => focusCitation(blockToCitation(block))}
                      onCommentClick={() => openCommentForBlock(block)}
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
