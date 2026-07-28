import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import type { ViewportHighlightRect } from '@/lib/citation-bbox'
import { cn } from '@/lib/utils'

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

type PdfHighlightEditorProps = {
  rect: ViewportHighlightRect
  boundsWidth: number
  boundsHeight: number
  hasBlockComment: boolean
  disabled?: boolean
  onCommit: (rect: ViewportHighlightRect) => void | Promise<void>
}

const MIN_WIDTH = 16
const MIN_HEIGHT = 12
const COMMIT_EPSILON = 2

function clampRect(
  rect: ViewportHighlightRect,
  boundsWidth: number,
  boundsHeight: number,
): ViewportHighlightRect {
  const width = Math.max(MIN_WIDTH, Math.min(rect.width, boundsWidth))
  const height = Math.max(MIN_HEIGHT, Math.min(rect.height, boundsHeight))
  const left = Math.max(0, Math.min(rect.left, boundsWidth - width))
  const top = Math.max(0, Math.min(rect.top, boundsHeight - height))
  return { left, top, width, height }
}

function resizeRect(rect: ViewportHighlightRect, handle: Handle, dx: number, dy: number): ViewportHighlightRect {
  let { left, top, width, height } = rect

  if (handle === 'move') {
    return { left: left + dx, top: top + dy, width, height }
  }

  if (handle.includes('e')) width += dx
  if (handle.includes('w')) {
    left += dx
    width -= dx
  }
  if (handle.includes('s')) height += dy
  if (handle.includes('n')) {
    top += dy
    height -= dy
  }

  if (width < MIN_WIDTH) {
    if (handle.includes('w')) left -= MIN_WIDTH - width
    width = MIN_WIDTH
  }
  if (height < MIN_HEIGHT) {
    if (handle.includes('n')) top -= MIN_HEIGHT - height
    height = MIN_HEIGHT
  }

  return { left, top, width, height }
}

function rectChanged(a: ViewportHighlightRect, b: ViewportHighlightRect): boolean {
  return (
    Math.abs(a.left - b.left) > COMMIT_EPSILON ||
    Math.abs(a.top - b.top) > COMMIT_EPSILON ||
    Math.abs(a.width - b.width) > COMMIT_EPSILON ||
    Math.abs(a.height - b.height) > COMMIT_EPSILON
  )
}

const HANDLES: Array<{ id: Handle; className: string; cursor: string }> = [
  { id: 'nw', className: '-left-1.5 -top-1.5', cursor: 'nwse-resize' },
  { id: 'n', className: 'left-1/2 -top-1.5 -translate-x-1/2', cursor: 'ns-resize' },
  { id: 'ne', className: '-right-1.5 -top-1.5', cursor: 'nesw-resize' },
  { id: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { id: 'se', className: '-right-1.5 -bottom-1.5', cursor: 'nwse-resize' },
  { id: 's', className: 'left-1/2 -bottom-1.5 -translate-x-1/2', cursor: 'ns-resize' },
  { id: 'sw', className: '-left-1.5 -bottom-1.5', cursor: 'nesw-resize' },
  { id: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
]

export function PdfHighlightEditor({
  rect,
  boundsWidth,
  boundsHeight,
  hasBlockComment,
  disabled = false,
  onCommit,
}: PdfHighlightEditorProps) {
  const [draft, setDraft] = useState(rect)
  const dragRef = useRef<{
    handle: Handle
    startX: number
    startY: number
    startRect: ViewportHighlightRect
  } | null>(null)
  const baseRectRef = useRef(rect)

  useEffect(() => {
    if (!dragRef.current) {
      baseRectRef.current = rect
      setDraft(rect)
    }
  }, [rect])

  const finishDrag = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return

    dragRef.current = null
    const next = clampRect(draft, boundsWidth, boundsHeight)
    setDraft(next)

    if (rectChanged(next, drag.startRect)) {
      void onCommit(next)
    } else {
      setDraft(baseRectRef.current)
    }
  }, [boundsHeight, boundsWidth, draft, onCommit])

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return

      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      const next = clampRect(
        resizeRect(drag.startRect, drag.handle, dx, dy),
        boundsWidth,
        boundsHeight,
      )
      setDraft(next)
    }

    function handlePointerUp() {
      finishDrag()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [boundsHeight, boundsWidth, finishDrag])

  function startDrag(handle: Handle) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startRect: draft,
      }
    }
  }

  return (
    <div
      className={cn(
        'absolute rounded-sm border-2 bg-sky-400/25',
        hasBlockComment ? 'border-amber-500 ring-2 ring-amber-400/70' : 'border-sky-500',
        disabled ? 'opacity-70' : 'opacity-100',
      )}
      style={{
        left: draft.left,
        top: draft.top,
        width: draft.width,
        height: draft.height,
      }}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-sm',
          disabled ? 'cursor-wait' : 'cursor-move',
        )}
        onPointerDown={startDrag('move')}
        aria-label="Move highlight region"
      />

      {!disabled
        ? HANDLES.map((handle) => (
            <div
              key={handle.id}
              className={cn(
                'border-sky-700 bg-surface absolute size-3 rounded-sm border shadow-sm',
                handle.className,
              )}
              style={{ cursor: handle.cursor }}
              onPointerDown={startDrag(handle.id)}
              aria-label={`Resize highlight ${handle.id}`}
            />
          ))
        : null}
    </div>
  )
}
