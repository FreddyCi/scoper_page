import { useCallback, useRef, useState } from 'react'

import {
  denormalizePoint,
  normalizePoint,
  type PdfDrawingViewportSize,
} from '@/lib/pdf-drawing-geometry'
import type {
  PdfDrawingAnnotation,
  PdfDrawingGeometry,
  PdfDrawingNormalizedPoint,
  PdfDrawingStrokeGeometry,
  PdfDrawingTool,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const DEFAULT_STAMP_PX = 24
const DEFAULT_STROKE_WIDTH = 4
const DEFAULT_TEXT_PX = 14
const DEFAULT_PEN_COLOR = '#F59E0B'
const MIN_POINT_DISTANCE_PX = 1.5

export type PdfDrawingPenCommit = {
  tool: 'pen'
  color: string
  stroke_width: number
  opacity: number
  geometry: PdfDrawingStrokeGeometry
}

export type PdfDrawingOverlayProps = {
  annotations: PdfDrawingAnnotation[]
  viewport: PdfDrawingViewportSize
  className?: string
  /** When true, pen tool accepts pointer input (BDA-225). */
  interactive?: boolean
  activeTool?: PdfDrawingTool | null
  markColor?: string
  markStrokeWidth?: number
  onPenStrokeCommit?: (commit: PdfDrawingPenCommit) => void | Promise<void>
}

function stampSizePx(
  geometry: Extract<PdfDrawingGeometry, { kind: 'stamp' }>,
  viewport: PdfDrawingViewportSize,
): number {
  if (geometry.size != null && geometry.size > 0) {
    return geometry.size * viewport.width
  }
  return DEFAULT_STAMP_PX
}

function WindowStampGraphic({
  x,
  y,
  sizePx,
  color,
}: {
  x: number
  y: number
  sizePx: number
  color: string
}) {
  const half = sizePx / 2
  return (
    <g transform={`translate(${x - half} ${y - half})`} stroke={color} fill="none" strokeWidth={2}>
      <rect x={0} y={0} width={sizePx} height={sizePx} rx={1} />
      <line x1={half} y1={0} x2={half} y2={sizePx} />
      <line x1={0} y1={half} x2={sizePx} y2={half} />
    </g>
  )
}

function strokePolylinePoints(
  points: readonly PdfDrawingNormalizedPoint[],
  viewport: PdfDrawingViewportSize,
): string {
  return points
    .map((point) => {
      const pixel = denormalizePoint(point, viewport)
      return `${pixel.x},${pixel.y}`
    })
    .join(' ')
}

function StrokeGraphic({
  points,
  viewport,
  color,
  strokeWidth,
  opacity,
}: {
  points: readonly PdfDrawingNormalizedPoint[]
  viewport: PdfDrawingViewportSize
  color: string
  strokeWidth: number
  opacity: number
}) {
  if (points.length === 0) return null
  if (points.length === 1) {
    const point = denormalizePoint(points[0]!, viewport)
    return (
      <circle
        cx={point.x}
        cy={point.y}
        r={strokeWidth / 2}
        fill={color}
        fillOpacity={opacity}
      />
    )
  }
  return (
    <polyline
      points={strokePolylinePoints(points, viewport)}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeOpacity={opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function AnnotationGraphic({
  annotation,
  viewport,
}: {
  annotation: PdfDrawingAnnotation
  viewport: PdfDrawingViewportSize
}) {
  const strokeWidth = annotation.stroke_width ?? DEFAULT_STROKE_WIDTH
  const opacity =
    annotation.tool === 'highlighter'
      ? (annotation.opacity ?? 0.35)
      : (annotation.opacity ?? 1)
  const color = annotation.color
  const geometry = annotation.geometry

  switch (geometry.kind) {
    case 'stroke':
      return (
        <StrokeGraphic
          points={geometry.points}
          viewport={viewport}
          color={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      )
    case 'rect': {
      const topLeft = denormalizePoint({ x: geometry.x, y: geometry.y }, viewport)
      return (
        <rect
          x={topLeft.x}
          y={topLeft.y}
          width={geometry.width * viewport.width}
          height={geometry.height * viewport.height}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity={opacity}
        />
      )
    }
    case 'ellipse': {
      const topLeft = denormalizePoint({ x: geometry.x, y: geometry.y }, viewport)
      const rx = (geometry.width * viewport.width) / 2
      const ry = (geometry.height * viewport.height) / 2
      return (
        <ellipse
          cx={topLeft.x + rx}
          cy={topLeft.y + ry}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity={opacity}
        />
      )
    }
    case 'text': {
      const anchor = denormalizePoint(geometry, viewport)
      const label = annotation.text_body?.trim()
      if (!label) return null
      return (
        <text
          x={anchor.x}
          y={anchor.y}
          fill={color}
          fillOpacity={opacity}
          fontSize={DEFAULT_TEXT_PX}
          fontWeight={600}
          dominantBaseline="hanging"
        >
          {label}
        </text>
      )
    }
    case 'stamp': {
      if (geometry.stampKind !== 'window') return null
      const anchor = denormalizePoint(geometry, viewport)
      const sizePx = stampSizePx(geometry, viewport)
      return <WindowStampGraphic x={anchor.x} y={anchor.y} sizePx={sizePx} color={color} />
    }
    default: {
      const _exhaustive: never = geometry
      return _exhaustive
    }
  }
}

function shouldAppendPoint(
  previous: PdfDrawingNormalizedPoint | undefined,
  next: PdfDrawingNormalizedPoint,
  viewport: PdfDrawingViewportSize,
): boolean {
  if (!previous) return true
  const a = denormalizePoint(previous, viewport)
  const b = denormalizePoint(next, viewport)
  return Math.hypot(a.x - b.x, a.y - b.y) >= MIN_POINT_DISTANCE_PX
}

function pointerToNormalized(
  event: React.PointerEvent<SVGSVGElement>,
  viewport: PdfDrawingViewportSize,
): PdfDrawingNormalizedPoint {
  const rect = event.currentTarget.getBoundingClientRect()
  return normalizePoint(event.clientX - rect.left, event.clientY - rect.top, viewport)
}

/** SVG layer for persisted PDF drawing marks + in-progress pen strokes (BDA-224–225). */
export function PdfDrawingOverlay({
  annotations,
  viewport,
  className,
  interactive = false,
  activeTool = null,
  markColor = DEFAULT_PEN_COLOR,
  markStrokeWidth = DEFAULT_STROKE_WIDTH,
  onPenStrokeCommit,
}: PdfDrawingOverlayProps) {
  const penActive = interactive && activeTool === 'pen' && Boolean(onPenStrokeCommit)
  const [draftPoints, setDraftPoints] = useState<PdfDrawingNormalizedPoint[]>([])
  const draftPointsRef = useRef<PdfDrawingNormalizedPoint[]>([])
  const drawingPointerId = useRef<number | null>(null)

  const resetDraft = useCallback(() => {
    drawingPointerId.current = null
    draftPointsRef.current = []
    setDraftPoints([])
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!penActive || event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      drawingPointerId.current = event.pointerId
      const point = pointerToNormalized(event, viewport)
      draftPointsRef.current = [point]
      setDraftPoints([point])
    },
    [penActive, viewport],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!penActive || drawingPointerId.current !== event.pointerId) return
      event.preventDefault()
      const point = pointerToNormalized(event, viewport)
      setDraftPoints((previous) => {
        const last = previous[previous.length - 1]
        if (!shouldAppendPoint(last, point, viewport)) {
          return previous
        }
        const next = [...previous, point]
        draftPointsRef.current = next
        return next
      })
    },
    [penActive, viewport],
  )

  const finishStroke = useCallback(
    async (points: PdfDrawingNormalizedPoint[]) => {
      if (points.length === 0 || !onPenStrokeCommit) return
      await onPenStrokeCommit({
        tool: 'pen',
        color: markColor,
        stroke_width: markStrokeWidth,
        opacity: 1,
        geometry: { kind: 'stroke', points },
      })
    },
    [markColor, markStrokeWidth, onPenStrokeCommit],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (drawingPointerId.current !== event.pointerId) return
      event.preventDefault()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      const points = draftPointsRef.current
      resetDraft()
      void finishStroke(points)
    },
    [finishStroke, resetDraft],
  )

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (drawingPointerId.current !== event.pointerId) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      resetDraft()
    },
    [resetDraft],
  )

  if (viewport.width <= 0 || viewport.height <= 0) {
    return null
  }

  if (annotations.length === 0 && !penActive && draftPoints.length === 0) {
    return null
  }

  return (
    <svg
      className={cn(
        'absolute inset-0 touch-none',
        penActive ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none',
        className,
      )}
      width={viewport.width}
      height={viewport.height}
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      aria-hidden={!penActive}
      onPointerDown={penActive ? handlePointerDown : undefined}
      onPointerMove={penActive ? handlePointerMove : undefined}
      onPointerUp={penActive ? handlePointerUp : undefined}
      onPointerCancel={penActive ? handlePointerCancel : undefined}
    >
      {annotations.map((annotation) => (
        <g key={annotation.annotation_id} data-annotation-id={annotation.annotation_id}>
          <AnnotationGraphic annotation={annotation} viewport={viewport} />
        </g>
      ))}

      {draftPoints.length > 0 ? (
        <StrokeGraphic
          points={draftPoints}
          viewport={viewport}
          color={markColor}
          strokeWidth={markStrokeWidth}
          opacity={1}
        />
      ) : null}
    </svg>
  )
}
