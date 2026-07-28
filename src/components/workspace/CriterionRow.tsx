import { AlertTriangleIcon, CheckCircle2Icon, CircleIcon, XCircleIcon } from 'lucide-react'

import type { CitationRef, CriterionResult, CriterionStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'

const STATUS_ICON: Record<CriterionStatus, typeof CheckCircle2Icon> = {
  pass: CheckCircle2Icon,
  warn: AlertTriangleIcon,
  fail: XCircleIcon,
}

const STATUS_CLASS: Record<CriterionStatus, string> = {
  pass: 'text-emerald-600',
  warn: 'text-amber-600',
  fail: 'text-rose-600',
}

type CriterionRowProps = {
  criterion: CriterionResult
  onCriterionClick?: (citation: CitationRef) => void
  className?: string
}

export function CriterionRow({ criterion, onCriterionClick, className }: CriterionRowProps) {
  const clickable = Boolean(criterion.citation)
  const StatusIcon = STATUS_ICON[criterion.status] ?? CircleIcon

  function handleClick() {
    if (!criterion.citation) return
    if (onCriterionClick) {
      onCriterionClick(criterion.citation)
      return
    }
    focusCitation(criterion.citation)
  }

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={handleClick}
      className={cn(
        'border-border/70 flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
        clickable
          ? 'hover:bg-muted/60 cursor-pointer'
          : 'cursor-default opacity-80',
        className,
      )}
    >
      <StatusIcon className={cn('mt-0.5 size-4 shrink-0', STATUS_CLASS[criterion.status])} />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-sm font-medium">{criterion.label}</span>
        {criterion.detail ? (
          <span className="text-muted-foreground mt-0.5 block text-xs">{criterion.detail}</span>
        ) : null}
      </span>
    </button>
  )
}
