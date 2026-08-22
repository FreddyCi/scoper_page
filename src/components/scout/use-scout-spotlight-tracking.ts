import { useCallback, useEffect, useState } from 'react'

import {
  isSpotlightRectVisible,
  padSpotlightRect,
  type ScoutSpotlightRect,
} from '@/lib/scout/spotlight-geometry'
import { queryScoutTarget } from '@/lib/scout/targets'
import type { ScoutTargetId } from '@/lib/scout/targets'

const TARGET_POLL_MS = 120
const TARGET_POLL_MAX = 50

export type ScoutSpotlightTracking = {
  rect: ScoutSpotlightRect | null
  /** Step declares a target but element is not in the DOM — panel-only mode. */
  targetMissing: boolean
}

/**
 * Track `[data-scout-target]` position for ScoutSpotlight — resize, scroll, late mount (BDA-288).
 */
export function useScoutSpotlightTracking(
  targetId: ScoutTargetId | null,
  refreshKey: string | number = 0,
): ScoutSpotlightTracking {
  const [rect, setRect] = useState<ScoutSpotlightRect | null>(null)
  const [targetMissing, setTargetMissing] = useState(false)

  const measure = useCallback((): HTMLElement | null => {
    if (!targetId) {
      setRect(null)
      setTargetMissing(false)
      return null
    }

    const element = queryScoutTarget(targetId)
    if (!element) {
      setRect(null)
      return null
    }

    const next = padSpotlightRect(element.getBoundingClientRect())
    setRect(isSpotlightRectVisible(next) ? next : null)
    setTargetMissing(false)
    return element
  }, [targetId])

  useEffect(() => {
    if (!targetId) {
      setRect(null)
      setTargetMissing(false)
      return undefined
    }

    const resolvedTargetId = targetId

    let disposed = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let pollAttempts = 0
    let observedElement: HTMLElement | null = null
    let resizeObserver: ResizeObserver | null = null
    let mutationObserver: MutationObserver | null = null

    function cleanupObservers() {
      resizeObserver?.disconnect()
      resizeObserver = null
      mutationObserver?.disconnect()
      mutationObserver = null
      observedElement = null
    }

    function attachObservers(element: HTMLElement) {
      if (observedElement === element) return
      cleanupObservers()
      observedElement = element

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          measure()
        })
        resizeObserver.observe(element)
      }
    }

    function schedulePoll() {
      if (disposed || pollAttempts >= TARGET_POLL_MAX) {
        if (!disposed && pollAttempts >= TARGET_POLL_MAX && !queryScoutTarget(resolvedTargetId)) {
          setTargetMissing(true)
        }
        return
      }

      pollAttempts += 1
      pollTimer = setTimeout(() => {
        const element = measure()
        if (element) {
          attachObservers(element)
          return
        }
        schedulePoll()
      }, TARGET_POLL_MS)
    }

    const initial = measure()
    if (initial) {
      attachObservers(initial)
    } else {
      setTargetMissing(false)
      schedulePoll()
    }

    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        const element = measure()
        if (element) {
          attachObservers(element)
        }
      })
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-scout-target', 'hidden', 'class', 'style'],
      })
    }

    function onViewportChange() {
      const element = measure()
      if (element) attachObservers(element)
    }

    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)

    return () => {
      disposed = true
      if (pollTimer) clearTimeout(pollTimer)
      cleanupObservers()
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [targetId, measure, refreshKey])

  return { rect, targetMissing }
}
