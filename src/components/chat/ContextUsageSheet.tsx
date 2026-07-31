import { useEffect, useMemo, useRef, useState } from 'react'
import { GaugeIcon } from 'lucide-react'

import {
  computeContextUsage,
  formatApproxTokenCount,
  formatContextUsagePercent,
  formatContextWindowScale,
  type ContextUsageResult,
  type ContextUsageSegmentKind,
} from '@/lib/context-usage'
import { getPageContextConfig } from '@/lib/page-context-manager'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

const SEGMENT_BAR_CLASS: Record<ContextUsageSegmentKind, string> = {
  system: 'bg-slate-500',
  ecp_tool: 'bg-violet-500',
  rfp_label: 'bg-sky-500',
  handoff: 'bg-amber-500',
  active_turn: 'bg-emerald-600',
  reserved: 'bg-muted-foreground/25',
}

type ContextUsageBreakdownProps = {
  usage: ContextUsageResult
  /** When false, accountable fill is shown as empty until snapshot arrives (BDA-171). */
  hasLiveSnapshot: boolean
  className?: string
}

/** Read-only segmented breakdown panel (sheet / popover body). */
export function ContextUsageBreakdown({
  usage,
  hasLiveSnapshot,
  className,
}: ContextUsageBreakdownProps) {
  const windowLabel = formatContextWindowScale(usage.contextSize)
  const accountableTokens = hasLiveSnapshot ? usage.totalTokens : 0
  const percentLabel = hasLiveSnapshot
    ? formatContextUsagePercent(usage.percentFull)
    : '~0%'

  const barSegments = useMemo(() => {
    if (!hasLiveSnapshot) {
      return [{ kind: 'reserved' as const, flex: 1 }]
    }
    const total = usage.contextSize
    if (total <= 0) return []
    return usage.segments
      .filter((segment) => segment.tokens > 0)
      .map((segment) => ({
        kind: segment.kind,
        flex: segment.tokens / total,
        label: segment.label,
        tokens: segment.tokens,
      }))
  }, [hasLiveSnapshot, usage.contextSize, usage.segments])

  const legendSegments = hasLiveSnapshot
    ? usage.segments.filter(
        (segment) => segment.kind !== 'reserved' && segment.tokens > 0,
      )
    : []

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="space-y-0.5">
        <p className="text-foreground text-sm font-medium">Context Usage</p>
        <p className="text-muted-foreground text-xs">
          {windowLabel} context window · estimates use ~4 chars per token
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-foreground text-lg font-semibold tabular-nums">
            {percentLabel}{' '}
            <span className="text-muted-foreground text-sm font-normal">Full</span>
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatApproxTokenCount(accountableTokens)} /{' '}
            {formatApproxTokenCount(usage.contextSize)} Tokens
          </span>
        </div>

        <div
          className="bg-muted flex h-2 w-full overflow-hidden rounded-full"
          role="img"
          aria-label={`Context window ${percentLabel} full`}
        >
          {barSegments.map((segment, index) => (
            <div
              key={`${segment.kind}-${index}`}
              className={cn('h-full min-w-0 transition-[flex-grow]', SEGMENT_BAR_CLASS[segment.kind])}
              style={{ flexGrow: segment.flex, flexBasis: 0 }}
              title={'label' in segment ? segment.label : undefined}
            />
          ))}
        </div>
      </div>

      {legendSegments.length > 0 ? (
        <ul className="space-y-1.5">
          {legendSegments.map((segment) => (
            <li
              key={segment.kind}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="text-foreground flex min-w-0 items-center gap-2">
                <span
                  className={cn('size-2 shrink-0 rounded-sm', SEGMENT_BAR_CLASS[segment.kind])}
                  aria-hidden
                />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {formatApproxTokenCount(segment.tokens)}
              </span>
            </li>
          ))}
          {usage.segments.find((segment) => segment.kind === 'reserved') ? (
            <li className="text-muted-foreground flex items-center justify-between gap-2 border-t border-dashed pt-1.5 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn('size-2 shrink-0 rounded-sm', SEGMENT_BAR_CLASS.reserved)}
                  aria-hidden
                />
                <span className="truncate">Reserved for generation</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatApproxTokenCount(
                  usage.segments.find((segment) => segment.kind === 'reserved')?.tokens ?? 0,
                )}
              </span>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">
          Usage breakdown appears after the agent records context segments.
        </p>
      )}
    </div>
  )
}

type ContextUsageComposerChipProps = {
  className?: string
}

/**
 * Footer chip + popover for live KV usage during chat or proposal runs (BDA-171).
 */
export function ContextUsageComposerChip({ className }: ContextUsageComposerChipProps) {
  const chatGenerating = useSessionStore((s) => s.chatGenerating)
  const proposalGenerating = useSessionStore((s) => s.proposalGenerating)
  const contextPhase = useSessionStore((s) => s.contextPhase)
  const snapshot = useSessionStore((s) => s.contextUsageSnapshot)

  const visible =
    chatGenerating || proposalGenerating || contextPhase !== 'idle'

  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const usage = useMemo(() => {
    if (snapshot) return snapshot
    return computeContextUsage({ segments: {} }, { config: getPageContextConfig() })
  }, [snapshot])

  const chipPercent = snapshot
    ? formatContextUsagePercent(snapshot.percentFull)
    : '~0%'

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        panelRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
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

  if (!visible) return null

  return (
    <div className={cn('relative', className)}>
      {open ? (
        <div
          ref={panelRef}
          className="border-border bg-surface shadow-elevated absolute bottom-full left-0 z-30 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border p-3"
          role="dialog"
          aria-label="Context usage breakdown"
        >
          <ContextUsageBreakdown usage={usage} hasLiveSnapshot={snapshot != null} />
        </div>
      ) : null}

      <button
        ref={anchorRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'border-border/80 bg-surface text-foreground inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors',
          open ? 'ring-ring ring-2 ring-offset-1' : 'hover:bg-muted/60',
        )}
      >
        <GaugeIcon className="size-3 opacity-80" aria-hidden />
        <span className="tabular-nums">{chipPercent}</span>
        <span className="text-muted-foreground hidden min-[380px]:inline">Context</span>
      </button>
    </div>
  )
}

/** Alias for plan doc name — same as composer chip + breakdown popover. */
export const ContextUsageSheet = ContextUsageComposerChip
