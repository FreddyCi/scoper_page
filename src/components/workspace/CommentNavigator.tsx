import { ChevronLeftIcon, ChevronRightIcon, MessageSquareIcon, SparklesIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { DocumentCommentEntry } from '@/services/block-comments'
import { cn } from '@/lib/utils'

type CommentNavigatorProps = {
  entries: DocumentCommentEntry[]
  activeIndex: number
  loading?: boolean
  onIndexChange: (index: number) => void
  className?: string
  variant?: 'review' | 'enhance'
}

export function CommentNavigator({
  entries,
  activeIndex,
  loading = false,
  onIndexChange,
  className,
  variant = 'review',
}: CommentNavigatorProps) {
  const isEnhance = variant === 'enhance'

  if (loading) {
    return (
      <span className={cn('text-muted-foreground text-xs', className)}>
        {isEnhance ? 'Loading enhancements…' : 'Loading review notes…'}
      </span>
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
        'inline-flex min-w-0 items-center gap-1 rounded-full border px-1 py-0.5',
        isEnhance
          ? 'border-violet-200/70 bg-violet-50/80'
          : 'border-amber-200/70 bg-amber-50/80',
        className,
      )}
      aria-label={isEnhance ? 'Enhancement navigation' : 'Review note navigation'}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 text-[11px] font-medium',
          isEnhance ? 'text-violet-900' : 'text-amber-900',
        )}
      >
        {isEnhance ? (
          <SparklesIcon className="size-3 shrink-0" />
        ) : (
          <MessageSquareIcon className="size-3 shrink-0" />
        )}
        {isEnhance ? 'Enhancements' : 'Review notes'}
      </span>

      <span
        className={cn('h-4 w-px shrink-0', isEnhance ? 'bg-violet-200/60' : 'bg-amber-200/60')}
        aria-hidden
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={isEnhance ? 'Previous enhancement' : 'Previous review note'}
        disabled={safeIndex <= 0}
        className="size-6 rounded-full"
        onClick={() => goTo(safeIndex - 1)}
      >
        <ChevronLeftIcon className="size-3.5" />
      </Button>

      <span
        className={cn(
          'min-w-[2.75rem] text-center text-[11px] font-semibold tabular-nums',
          isEnhance ? 'text-violet-950' : 'text-amber-950',
        )}
      >
        {countLabel}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={isEnhance ? 'Next enhancement' : 'Next review note'}
        disabled={safeIndex >= entries.length - 1}
        className="size-6 rounded-full"
        onClick={() => goTo(safeIndex + 1)}
      >
        <ChevronRightIcon className="size-3.5" />
      </Button>

      {pageLabel ? (
        <>
          <span
            className={cn('h-4 w-px shrink-0', isEnhance ? 'bg-violet-200/60' : 'bg-amber-200/60')}
            aria-hidden
          />
          <span
            className={cn(
              'hidden px-1 text-[11px] sm:inline',
              isEnhance ? 'text-violet-900/80' : 'text-amber-900/80',
            )}
          >
            {pageLabel}
          </span>
        </>
      ) : null}
    </div>
  )
}
