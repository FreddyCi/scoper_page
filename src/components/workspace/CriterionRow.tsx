import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleIcon,
  XCircleIcon,
} from 'lucide-react'

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
      aria-label={
        clickable
          ? `View source for ${criterion.label}`
          : `${criterion.label} — no linked source`
      }
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
        'border-border/70 bg-workspace-muted/50',
        clickable
          ? 'hover:border-sky-300 hover:bg-sky-50 cursor-pointer'
          : 'cursor-default opacity-90',
        className,
      )}
    >
      <StatusIcon className={cn('mt-0.5 size-4 shrink-0', STATUS_CLASS[criterion.status])} />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-sm font-medium">{criterion.label}</span>
        {criterion.detail ? (
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
            {criterion.detail}
          </span>
        ) : null}
      </span>
      {clickable ? (
        <ChevronRightIcon className="text-muted-foreground mt-0.5 size-4 shrink-0 group-hover:text-sky-600" />
      ) : null}
    </button>
  )
}
