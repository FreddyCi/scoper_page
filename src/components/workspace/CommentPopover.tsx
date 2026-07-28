import { useState } from 'react'
import { MessageSquareIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useBlockComments } from '@/hooks/use-block-comments'
import type { BlockRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

type CommentPopoverProps = {
  block: BlockRecord
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

/** Add and list review notes for the selected extract block (BDA-082) */
export function CommentPopover({ block, onCommentAdded, className }: CommentPopoverProps) {
  const [draft, setDraft] = useState('')
  const { comments, loading, saving, error, addComment } = useBlockComments(block.block_id)

  async function handleSubmit() {
    const trimmed = draft.trim()
    if (!trimmed || saving) return

    const saved = await addComment(trimmed)
    if (!saved) return

    setDraft('')
    onCommentAdded?.()
  }

  return (
    <section
      className={cn(
        'border-border bg-muted/20 flex shrink-0 flex-col gap-3 border-t px-3 py-3',
        className,
      )}
      aria-label="Block comments"
    >
      <div className="flex items-start gap-2">
        <MessageSquareIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-sm font-semibold">Block comment</h3>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
            {block.text}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-xs">Loading comments…</p>
      ) : null}

      {!loading && comments.length > 0 ? (
        <ul className="max-h-32 space-y-2 overflow-y-auto">
          {comments.map((comment) => (
            <li
              key={comment.comment_id}
              className="border-border bg-surface rounded-lg border px-3 py-2 text-sm"
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
    </section>
  )
}
