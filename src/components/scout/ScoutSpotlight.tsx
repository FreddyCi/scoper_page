import { useCallback, useEffect, useMemo, useState } from 'react'

import { getScoutJourney } from '@/lib/scout/journeys-map'
import { queryScoutTarget } from '@/lib/scout/targets'
import type { ScoutTargetId } from '@/lib/scout/targets'
import { cn } from '@/lib/utils'
import {
  selectActiveScoutJourney,
  selectScoutPanelOpen,
  selectScoutStepIndex,
  useScoutStore,
} from '@/store/scout-store'

const SPOTLIGHT_PAD = 6

/** Spotlight cutout on the active step target — panel-only when target missing (BDA-287 stub, BDA-288). */
export function ScoutSpotlight() {
  const panelOpen = useScoutStore(selectScoutPanelOpen)
  const activeJourneyId = useScoutStore(selectActiveScoutJourney)
  const stepIndex = useScoutStore(selectScoutStepIndex)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const targetId: ScoutTargetId | null = useMemo(() => {
    if (!panelOpen || !activeJourneyId) return null
    const journey = getScoutJourney(activeJourneyId)
    const step = journey.steps[stepIndex]
    return step?.target ?? null
  }, [activeJourneyId, panelOpen, stepIndex])

  const updateRect = useCallback(() => {
    if (!targetId) {
      setRect(null)
      return
    }
    const element = queryScoutTarget(targetId)
    setRect(element ? element.getBoundingClientRect() : null)
  }, [targetId])

  useEffect(() => {
    updateRect()
    if (!targetId) return undefined

    const element = queryScoutTarget(targetId)
    const resizeObserver =
      element && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateRect())
        : null
    resizeObserver?.observe(element as Element)

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [targetId, updateRect, stepIndex])

  if (!panelOpen || !targetId || !rect) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[15]" aria-hidden>
      <div
        className={cn(
          'absolute rounded-lg ring-2 ring-white/90 transition-[top,left,width,height] duration-200',
        )}
        style={{
          top: rect.top - SPOTLIGHT_PAD,
          left: rect.left - SPOTLIGHT_PAD,
          width: rect.width + SPOTLIGHT_PAD * 2,
          height: rect.height + SPOTLIGHT_PAD * 2,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.42)',
        }}
      />
    </div>
  )
}
