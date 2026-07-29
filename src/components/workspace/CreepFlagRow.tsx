import {
  AlertTriangleIcon,
  ChevronRightIcon,
  CircleIcon,
  FlagIcon,
  InfoIcon,
} from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

import type { CitationRef, ScopeCreepFlag, ScopeCreepSeverity } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'

const SEVERITY_ICON: Record<ScopeCreepSeverity, typeof FlagIcon> = {
  high: AlertTriangleIcon,
  medium: FlagIcon,
  low: InfoIcon,
}

const SEVERITY_CLASS: Record<ScopeCreepSeverity, string> = {
  high: 'text-rose-600',
  medium: 'text-amber-600',
  low: 'text-sky-600',
}

const SEVERITY_BADGE_CLASS: Record<ScopeCreepSeverity, string> = {
  high: 'bg-rose-50 text-rose-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-sky-50 text-sky-700',
}

const DEFAULT_SUMMARY_MAX_CHARS = 120

function formatFlagType(flagType: string): string {
  return flagType.replace(/_/g, ' ')
}

function ExpandableSummary({
  text,
  maxChars,
  className,
}: {
  text: string
  maxChars: number
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncate = text.length > maxChars
  const display =
    expanded || !needsTruncate ? text : `${text.slice(0, maxChars).trimEnd()}…`

  return (
    <span className={cn('text-foreground font-medium', className)}>
      {display}
      {needsTruncate ? (
        <button
          type="button"
          className="text-sky-600 hover:text-sky-700 ml-1 inline text-xs font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((value) => !value)
          }}
        >
          {expanded ? 'Less' : 'More'}
        </button>
      ) : null}
    </span>
  )
}

type CreepFlagRowProps = {
  flag: ScopeCreepFlag
  onFlagClick?: (citation: CitationRef) => void
  className?: string
  /** Truncate summary with a More/Less toggle (sidebar history) */
  summaryMaxChars?: number
  summaryClassName?: string
}

export function CreepFlagRow({
  flag,
  onFlagClick,
  className,
  summaryMaxChars,
  summaryClassName,
}: CreepFlagRowProps) {
  const citation = flag.evidence[0]
  const clickable = Boolean(citation)
  const SeverityIcon = SEVERITY_ICON[flag.severity] ?? CircleIcon

  function handleClick() {
    if (!citation) return
    if (onFlagClick) {
      onFlagClick(citation)
      return
    }
    focusCitation(citation)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!clickable) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleClick()
    }
  }

  const summaryClass = summaryClassName ?? 'text-sm leading-snug'

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={
        clickable
          ? `View evidence for ${flag.summary}`
          : `${flag.summary} — no linked evidence`
      }
      onClick={clickable ? handleClick : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
        'border-border/70 bg-workspace-muted/50',
        clickable
          ? 'hover:border-sky-300 hover:bg-sky-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
          : 'cursor-default opacity-90',
        className,
      )}
    >
      <SeverityIcon className={cn('mt-0.5 size-4 shrink-0', SEVERITY_CLASS[flag.severity])} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {summaryMaxChars != null ? (
            <ExpandableSummary
              text={flag.summary}
              maxChars={summaryMaxChars}
              className={summaryClass}
            />
          ) : (
            <span className={cn('text-foreground font-medium', summaryClass)}>{flag.summary}</span>
          )}
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
              SEVERITY_BADGE_CLASS[flag.severity],
            )}
          >
            {flag.severity}
          </span>
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs capitalize leading-relaxed">
          {formatFlagType(flag.flag_type)}
        </span>
      </span>
      {clickable ? (
        <ChevronRightIcon className="text-muted-foreground mt-0.5 size-4 shrink-0 group-hover:text-sky-600" />
      ) : null}
    </div>
  )
}

export { DEFAULT_SUMMARY_MAX_CHARS, SEVERITY_BADGE_CLASS }
