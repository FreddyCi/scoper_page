import { useMemo } from 'react'

import { useScoutSpotlightTracking } from '@/components/scout/use-scout-spotlight-tracking'
import { ScoutWalkthroughArrow } from '@/components/scout/ScoutWalkthroughArrow'
import { getScoutJourney } from '@/lib/scout/journeys-map'
import { type BrandAccent } from '@/lib/brand-accent'
import { SCOUT_SPOTLIGHT_PAD } from '@/lib/scout/spotlight-geometry'
import type { ScoutTargetId } from '@/lib/scout/targets'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'
import {
  selectActiveScoutJourney,
  selectScoutPanelOpen,
  selectScoutStepIndex,
  useScoutStore,
} from '@/store/scout-store'

type ScoutSpotlightCutoutProps = {
  rect: { top: number; left: number; width: number; height: number }
  ringClassName?: string
  label?: string
}

const SPOTLIGHT_ACCENT_RING: Record<BrandAccent, string> = {
  sky: 'ring-sky-400/80',
  violet: 'ring-violet-400/80',
  rose: 'ring-rose-400/80',
  amber: 'ring-amber-400/80',
  neutral: 'ring-muted-foreground/50',
}

/** Cutout hole + optional pulsing ring and step label (BDA-288). */
export function ScoutSpotlightCutout({ rect, ringClassName, label }: ScoutSpotlightCutoutProps) {
  return (
    <>
      <div
        className={cn(
          'absolute rounded-lg ring-2 ring-white/90 transition-[top,left,width,height] duration-200 ease-out',
          ringClassName,
        )}
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.44)',
        }}
      />
      <div
        className="pointer-events-none absolute animate-pulse rounded-lg ring-2 ring-white/40"
        style={{
          top: rect.top - 2,
          left: rect.left - 2,
          width: rect.width + 4,
          height: rect.height + 4,
        }}
        aria-hidden
      />
      {label ? (
        <div
          className="pointer-events-none absolute max-w-[min(16rem,calc(100vw-2rem))] rounded-md bg-black/75 px-2 py-1 text-[11px] leading-snug text-white shadow-md"
          style={{
            top: Math.max(SCOUT_SPOTLIGHT_PAD, rect.top - 28),
            left: Math.min(
              Math.max(SCOUT_SPOTLIGHT_PAD, rect.left),
              typeof window !== 'undefined' ? window.innerWidth - 180 : rect.left,
            ),
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  )
}

/** Full-viewport dim with cutout on the active step target; panel-only when target missing (BDA-288). */
export function ScoutSpotlight() {
  const panelOpen = useScoutStore(selectScoutPanelOpen)
  const activeJourneyId = useScoutStore(selectActiveScoutJourney)
  const stepIndex = useScoutStore(selectScoutStepIndex)
  const workspaceView = useSessionStore((s) => s.workspaceView)
  const mode = useSessionStore((s) => s.mode)

  const targetId: ScoutTargetId | null = useMemo(() => {
    if (!panelOpen || !activeJourneyId) return null
    const journey = getScoutJourney(activeJourneyId)
    return journey.steps[stepIndex]?.target ?? null
  }, [activeJourneyId, panelOpen, stepIndex])

  const stepTitle = useMemo(() => {
    if (!activeJourneyId) return undefined
    return getScoutJourney(activeJourneyId).steps[stepIndex]?.title
  }, [activeJourneyId, stepIndex])

  const accentRing = useMemo(() => {
    if (!activeJourneyId) return undefined
    const accent = getScoutJourney(activeJourneyId).accent
    return SPOTLIGHT_ACCENT_RING[accent]
  }, [activeJourneyId])

  const refreshKey = `${workspaceView}:${mode}:${stepIndex}:${targetId ?? 'none'}`
  const { rect } = useScoutSpotlightTracking(targetId, refreshKey)

  if (!panelOpen || !targetId || !rect) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[15] overflow-hidden"
      aria-hidden
      data-scout-spotlight="active"
    >
      <ScoutWalkthroughArrow rect={rect} variant={stepIndex} refreshKey={refreshKey} />
      <ScoutSpotlightCutout rect={rect} ringClassName={accentRing} label={stepTitle} />
    </div>
  )
}

export { runScoutSpotlightGeometryHarness } from '@/lib/scout/spotlight-geometry'
