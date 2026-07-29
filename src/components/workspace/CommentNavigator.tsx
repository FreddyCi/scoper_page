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

export function CommentNavigator({
  entries,
  activeIndex,
  loading = false,
  onIndexChange,
  className,
}: CommentNavigatorProps) {
  if (loading) {
    return (
      <span className={cn('text-muted-foreground text-xs', className)}>Loading review notes…</span>
    )
  }

  if (entries.length === 0) return null

  const safeIndex = Math.min(Math.max(activeIndex, 0), entries.length - 1)
  const current = entries[safeIndex]
  if (!current) return null

  const countLabel = `${safeIndex + 1} / ${entries.length}`
  const pageLabel =
    current.block.page_num != null ? `Page ${current.block.page_num}` : null

  function goTo(index: number) {
    onIndexChange(Math.min(Math.max(index, 0), entries.length - 1))
  }

  return (
    <div
      className={cn(
        'border-amber-200/70 bg-amber-50/80 inline-flex min-w-0 items-center gap-1 rounded-full border px-1 py-0.5',
        className,
      )}
      aria-label="Review note navigation"
    >
      <span className="text-amber-900 inline-flex items-center gap-1 px-1.5 text-[11px] font-medium">
        <MessageSquareIcon className="size-3 shrink-0" />
        Review notes
      </span>

      <span className="bg-amber-200/60 h-4 w-px shrink-0" aria-hidden />

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Previous review note"
        disabled={safeIndex <= 0}
        className="size-6 rounded-full"
        onClick={() => goTo(safeIndex - 1)}
      >
        <ChevronLeftIcon className="size-3.5" />
      </Button>

      <span className="text-amber-950 min-w-[2.75rem] text-center text-[11px] font-semibold tabular-nums">
        {countLabel}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Next review note"
        disabled={safeIndex >= entries.length - 1}
        className="size-6 rounded-full"
        onClick={() => goTo(safeIndex + 1)}
      >
        <ChevronRightIcon className="size-3.5" />
      </Button>

      {pageLabel ? (
        <>
          <span className="bg-amber-200/60 h-4 w-px shrink-0" aria-hidden />
          <span className="text-amber-900/80 hidden px-1 text-[11px] sm:inline">{pageLabel}</span>
        </>
      ) : null}
    </div>
  )
}
