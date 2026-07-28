import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

type AnchoredMenuPosition = {
  top: number
  left: number
  minWidth: number
}

export function useAnchoredMenuPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
): AnchoredMenuPosition | null {
  const [position, setPosition] = useState<AnchoredMenuPosition | null>(null)

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null)
      return
    }

    function update() {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
      })
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

type AnchoredMenuPortalProps = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
  style?: CSSProperties
  role?: string
  'aria-label'?: string
}

/** Fixed-position menu portal — escapes overflow clipping in scroll rows */
export function AnchoredMenuPortal({
  open,
  anchorRef,
  children,
  className,
  style,
  role,
  'aria-label': ariaLabel,
}: AnchoredMenuPortalProps) {
  const position = useAnchoredMenuPosition(open, anchorRef)

  if (!open || !position || typeof document === 'undefined') return null

  return createPortal(
    <div
      role={role}
      aria-label={ariaLabel}
      className={cn(
        'border-border bg-surface shadow-elevated fixed z-[100] rounded-lg border py-1',
        className,
      )}
      style={{
        top: position.top,
        left: position.left,
        minWidth: position.minWidth,
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
