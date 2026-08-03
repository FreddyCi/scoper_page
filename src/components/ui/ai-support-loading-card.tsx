import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SKELETON_ROWS = [
  { width: '92%', height: 12 },
  { width: '76%', height: 12 },
  { width: '100%', height: 10 },
  { width: '98%', height: 10 },
  { width: '94%', height: 10 },
  { width: '88%', height: 10 },
  { width: '82%', height: 10 },
  { width: '70%', height: 10 },
] as const

type AiSupportLoadingCardProps = {
  className?: string
  label?: string
  buttonLabel?: string
}

/** GSAP skeleton loader for generate / qualify states */
export function AiSupportLoadingCard({
  className,
  label = 'Generating',
  buttonLabel = 'Generate',
}: AiSupportLoadingCardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const shimmerRef = useRef<HTMLDivElement>(null)
  const lensRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const bars = root.querySelectorAll('[data-skeleton-bar]')
    const ctx = gsap.context(() => {
      gsap.fromTo(
        bars,
        { opacity: 0.45, scaleX: 0.94 },
        {
          opacity: 0.9,
          scaleX: 1,
          duration: 0.85,
          stagger: 0.07,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          transformOrigin: 'left center',
        },
      )

      if (shimmerRef.current) {
        gsap.fromTo(
          shimmerRef.current,
          { xPercent: -140 },
          { xPercent: 240, duration: 1.75, repeat: -1, ease: 'none' },
        )
      }

      if (lensRef.current) {
        gsap.fromTo(
          lensRef.current,
          { scale: 0.96, opacity: 0.75 },
          {
            scale: 1.03,
            opacity: 1,
            duration: 1.35,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          },
        )
      }

      if (buttonRef.current) {
        gsap.fromTo(
          buttonRef.current,
          { opacity: 0.88 },
          { opacity: 1, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' },
        )
      }
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={rootRef}
      className={cn(
        'border-border bg-muted/40 relative overflow-hidden rounded-xl border p-4',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`${label} in progress`}
    >
      <div
        ref={buttonRef}
        className={cn(
          buttonVariants({ variant: 'default', size: 'sm' }),
          'pointer-events-none w-full',
        )}
      >
        {buttonLabel}
      </div>

      <div className="relative mt-4 space-y-2.5 overflow-hidden py-0.5">
        {SKELETON_ROWS.map((row, index) => (
          <div
            key={`${row.width}-${index}`}
            data-skeleton-bar
            className="bg-muted-foreground/15 rounded-md"
            style={{ width: row.width, height: row.height }}
          />
        ))}

        <div
          ref={shimmerRef}
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-background/70 to-transparent"
        />
      </div>

      <div
        ref={lensRef}
        className="border-border bg-background/80 pointer-events-none absolute top-5 right-4 flex size-20 min-w-0 items-center justify-center rounded-full border shadow-panel backdrop-blur-sm"
      >
        <span
          className="text-muted-foreground line-clamp-3 max-w-full px-2 text-center text-xs leading-tight font-medium"
          title={label}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
