import { denormalizePoint, type PdfDrawingViewportSize } from '@/lib/pdf-drawing-geometry'
import type { PdfDrawingAnnotation, PdfDrawingGeometry } from '@/lib/types'
import { cn } from '@/lib/utils'

const DEFAULT_STAMP_PX = 24
const DEFAULT_STROKE_WIDTH = 4
const DEFAULT_TEXT_PX = 14

export type PdfDrawingOverlayProps = {
  annotations: PdfDrawingAnnotation[]
  viewport: PdfDrawingViewportSize
  className?: string
  /** BDA-224: read-only. Pointer handlers land in BDA-225+. */
  interactive?: boolean
}

function stampSizePx(geometry: Extract<PdfDrawingGeometry, { kind: 'stamp' }>, viewport: PdfDrawingViewportSize): number {
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
    case 'stroke': {
      if (geometry.points.length === 0) return null
      if (geometry.points.length === 1) {
        const point = denormalizePoint(geometry.points[0]!, viewport)
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
      const points = geometry.points
        .map((point) => {
          const pixel = denormalizePoint(point, viewport)
          return `${pixel.x},${pixel.y}`
        })
        .join(' ')
      return (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity={opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    }
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

/** Read-only SVG layer for persisted PDF drawing marks (BDA-224). */
export function PdfDrawingOverlay({
  annotations,
  viewport,
  className,
  interactive = false,
}: PdfDrawingOverlayProps) {
  if (annotations.length === 0 || viewport.width <= 0 || viewport.height <= 0) {
    return null
  }

  return (
    <svg
      className={cn(
        'absolute inset-0 touch-none',
        interactive ? 'pointer-events-auto' : 'pointer-events-none',
        className,
      )}
      width={viewport.width}
      height={viewport.height}
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      aria-hidden={!interactive}
    >
      {annotations.map((annotation) => (
        <g key={annotation.annotation_id} data-annotation-id={annotation.annotation_id}>
          <AnnotationGraphic annotation={annotation} viewport={viewport} />
        </g>
      ))}
    </svg>
  )
}
