import { useEffect, useRef, useState } from 'react'
import { MessageSquareIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useBlockComments } from '@/hooks/use-block-comments'
import type { BlockRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

type BlockCommentPopoverProps = {
  block: BlockRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCommentAdded?: () => void
  showTrigger?: boolean
  className?: string
}

const BLOCK_EXCERPT_WORD_LIMIT = 30

function truncateWords(text: string, maxWords: number): { excerpt: string; isTruncated: boolean } {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) {
    return { excerpt: text, isTruncated: false }
  }

  return {
    excerpt: `${words.slice(0, maxWords).join(' ')}…`,
    isTruncated: true,
  }
}

function BlockExcerpt({ text, blockId }: { text: string; blockId: string }) {
  const [expanded, setExpanded] = useState(false)
  const { excerpt, isTruncated } = truncateWords(text, BLOCK_EXCERPT_WORD_LIMIT)

  useEffect(() => {
    setExpanded(false)
  }, [blockId])

  return (
    <blockquote
      className={cn(
        'border-sky-400 bg-sky-50/70 text-foreground rounded-r-md border-l-4 px-3 py-2 text-xs leading-relaxed',
        expanded && isTruncated && 'scrollbar-thin max-h-32 overflow-y-auto',
      )}
    >
      <p>{expanded || !isTruncated ? text : excerpt}</p>
      {isTruncated ? (
        <button
          type="button"
          className="text-sky-800 hover:text-sky-950 mt-1 text-xs font-medium hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </blockquote>
  )
}

function formatCommentTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Header button + dropdown for review notes on the selected extract block (BDA-082) */
export function BlockCommentPopover({
  block,
  open,
  onOpenChange,
  onCommentAdded,
  showTrigger = false,
  className,
}: BlockCommentPopoverProps) {
  const [draft, setDraft] = useState('')
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const blockId = block?.block_id ?? null
  const { comments, loading, saving, error, addComment } = useBlockComments(blockId)

  useEffect(() => {
    if (!open) setDraft('')
  }, [blockId, open])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (showTrigger && anchorRef.current?.contains(target)) return
      onOpenChange(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange, showTrigger])

  async function handleSubmit() {
    const trimmed = draft.trim()
    if (!trimmed || saving || !block) return

    const saved = await addComment(trimmed)
    if (!saved) return

    setDraft('')
    onCommentAdded?.()
  }

  const commentCount = comments.length

  return (
    <div ref={anchorRef} className={cn(showTrigger ? 'relative shrink-0' : 'contents', className)}>
      {showTrigger ? (
        <Button
          type="button"
          variant={open ? 'secondary' : 'outline'}
          size="sm"
          disabled={!block}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={
            block
              ? commentCount > 0
                ? `Block comments (${commentCount})`
                : 'Add block comment'
              : 'Select a block to comment'
          }
          onClick={() => onOpenChange(!open)}
        >
          <MessageSquareIcon className="size-3.5" />
          Comment
          {commentCount > 0 ? (
            <span className="bg-amber-100 text-amber-800 ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {commentCount}
            </span>
          ) : null}
        </Button>
      ) : null}

      {open && block ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Block comments"
          className={cn(
            'border-border bg-surface shadow-elevated z-30 flex flex-col gap-3 rounded-lg border p-3',
            showTrigger
              ? 'absolute top-full right-0 mt-2 w-[min(20rem,calc(100vw-2rem))]'
              : 'absolute top-3 right-3 left-3',
          )}
        >
          <div className="min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="text-foreground text-sm font-semibold">Block comment</h3>
                {block.page_num != null ? (
                  <span className="bg-sky-100 text-sky-900 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    Page {block.page_num}
                  </span>
                ) : null}
                {commentCount > 0 ? (
                  <span className="bg-amber-100 text-amber-900 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    {commentCount} note{commentCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close comments"
                className="text-muted-foreground shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              This note is attached to the highlighted passage in the PDF preview.
            </p>
            <BlockExcerpt text={block.text} blockId={block.block_id} />
          </div>

          {loading ? (
            <p className="text-muted-foreground text-xs">Loading comments…</p>
          ) : null}

          {!loading && comments.length > 0 ? (
            <ul className="max-h-36 space-y-2 overflow-y-auto">
              {comments.map((comment) => (
                <li
                  key={comment.comment_id}
                  className="border-border bg-muted/30 rounded-lg border px-3 py-2 text-sm"
                >
                  <p className="text-foreground leading-relaxed">{comment.text}</p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {formatCommentTime(comment.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          {!loading && comments.length === 0 ? (
            <p className="text-muted-foreground text-xs">No comments yet on this block.</p>
          ) : null}

          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a review note for this block…"
              rows={3}
              className="border-border bg-surface text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={!draft.trim() || saving}
                onClick={() => void handleSubmit()}
              >
                {saving ? 'Saving…' : 'Add comment'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** @deprecated Use BlockCommentPopover */
export const CommentPopover = BlockCommentPopover
