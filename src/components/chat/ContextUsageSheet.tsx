import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from 'lucide-react'

import {
  computeContextUsage,
  formatApproxTokenCount,
  formatContextUsagePercent,
  formatContextWindowScale,
  type ContextUsageResult,
  type ContextUsageSegmentKind,
} from '@/lib/context-usage'
import { getPageContextConfig } from '@/lib/page-context-manager'
import {
  overlayChromeGhostButtonClass,
  overlayPanelClass,
  overlaySectionTitleClass,
} from '@/lib/overlay-chrome'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const SEGMENT_BAR_CLASS: Record<ContextUsageSegmentKind, string> = {
  system: 'bg-slate-500',
  ecp_tool: 'bg-violet-500',
  rfp_label: 'bg-sky-500',
  handoff: 'bg-amber-500',
  active_turn: 'bg-emerald-600',
  reserved: 'bg-muted-foreground/25',
}

type ContextUsageRingProps = {
  percentFull: number
  className?: string
  /** Accessible label for the ring button. */
  'aria-label'?: string
}

/** Circular KV fill indicator (Cursor-style composer ring). */
export function ContextUsageRing({
  percentFull,
  className,
  'aria-label': ariaLabel,
}: ContextUsageRingProps) {
  const size = 16
  const stroke = 2
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, percentFull))
  const offset = circumference * (1 - clamped / 100)

  const progressClass =
    clamped >= 85
      ? 'text-destructive'
      : clamped >= 55
        ? 'text-amber-600'
        : 'text-foreground'

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={ariaLabel ?? `Context ${Math.round(clamped)} percent full`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className="text-muted-foreground/30"
        stroke="currentColor"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={cn('transition-[stroke-dashoffset] duration-300', progressClass)}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

type ContextUsageBreakdownProps = {
  usage: ContextUsageResult
  hasLiveSnapshot: boolean
  className?: string
  /** Hide title block when the popover shell already shows a header. */
  showTitle?: boolean
}

/** Read-only segmented breakdown panel (sheet / popover body). */
export function ContextUsageBreakdown({
  usage,
  hasLiveSnapshot,
  className,
  showTitle = true,
}: ContextUsageBreakdownProps) {
  const windowLabel = formatContextWindowScale(usage.contextSize)
  const accountableTokens = hasLiveSnapshot ? usage.totalTokens : 0
  const percentLabel = hasLiveSnapshot
    ? formatContextUsagePercent(usage.percentFull)
    : '~0%'
  const displayPercent = hasLiveSnapshot
    ? `${Math.round(usage.percentFull)}%`
    : '0%'

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
      {showTitle ? (
        <div className="space-y-0.5">
          <p className="text-foreground text-sm font-medium">Context Usage</p>
          <p className="text-muted-foreground text-xs">
            {windowLabel} context window · estimates use ~4 chars per token
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          {windowLabel} window · ~4 chars per token
        </p>
      )}

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-foreground text-lg font-semibold tabular-nums">
            {displayPercent}{' '}
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

type ContextUsagePopoverPosition = {
  top: number
  left: number
  width: number
}

const CONTEXT_USAGE_POPOVER_WIDTH = 320

function useContextUsagePopoverPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
): ContextUsagePopoverPosition | null {
  const [position, setPosition] = useState<ContextUsagePopoverPosition | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null)
      return
    }

    function update() {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const width = Math.min(CONTEXT_USAGE_POPOVER_WIDTH, window.innerWidth - 16)
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
      const top = rect.top - 8

      setPosition({ top, left, width })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorRef, open])

  return position
}

type ContextUsageComposerClusterProps = {
  children?: ReactNode
  className?: string
}

/**
 * Context ring immediately left of paperclip; popover anchors above this cluster (Cursor-style).
 */
export function ContextUsageComposerCluster({
  children,
  className,
}: ContextUsageComposerClusterProps) {
  const chatGenerating = useSessionStore((s) => s.chatGenerating)
  const proposalGenerating = useSessionStore((s) => s.proposalGenerating)
  const contextPhase = useSessionStore((s) => s.contextPhase)
  const snapshot = useSessionStore((s) => s.contextUsageSnapshot)

  const [open, setOpen] = useState(false)
  const clusterRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const popoverPosition = useContextUsagePopoverPosition(open, clusterRef)

  const usage = useMemo(() => {
    if (snapshot) return snapshot
    return computeContextUsage({ segments: {} }, { config: getPageContextConfig() })
  }, [snapshot])

  const ringPercent = snapshot?.percentFull ?? 0
  const hasLiveSnapshot = snapshot != null

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        panelRef.current?.contains(target) ||
        clusterRef.current?.contains(target)
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

  const popover =
    open && popoverPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            className={cn('fixed z-[200] rounded-xl border p-3', overlayPanelClass)}
            style={{
              top: popoverPosition.top,
              left: popoverPosition.left,
              width: popoverPosition.width,
              transform: 'translateY(-100%)',
            }}
            role="dialog"
            aria-label="Context usage breakdown"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className={overlaySectionTitleClass}>Context Usage</p>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className={cn('-mr-1 -mt-0.5 shrink-0', overlayChromeGhostButtonClass)}
                aria-label="Close context usage"
                onClick={() => setOpen(false)}
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
            <ContextUsageBreakdown
              usage={usage}
              hasLiveSnapshot={hasLiveSnapshot}
              showTitle={false}
            />
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={clusterRef} className={cn('relative flex items-center gap-0', className)}>
      {popover}

      <Tooltip>
        <TooltipTrigger
          delay={0}
          render={
            <button
              ref={ringRef}
              type="button"
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => setOpen((current) => !current)}
              className={cn(
                'text-muted-foreground hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
                open && 'bg-muted text-foreground',
                (chatGenerating || proposalGenerating || contextPhase !== 'idle') &&
                  'text-foreground',
              )}
            >
              <ContextUsageRing percentFull={ringPercent} />
            </button>
          }
        />
        <TooltipContent side="top" sideOffset={6}>
          Show context usage
        </TooltipContent>
      </Tooltip>

      {children}
    </div>
  )
}

/** @deprecated Use {@link ContextUsageComposerCluster} beside the paperclip control. */
export function ContextUsageComposerChip({ className }: { className?: string }) {
  return (
    <ContextUsageComposerCluster className={className} />
  )
}

/** Alias for plan doc name — ring + popover beside attachments. */
export const ContextUsageSheet = ContextUsageComposerCluster
