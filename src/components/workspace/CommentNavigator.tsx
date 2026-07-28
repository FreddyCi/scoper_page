import { ChevronLeftIcon, ChevronRightIcon, MessageSquareIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { DocumentCommentEntry } from '@/services/block-comments'
import { cn } from '@/lib/utils'

type CommentNavigatorProps = {
  entries: DocumentCommentEntry[]
  activeIndex: number
  loading?: boolean
  onIndexChange: (index: number) => void
  className?: string
}

function shortenCommentId(commentId: string): string {
  const trimmed = commentId.replace(/^comment-/, '')
  return trimmed.length > 10 ? `${trimmed.slice(0, 8)}…` : trimmed
}

export function CommentNavigator({
  entries,
  activeIndex,
  loading = false,
  onIndexChange,
  className,
}: CommentNavigatorProps) {
  if (loading) {
    return (
      <div
        className={cn('text-muted-foreground flex items-center gap-2 text-xs', className)}
      >
        Loading review notes…
      </div>
    )
  }

  if (entries.length === 0) return null

  const safeIndex = Math.min(Math.max(activeIndex, 0), entries.length - 1)
  const current = entries[safeIndex]
  if (!current) return null

  const countLabel = `${safeIndex + 1} / ${entries.length}`

  function goTo(index: number) {
    const next = Math.min(Math.max(index, 0), entries.length - 1)
    onIndexChange(next)
  }

  return (
    <div
      className={cn(
        'border-amber-200/80 bg-amber-50/70 flex min-w-0 items-center gap-1 rounded-lg border px-1 py-0.5',
        className,
      )}
      aria-label="Review note navigation"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Previous review note"
        disabled={safeIndex <= 0}
        onClick={() => goTo(safeIndex - 1)}
      >
        <ChevronLeftIcon className="size-4" />
      </Button>

      <div className="min-w-0 px-1 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <MessageSquareIcon className="text-amber-700 size-3.5 shrink-0" />
          <span className="text-amber-950 text-xs font-semibold tabular-nums">{countLabel}</span>
        </div>
        <p
          className="text-amber-900/75 max-w-[12rem] truncate font-mono text-[10px]"
          title={current.comment.comment_id}
        >
          {shortenCommentId(current.comment.comment_id)}
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Next review note"
        disabled={safeIndex >= entries.length - 1}
        onClick={() => goTo(safeIndex + 1)}
      >
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  )
}
