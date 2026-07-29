import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { cn } from '@/lib/utils'

const SHIMMER_ROWS = [
  { width: '100%', height: 10 },
  { width: '94%', height: 10 },
  { width: '88%', height: 10 },
  { width: '72%', height: 10 },
] as const

type EnhancePassageShimmerProps = {
  className?: string
  label?: string
}

/** Compact shimmer while Scoper 1.7 generates a passage enhancement. */
export function EnhancePassageShimmer({
  className,
  label = 'Scoper 1.7 is enhancing…',
}: EnhancePassageShimmerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const shimmerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const bars = root.querySelectorAll('[data-enhance-shimmer-bar]')
    const ctx = gsap.context(() => {
      gsap.fromTo(
        bars,
        { opacity: 0.35, scaleX: 0.92 },
        {
          opacity: 0.85,
          scaleX: 1,
          duration: 0.8,
          stagger: 0.08,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          transformOrigin: 'left center',
        },
      )

      if (shimmerRef.current) {
        gsap.fromTo(
          shimmerRef.current,
          { xPercent: -120 },
          { xPercent: 220, duration: 1.5, repeat: -1, ease: 'none' },
        )
      }
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={rootRef}
      className={cn(
        'border-violet-200/70 bg-violet-50/40 relative overflow-hidden rounded-xl border px-3 py-3',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <p className="text-violet-900 mb-2.5 text-xs font-medium">{label}</p>
      <div className="relative space-y-2 overflow-hidden py-0.5">
        {SHIMMER_ROWS.map((row, index) => (
          <div
            key={`${row.width}-${index}`}
            data-enhance-shimmer-bar
            className="bg-violet-300/35 rounded-md"
            style={{ width: row.width, height: row.height }}
          />
        ))}
        <div
          ref={shimmerRef}
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-violet-100/80 to-transparent"
        />
      </div>
    </div>
  )
}
