import { useCallback, useEffect, useRef, useState } from 'react'

import {
  denormalizePoint,
  findPdfDrawingAnnotationAtPointer,
  isNormalizedBoundsLargeEnough,
  normalizePoint,
  normalizedBoundsFromCorners,
  type PdfDrawingViewportSize,
} from '@/lib/pdf-drawing-geometry'
import type {
  PdfDrawingAnnotation,
  PdfDrawingEllipseGeometry,
  PdfDrawingGeometry,
  PdfDrawingNormalizedPoint,
  PdfDrawingRectGeometry,
  PdfDrawingStampGeometry,
  PdfDrawingStrokeGeometry,
  PdfDrawingTextGeometry,
  PdfDrawingTool,
  PdfMarkSessionTool,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const DEFAULT_STAMP_PX = 24
const DEFAULT_STROKE_WIDTH = 4
const DEFAULT_HIGHLIGHTER_WIDTH = 8
const DEFAULT_HIGHLIGHTER_OPACITY = 0.35
const DEFAULT_TEXT_PX = 14
const DEFAULT_PEN_COLOR = '#F59E0B'
const DEFAULT_ERASER_RADIUS_PX = 12
const MIN_POINT_DISTANCE_PX = 1.5

export type PdfDrawingStrokeCommit = {
  tool: 'pen' | 'highlighter'
  color: string
  stroke_width: number
  opacity: number
  geometry: PdfDrawingStrokeGeometry
}

/** @deprecated Use PdfDrawingStrokeCommit */
export type PdfDrawingPenCommit = PdfDrawingStrokeCommit

export type PdfDrawingShapeCommit = {
  tool: 'rect' | 'ellipse'
  color: string
  stroke_width: number
  opacity: number
  geometry: PdfDrawingRectGeometry | PdfDrawingEllipseGeometry
}

export type PdfDrawingTextCommit = {
  tool: 'text'
  color: string
  text_body: string
  geometry: PdfDrawingTextGeometry
}

export type PdfDrawingStampCommit = {
  tool: 'stamp'
  color: string
  stroke_width: number
  geometry: PdfDrawingStampGeometry
}

export type PdfDrawingOverlayProps = {
  annotations: PdfDrawingAnnotation[]
  viewport: PdfDrawingViewportSize
  className?: string
  interactive?: boolean
  activeTool?: PdfMarkSessionTool | null
  markColor?: string
  markStrokeWidth?: number
  eraserRadiusPx?: number
  onStrokeCommit?: (commit: PdfDrawingStrokeCommit) => void | Promise<void>
  /** @deprecated Use onStrokeCommit */
  onPenStrokeCommit?: (commit: PdfDrawingStrokeCommit) => void | Promise<void>
  onShapeCommit?: (commit: PdfDrawingShapeCommit) => void | Promise<void>
  onTextCommit?: (commit: PdfDrawingTextCommit) => void | Promise<void>
  onStampCommit?: (commit: PdfDrawingStampCommit) => void | Promise<void>
  onEraseAnnotation?: (annotationId: string) => void | Promise<void>
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
      ? (annotation.opacity ?? DEFAULT_HIGHLIGHTER_OPACITY)
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

function isStrokeTool(tool: PdfDrawingTool | null | undefined): tool is 'pen' | 'highlighter' {
  return tool === 'pen' || tool === 'highlighter'
}

function isShapeTool(tool: PdfDrawingTool | null | undefined): tool is 'rect' | 'ellipse' {
  return tool === 'rect' || tool === 'ellipse'
}

type DraftShape = {
  start: PdfDrawingNormalizedPoint
  end: PdfDrawingNormalizedPoint
}

type TextEditorState = {
  anchor: PdfDrawingNormalizedPoint
  value: string
}

function PdfDrawingTextEditor({
  state,
  viewport,
  color,
  onChange,
  onCommit,
  onCancel,
}: {
  state: TextEditorState
  viewport: PdfDrawingViewportSize
  color: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pixel = denormalizePoint(state.anchor, viewport)

  useEffect(() => {
    inputRef.current?.focus()
  }, [state.anchor.x, state.anchor.y])

  return (
    <input
      ref={inputRef}
      type="text"
      value={state.value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') {
          event.preventDefault()
          onCommit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
      }}
      onBlur={() => {
        onCommit()
      }}
      className="border-border bg-surface text-foreground pointer-events-auto absolute z-10 min-w-[6rem] max-w-[min(16rem,40vw)] rounded border px-1.5 py-0.5 text-sm font-semibold shadow-panel outline-none ring-2 ring-sky-500/40"
      style={{
        left: pixel.x,
        top: pixel.y,
        color,
        fontSize: DEFAULT_TEXT_PX,
      }}
      placeholder="Label…"
      aria-label="Drawing text label"
    />
  )
}

function DraftShapeGraphic({
  draft,
  tool,
  viewport,
  color,
  strokeWidth,
}: {
  draft: DraftShape
  tool: 'rect' | 'ellipse'
  viewport: PdfDrawingViewportSize
  color: string
  strokeWidth: number
}) {
  const bounds = normalizedBoundsFromCorners(draft.start, draft.end)
  const topLeft = denormalizePoint({ x: bounds.x, y: bounds.y }, viewport)
  const width = bounds.width * viewport.width
  const height = bounds.height * viewport.height

  if (tool === 'rect') {
    return (
      <rect
        x={topLeft.x}
        y={topLeft.y}
        width={width}
        height={height}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={1}
      />
    )
  }

  const rx = width / 2
  const ry = height / 2
  return (
    <ellipse
      cx={topLeft.x + rx}
      cy={topLeft.y + ry}
      rx={rx}
      ry={ry}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeOpacity={1}
    />
  )
}

/** SVG layer for persisted PDF drawing marks + in-progress strokes (BDA-224–226). */
export function PdfDrawingOverlay({
  annotations,
  viewport,
  className,
  interactive = false,
  activeTool = null,
  markColor = DEFAULT_PEN_COLOR,
  markStrokeWidth = DEFAULT_STROKE_WIDTH,
  eraserRadiusPx = DEFAULT_ERASER_RADIUS_PX,
  onStrokeCommit,
  onPenStrokeCommit,
  onShapeCommit,
  onTextCommit,
  onStampCommit,
  onEraseAnnotation,
}: PdfDrawingOverlayProps) {
  const commitStroke = onStrokeCommit ?? onPenStrokeCommit
  const strokeToolActive =
    interactive && isStrokeTool(activeTool) && Boolean(commitStroke)
  const shapeToolActive = interactive && isShapeTool(activeTool) && Boolean(onShapeCommit)
  const textToolActive = interactive && activeTool === 'text' && Boolean(onTextCommit)
  const stampToolActive = interactive && activeTool === 'stamp' && Boolean(onStampCommit)
  const eraserActive = interactive && activeTool === 'eraser' && Boolean(onEraseAnnotation)
  const pointerActive =
    strokeToolActive || shapeToolActive || textToolActive || stampToolActive || eraserActive

  const effectiveStrokeWidth =
    activeTool === 'highlighter'
      ? Math.max(markStrokeWidth, DEFAULT_HIGHLIGHTER_WIDTH)
      : markStrokeWidth
  const draftOpacity = activeTool === 'highlighter' ? DEFAULT_HIGHLIGHTER_OPACITY : 1

  const [draftPoints, setDraftPoints] = useState<PdfDrawingNormalizedPoint[]>([])
  const draftPointsRef = useRef<PdfDrawingNormalizedPoint[]>([])
  const [draftShape, setDraftShape] = useState<DraftShape | null>(null)
  const draftShapeRef = useRef<DraftShape | null>(null)
  const drawingPointerId = useRef<number | null>(null)
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null)
  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations

  useEffect(() => {
    if (!textToolActive) {
      setTextEditor(null)
    }
  }, [textToolActive])

  const resetDraft = useCallback(() => {
    drawingPointerId.current = null
    draftPointsRef.current = []
    draftShapeRef.current = null
    setDraftPoints([])
    setDraftShape(null)
  }, [])

  const eraseAtPointer = useCallback(
    (point: PdfDrawingNormalizedPoint) => {
      if (!onEraseAnnotation) return
      const hit = findPdfDrawingAnnotationAtPointer(
        point,
        annotationsRef.current,
        viewport,
        eraserRadiusPx,
      )
      if (hit) {
        void onEraseAnnotation(hit.annotation_id)
      }
    },
    [eraserRadiusPx, onEraseAnnotation, viewport],
  )

  const commitTextEditor = useCallback(async () => {
    if (!textEditor || !onTextCommit) {
      setTextEditor(null)
      return
    }
    const trimmed = textEditor.value.trim()
    if (!trimmed) {
      setTextEditor(null)
      return
    }
    const geometry: PdfDrawingTextGeometry = {
      kind: 'text',
      x: textEditor.anchor.x,
      y: textEditor.anchor.y,
    }
    setTextEditor(null)
    await onTextCommit({
      tool: 'text',
      color: markColor,
      text_body: trimmed,
      geometry,
    })
  }, [markColor, onTextCommit, textEditor])

  const cancelTextEditor = useCallback(() => {
    setTextEditor(null)
  }, [])

  const placeStamp = useCallback(
    async (anchor: PdfDrawingNormalizedPoint) => {
      if (!onStampCommit) return
      const geometry: PdfDrawingStampGeometry = {
        kind: 'stamp',
        x: anchor.x,
        y: anchor.y,
        stampKind: 'window',
      }
      await onStampCommit({
        tool: 'stamp',
        color: markColor,
        stroke_width: 2,
        geometry,
      })
    },
    [markColor, onStampCommit],
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!pointerActive || event.button !== 0) return
      const point = pointerToNormalized(event, viewport)

      if (textToolActive) {
        if (textEditor) return
        event.preventDefault()
        setTextEditor({ anchor: point, value: '' })
        return
      }

      if (stampToolActive) {
        event.preventDefault()
        void placeStamp(point)
        return
      }

      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      drawingPointerId.current = event.pointerId

      if (eraserActive) {
        eraseAtPointer(point)
        return
      }

      if (shapeToolActive && isShapeTool(activeTool)) {
        const nextShape: DraftShape = { start: point, end: point }
        draftShapeRef.current = nextShape
        setDraftShape(nextShape)
        return
      }

      if (!strokeToolActive) return

      draftPointsRef.current = [point]
      setDraftPoints([point])
    },
    [
      activeTool,
      eraseAtPointer,
      eraserActive,
      pointerActive,
      shapeToolActive,
      stampToolActive,
      strokeToolActive,
      textEditor,
      textToolActive,
      placeStamp,
      viewport,
    ],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (drawingPointerId.current !== event.pointerId) return
      event.preventDefault()
      const point = pointerToNormalized(event, viewport)

      if (eraserActive) {
        eraseAtPointer(point)
        return
      }

      if (shapeToolActive && draftShapeRef.current) {
        const nextShape: DraftShape = {
          start: draftShapeRef.current.start,
          end: point,
        }
        draftShapeRef.current = nextShape
        setDraftShape(nextShape)
        return
      }

      if (!strokeToolActive) return

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
    [eraseAtPointer, eraserActive, shapeToolActive, strokeToolActive, viewport],
  )

  const finishShape = useCallback(
    async (shape: DraftShape) => {
      if (!onShapeCommit || !isShapeTool(activeTool)) return
      const bounds = normalizedBoundsFromCorners(shape.start, shape.end)
      if (!isNormalizedBoundsLargeEnough(bounds, viewport)) return

      const geometry: PdfDrawingRectGeometry | PdfDrawingEllipseGeometry =
        activeTool === 'rect'
          ? { kind: 'rect', ...bounds }
          : { kind: 'ellipse', ...bounds }

      await onShapeCommit({
        tool: activeTool,
        color: markColor,
        stroke_width: markStrokeWidth,
        opacity: 1,
        geometry,
      })
    },
    [activeTool, markColor, markStrokeWidth, onShapeCommit, viewport],
  )

  const finishStroke = useCallback(
    async (points: PdfDrawingNormalizedPoint[]) => {
      if (points.length === 0 || !commitStroke || !isStrokeTool(activeTool)) return
      await commitStroke({
        tool: activeTool,
        color: markColor,
        stroke_width: effectiveStrokeWidth,
        opacity: activeTool === 'highlighter' ? DEFAULT_HIGHLIGHTER_OPACITY : 1,
        geometry: { kind: 'stroke', points },
      })
    },
    [activeTool, commitStroke, effectiveStrokeWidth, markColor],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (drawingPointerId.current !== event.pointerId) return
      event.preventDefault()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      if (eraserActive) {
        resetDraft()
        return
      }

      if (shapeToolActive && draftShapeRef.current) {
        const shape = draftShapeRef.current
        resetDraft()
        void finishShape(shape)
        return
      }

      const points = draftPointsRef.current
      resetDraft()
      void finishStroke(points)
    },
    [eraserActive, finishShape, finishStroke, resetDraft, shapeToolActive],
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

  if (
    annotations.length === 0 &&
    !pointerActive &&
    draftPoints.length === 0 &&
    !draftShape &&
    !textEditor
  ) {
    return null
  }

  const cursorClass = eraserActive
    ? 'cursor-cell'
    : textToolActive
      ? 'cursor-text'
      : stampToolActive
        ? 'cursor-copy'
        : strokeToolActive || shapeToolActive
          ? 'cursor-crosshair'
          : undefined

  const svgPointerActive = pointerActive && !textEditor

  return (
    <div className={cn('absolute inset-0', className)}>
      <svg
        className={cn(
          'absolute inset-0 touch-none',
          svgPointerActive ? cn('pointer-events-auto', cursorClass) : 'pointer-events-none',
        )}
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        aria-hidden={!svgPointerActive}
        onPointerDown={svgPointerActive ? handlePointerDown : undefined}
        onPointerMove={svgPointerActive ? handlePointerMove : undefined}
        onPointerUp={svgPointerActive ? handlePointerUp : undefined}
        onPointerCancel={svgPointerActive ? handlePointerCancel : undefined}
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
          strokeWidth={effectiveStrokeWidth}
          opacity={draftOpacity}
        />
      ) : null}

      {draftShape && isShapeTool(activeTool) ? (
        <DraftShapeGraphic
          draft={draftShape}
          tool={activeTool}
          viewport={viewport}
          color={markColor}
          strokeWidth={markStrokeWidth}
        />
      ) : null}
      </svg>

      {textEditor ? (
        <PdfDrawingTextEditor
          state={textEditor}
          viewport={viewport}
          color={markColor}
          onChange={(value) => setTextEditor((previous) => (previous ? { ...previous, value } : null))}
          onCommit={() => {
            void commitTextEditor()
          }}
          onCancel={cancelTextEditor}
        />
      ) : null}
    </div>
  )
}
