import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquareIcon, MessageSquarePlusIcon } from 'lucide-react'

import { BlockCommentPopover } from '@/components/workspace/CommentPopover'
import { useDocumentBlocks } from '@/hooks/use-document-blocks'
import { useCommentedBlockIds } from '@/hooks/use-block-comments'
import { blockToCitation } from '@/lib/types'
import { groupBlocksForDisplay } from '@/services/document-blocks'
import { focusCitation } from '@/services/citation-bridge'
import type { BlockRecord } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type ExtractedTextPaneProps = {
  docId: string
  className?: string
}

function isPageGroupLabel(label: string): boolean {
  return /^page \d+$/i.test(label.trim())
}

function BlockGroupLabel({ label }: { label: string }) {
  const isPage = isPageGroupLabel(label)

  return (
    <h3
      className={cn(
        'sticky top-0 z-10 text-xs font-semibold tracking-wide uppercase',
        isPage
          ? 'border-sky-100/80 bg-sky-50/90 text-sky-800/80 mb-1 rounded-md border px-2.5 py-1'
          : 'text-muted-foreground bg-surface/95 supports-[backdrop-filter]:bg-surface/80 px-1 py-1 backdrop-blur-sm',
      )}
    >
      {label}
    </h3>
  )
}

function BlockRow({
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
        'border-border hover:bg-muted/60 relative w-full rounded-lg border transition-colors',
        selected && 'border-sky-400 bg-sky-50 ring-1 ring-sky-300',
        hasComment && !selected && 'border-amber-300/80 bg-amber-50/40',
        selected && hasComment && 'border-amber-400 ring-amber-300/80 bg-sky-50 ring-2',
      )}
    >
      <div className="flex items-start gap-1 px-3 py-2">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {selected ? (
              <span className="bg-sky-100 text-sky-800 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                Highlighted
              </span>
            ) : null}
            {hasComment ? (
              <span className="bg-amber-100 text-amber-900 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                <MessageSquareIcon className="size-3" />
                Review note
              </span>
            ) : null}
          </div>
          <p className="text-foreground text-sm leading-relaxed">{block.text}</p>
          {block.section_path ? (
            <p className="text-muted-foreground mt-1 truncate text-xs">{block.section_path}</p>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={hasComment ? 'View block comment' : 'Add block comment'}
          className="text-muted-foreground hover:text-foreground hover:bg-muted mt-0.5 shrink-0 rounded-md p-1 transition-colors"
          onClick={onCommentClick}
        >
          {hasComment ? (
            <MessageSquareIcon className="size-3.5 text-amber-600" />
          ) : (
            <MessageSquarePlusIcon className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

export function ExtractedTextPane({ docId, className }: ExtractedTextPaneProps) {
  const [commentOpen, setCommentOpen] = useState(false)
  const { blocks, loading, error } = useDocumentBlocks(docId)
  const { blockIds: commentedBlockIds, refresh: refreshCommentedBlockIds } =
    useCommentedBlockIds(docId)
  const selectedCitation = useSessionStore((state) => state.selectedCitation)
  const citationFocusSeq = useSessionStore((state) => state.citationFocusSeq)

  const pageGroups = useMemo(() => groupBlocksForDisplay(blocks), [blocks])
  const activeBlockId =
    selectedCitation?.doc_id === docId ? selectedCitation.block_id : null
  const activeBlock = blocks.find((block) => block.block_id === activeBlockId) ?? null

  function openCommentForBlock(block: BlockRecord) {
    focusCitation(blockToCitation(block))
    setCommentOpen(true)
  }

  return (
    <section
      className={cn(
        'border-border bg-surface relative flex min-h-0 flex-col overflow-hidden rounded-panel border',
        className,
      )}
    >
      <BlockCommentPopover
        block={activeBlock}
        open={commentOpen}
        onOpenChange={setCommentOpen}
        onCommentAdded={() => {
          void refreshCommentedBlockIds()
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Loading extracted text…</p>
        ) : null}

        {error ? (
          <p className="text-destructive py-8 text-center text-sm">{error.message}</p>
        ) : null}

        {!loading && !error && blocks.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No extracted blocks yet. Upload and parse a document to populate this pane.
          </p>
        ) : null}

        {!loading && !error && pageGroups.length > 0 ? (
          <div className="space-y-4">
            {pageGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <BlockGroupLabel label={group.label} />
                <div className="space-y-2">
                  {group.blocks.map((block) => (
                    <BlockRow
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
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
