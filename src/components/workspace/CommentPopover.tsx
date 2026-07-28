import { useEffect, useRef, useState } from 'react'
import { MessageSquareIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useBlockComments } from '@/hooks/use-block-comments'
import type { BlockRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

type BlockCommentPopoverProps = {
  block: BlockRecord | null
  onCommentAdded?: () => void
  className?: string
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
export function BlockCommentPopover({ block, onCommentAdded, className }: BlockCommentPopoverProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const blockId = block?.block_id ?? null
  const { comments, loading, saving, error, addComment } = useBlockComments(blockId)

  useEffect(() => {
    setOpen(false)
    setDraft('')
  }, [blockId])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

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
    <div ref={anchorRef} className={cn('relative shrink-0', className)}>
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
        onClick={() => setOpen((current) => !current)}
      >
        <MessageSquareIcon className="size-3.5" />
        Comment
        {commentCount > 0 ? (
          <span className="bg-amber-100 text-amber-800 ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {commentCount}
          </span>
        ) : null}
      </Button>

      {open && block ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Block comments"
          className="border-border bg-surface shadow-elevated absolute top-full right-0 z-30 mt-2 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border p-3"
        >
          <div className="min-w-0">
            <h3 className="text-foreground text-sm font-semibold">Block comment</h3>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
              {block.text}
            </p>
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
