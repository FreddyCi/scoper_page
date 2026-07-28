import { useCallback, useRef, useState } from 'react'

const MIN_RATIO = 0.28
const MAX_RATIO = 0.62

export function useSplitPaneRatio(initialRatio = 0.44) {
  const [ratio, setRatio] = useState(initialRatio)
  const containerRef = useRef<HTMLDivElement>(null)

  const onResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const container = containerRef.current
      if (!container) return

      function onPointerMove(moveEvent: PointerEvent) {
        const rect = container!.getBoundingClientRect()
        const nextRatio = (moveEvent.clientX - rect.left) / rect.width
        setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, nextRatio)))
      }

      function onPointerUp() {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [],
  )

  return { ratio, containerRef, onResizeStart, setRatio }
}
