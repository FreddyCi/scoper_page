import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

import {
  buildWalkthroughArrowPath,
  scoutPanelArrowOrigin,
  spotlightArrowTarget,
  type WalkthroughPoint,
} from '@/lib/scout/walkthrough-arrow-paths'
import type { ScoutSpotlightRect } from '@/lib/scout/spotlight-geometry'

const ARROW_DASH = '7 10'

type ScoutWalkthroughArrowProps = {
  rect: ScoutSpotlightRect
  /** Step index — picks whimsical curve variant. */
  variant: number
  refreshKey: string | number
}

function measureArrowPath(rect: ScoutSpotlightRect, variant: number): string {
  const originEl = document.querySelector('[data-scout-arrow-origin]')
  if (!originEl || !(originEl instanceof HTMLElement)) return ''

  const from = scoutPanelArrowOrigin(originEl)
  const to = spotlightArrowTarget(rect)
  return buildWalkthroughArrowPath(from, to, variant)
}

/** GSAP draw-on dashed vector arrow from Scout CTA to spotlight target. */
export function ScoutWalkthroughArrow({ rect, variant, refreshKey }: ScoutWalkthroughArrowProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const [pathD, setPathD] = useState('')

  useEffect(() => {
    function update() {
      setPathD(measureArrowPath(rect, variant))
    }

    update()

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [rect, variant, refreshKey])

  useEffect(() => {
    const path = pathRef.current
    if (!path || !pathD) return undefined

    const length = path.getTotalLength()
    if (length <= 0) return undefined

    gsap.killTweensOf(path)

    const ctx = gsap.context(() => {
      gsap.set(path, {
        strokeDasharray: length,
        strokeDashoffset: length,
        opacity: 0.95,
      })

      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 0.9,
        ease: 'power2.out',
        onComplete: () => {
          gsap.set(path, { strokeDasharray: ARROW_DASH, strokeDashoffset: 0 })
          gsap.to(path, {
            strokeDashoffset: -17,
            duration: 1.5,
            repeat: -1,
            ease: 'none',
          })
        },
      })
    }, path)

    return () => ctx.revert()
  }, [pathD])

  if (!pathD) return null

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[16] h-full w-full"
      aria-hidden
      data-scout-walkthrough-arrow
    >
      <defs>
        <marker
          id="scout-walkthrough-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="white" />
        </marker>
      </defs>
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd="url(#scout-walkthrough-arrowhead)"
      />
    </svg>
  )
}

/** Dev harness — arrow geometry helpers. */
export function runScoutWalkthroughArrowHarness(): void {
  const origin: WalkthroughPoint = { x: 900, y: 400 }
  const target = spotlightArrowTarget({ left: 120, top: 200, width: 160, height: 40 })
  if (target.x !== 132 || target.y !== 220) {
    throw new Error('runScoutWalkthroughArrowHarness: spotlightArrowTarget mismatch')
  }

  const path = buildWalkthroughArrowPath(origin, target, 2)
  if (!path) {
    throw new Error('runScoutWalkthroughArrowHarness: expected path for panel→target')
  }
}
