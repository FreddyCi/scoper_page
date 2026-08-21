import { useCallback, useEffect, useRef, useState } from 'react'

import {
  denormalizePoint,
  findPdfDrawingAnnotationAtPointer,
  findPdfDrawingAnnotationsInMarquee,
  isNormalizedBoundsLargeEnough,
  normalizePoint,
  normalizedAnnotationMarqueeBounds,
  normalizedBoundsFromCorners,
  translatePdfDrawingGeometry,
  PDF_DRAWING_TEXT_LABEL_FONT_PX,
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
  PdfMarkSessionTool,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { PdfDrawingDictationLayer } from '@/components/workspace/pdf-drawing-dictation-overlay'

const DEFAULT_STAMP_PX = 24
const DEFAULT_STROKE_WIDTH = 4
const DEFAULT_HIGHLIGHTER_WIDTH = 8
const DEFAULT_HIGHLIGHTER_OPACITY = 0.35
const DEFAULT_TEXT_PX = PDF_DRAWING_TEXT_LABEL_FONT_PX
const DEFAULT_PEN_COLOR = '#F59E0B'
const DEFAULT_ERASER_RADIUS_PX = 12
const MIN_POINT_DISTANCE_PX = 1.5
const MIN_MARQUEE_DRAG_PX = 4

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
  selectedAnnotationIds?: readonly string[]
  onSelectionChange?: (annotationIds: string[]) => void
  notationPickMode?: boolean
  onNotationTargetPick?: (annotationIds: string[]) => void
  onMoveAnnotation?: (
    annotationId: string,
    geometry: PdfDrawingGeometry,
  ) => void | Promise<void>
  /** Hold-Space dictation state forwarded from DocumentViewer (BDA-251+). */
  dictationTargetId?: string | null
  dictationDraft?: string
  /** Merged existing note + live draft for preview bubble (BDA-252). */
  dictationPreview?: string
  isDictating?: boolean
  speechNotesAvailable?: boolean
  onSaveVoiceNote?: (annotationId: string, voiceNote: string) => void
  onDictateHoldStart?: (annotationId: string) => void
  onDictateHoldEnd?: () => void
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

function isStrokeTool(tool: PdfMarkSessionTool | null | undefined): tool is 'pen' | 'highlighter' {
  return tool === 'pen' || tool === 'highlighter'
}

function isShapeTool(tool: PdfMarkSessionTool | null | undefined): tool is 'rect' | 'ellipse' {
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

type MoveDragState = {
  annotationId: string
  startPointer: PdfDrawingNormalizedPoint
  baseGeometry: PdfDrawingGeometry
  previewGeometry: PdfDrawingGeometry
}

type MarqueeDragState = {
  start: PdfDrawingNormalizedPoint
  end: PdfDrawingNormalizedPoint
  additive: boolean
}

function SelectionOutline({
  annotation,
  viewport,
}: {
  annotation: PdfDrawingAnnotation
  viewport: PdfDrawingViewportSize
}) {
  const bounds = normalizedAnnotationMarqueeBounds(annotation, viewport)
  const topLeft = denormalizePoint({ x: bounds.x, y: bounds.y }, viewport)
  return (
    <rect
      x={topLeft.x}
      y={topLeft.y}
      width={bounds.width * viewport.width}
      height={bounds.height * viewport.height}
      fill="rgba(14, 165, 233, 0.08)"
      stroke="#0EA5E9"
      strokeWidth={1.5}
      strokeDasharray="5 4"
      pointerEvents="none"
    />
  )
}

function MarqueeGraphic({
  marquee,
  viewport,
}: {
  marquee: MarqueeDragState
  viewport: PdfDrawingViewportSize
}) {
  const bounds = normalizedBoundsFromCorners(marquee.start, marquee.end)
  const topLeft = denormalizePoint({ x: bounds.x, y: bounds.y }, viewport)
  return (
    <rect
      x={topLeft.x}
      y={topLeft.y}
      width={bounds.width * viewport.width}
      height={bounds.height * viewport.height}
      fill="rgba(14, 165, 233, 0.12)"
      stroke="#0EA5E9"
      strokeWidth={1.5}
      strokeDasharray="5 4"
      pointerEvents="none"
    />
  )
}

function pointerDragDistancePx(
  start: PdfDrawingNormalizedPoint,
  end: PdfDrawingNormalizedPoint,
  viewport: PdfDrawingViewportSize,
): number {
  const a = denormalizePoint(start, viewport)
  const b = denormalizePoint(end, viewport)
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function toggleIdInList(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]
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
  selectedAnnotationIds = [],
  onSelectionChange,
  notationPickMode = false,
  onNotationTargetPick,
  onMoveAnnotation,
  dictationTargetId,
  dictationDraft,
  dictationPreview,
  isDictating,
  speechNotesAvailable = true,
  onSaveVoiceNote,
  onDictateHoldStart,
  onDictateHoldEnd,
}: PdfDrawingOverlayProps) {
  void dictationDraft
  const commitStroke = onStrokeCommit ?? onPenStrokeCommit
  const strokeToolActive =
    interactive && isStrokeTool(activeTool) && Boolean(commitStroke)
  const shapeToolActive = interactive && isShapeTool(activeTool) && Boolean(onShapeCommit)
  const textToolActive = interactive && activeTool === 'text' && Boolean(onTextCommit)
  const stampToolActive = interactive && activeTool === 'stamp' && Boolean(onStampCommit)
  const eraserActive = interactive && activeTool === 'eraser' && Boolean(onEraseAnnotation)
  const handActive = interactive && activeTool === 'hand' && Boolean(onMoveAnnotation)
  const selectActive = interactive && activeTool === 'select' && Boolean(onSelectionChange)
  const notationPickActive =
    interactive && notationPickMode && Boolean(onNotationTargetPick)
  const pointerActive =
    strokeToolActive ||
    shapeToolActive ||
    textToolActive ||
    stampToolActive ||
    eraserActive ||
    handActive ||
    selectActive ||
    notationPickActive

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
  const [moveDrag, setMoveDrag] = useState<MoveDragState | null>(null)
  const moveDragRef = useRef<MoveDragState | null>(null)
  const [draftMarquee, setDraftMarquee] = useState<MarqueeDragState | null>(null)
  const draftMarqueeRef = useRef<MarqueeDragState | null>(null)
  const [hoveredVoiceNoteId, setHoveredVoiceNoteId] = useState<string | null>(null)
  const hoverCardPinnedRef = useRef(false)
  const selectedIdsRef = useRef(selectedAnnotationIds)
  selectedIdsRef.current = selectedAnnotationIds
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
    moveDragRef.current = null
    draftMarqueeRef.current = null
    setDraftPoints([])
    setDraftShape(null)
    setMoveDrag(null)
    setDraftMarquee(null)
  }, [])

  const applyNotationTarget = useCallback(
    (nextIds: string[]) => {
      onNotationTargetPick?.(nextIds)
    },
    [onNotationTargetPick],
  )

  const applySelection = useCallback(
    (nextIds: string[]) => {
      onSelectionChange?.(nextIds)
    },
    [onSelectionChange],
  )

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

      if (notationPickActive) {
        event.preventDefault()
        const hit = findPdfDrawingAnnotationAtPointer(
          point,
          annotationsRef.current,
          viewport,
          eraserRadiusPx,
        )
        if (hit) {
          applyNotationTarget([hit.annotation_id])
        }
        return
      }

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

      if (selectActive) {
        event.preventDefault()
        const hit = findPdfDrawingAnnotationAtPointer(
          point,
          annotationsRef.current,
          viewport,
          eraserRadiusPx,
        )
        if (hit) {
          const current = selectedIdsRef.current
          if (event.shiftKey) {
            applySelection(toggleIdInList(current, hit.annotation_id))
          } else {
            applySelection([hit.annotation_id])
          }
          return
        }

        event.currentTarget.setPointerCapture(event.pointerId)
        drawingPointerId.current = event.pointerId
        const nextMarquee: MarqueeDragState = {
          start: point,
          end: point,
          additive: event.shiftKey,
        }
        draftMarqueeRef.current = nextMarquee
        setDraftMarquee(nextMarquee)
        return
      }

      if (handActive) {
        const hit = findPdfDrawingAnnotationAtPointer(
          point,
          annotationsRef.current,
          viewport,
          eraserRadiusPx,
        )
        if (!hit) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drawingPointerId.current = event.pointerId
        const nextMove: MoveDragState = {
          annotationId: hit.annotation_id,
          startPointer: point,
          baseGeometry: hit.geometry,
          previewGeometry: hit.geometry,
        }
        moveDragRef.current = nextMove
        setMoveDrag(nextMove)
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
      applyNotationTarget,
      applySelection,
      eraseAtPointer,
      eraserActive,
      eraserRadiusPx,
      handActive,
      notationPickActive,
      pointerActive,
      selectActive,
      shapeToolActive,
      stampToolActive,
      strokeToolActive,
      textEditor,
      textToolActive,
      placeStamp,
      viewport,
    ],
  )

  const updateVoiceNoteHover = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (isDictating) {
        setHoveredVoiceNoteId(null)
        return
      }
      const point = pointerToNormalized(event, viewport)
      const hit = findPdfDrawingAnnotationAtPointer(
        point,
        annotationsRef.current,
        viewport,
        16,
      )
      const nextId = hit?.voice_note?.trim() ? hit.annotation_id : null
      setHoveredVoiceNoteId((previous) => (previous === nextId ? previous : nextId))
    },
    [isDictating, viewport],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      updateVoiceNoteHover(event)
      if (drawingPointerId.current !== event.pointerId) return
      event.preventDefault()
      const point = pointerToNormalized(event, viewport)

      if (moveDragRef.current) {
        const drag = moveDragRef.current
        const deltaX = point.x - drag.startPointer.x
        const deltaY = point.y - drag.startPointer.y
        const nextMove: MoveDragState = {
          ...drag,
          previewGeometry: translatePdfDrawingGeometry(drag.baseGeometry, deltaX, deltaY),
        }
        moveDragRef.current = nextMove
        setMoveDrag(nextMove)
        return
      }

      if (draftMarqueeRef.current) {
        const nextMarquee: MarqueeDragState = {
          ...draftMarqueeRef.current,
          end: point,
        }
        draftMarqueeRef.current = nextMarquee
        setDraftMarquee(nextMarquee)
        return
      }

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
    [eraseAtPointer, eraserActive, shapeToolActive, strokeToolActive, updateVoiceNoteHover, viewport],
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

      if (moveDragRef.current && onMoveAnnotation) {
        const drag = moveDragRef.current
        resetDraft()
        void onMoveAnnotation(drag.annotationId, drag.previewGeometry)
        return
      }

      if (draftMarqueeRef.current && selectActive) {
        const marquee = draftMarqueeRef.current
        const dragPx = pointerDragDistancePx(marquee.start, marquee.end, viewport)
        resetDraft()
        if (dragPx >= MIN_MARQUEE_DRAG_PX) {
          const bounds = normalizedBoundsFromCorners(marquee.start, marquee.end)
          if (isNormalizedBoundsLargeEnough(bounds, viewport, 2)) {
            const hits = findPdfDrawingAnnotationsInMarquee(
              bounds,
              annotationsRef.current,
              viewport,
            )
            const hitIds = hits.map((annotation) => annotation.annotation_id)
            if (marquee.additive) {
              const merged = new Set(selectedIdsRef.current)
              for (const id of hitIds) merged.add(id)
              applySelection([...merged])
            } else {
              applySelection(hitIds)
            }
          }
        } else if (!marquee.additive) {
          applySelection([])
        }
        return
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

      if (strokeToolActive) {
        const points = draftPointsRef.current
        resetDraft()
        void finishStroke(points)
        return
      }

      resetDraft()
    },
    [
      applySelection,
      eraserActive,
      finishShape,
      finishStroke,
      onMoveAnnotation,
      resetDraft,
      selectActive,
      shapeToolActive,
      strokeToolActive,
      viewport,
    ],
  )

  const handlePointerLeave = useCallback(() => {
    if (hoverCardPinnedRef.current) return
    setHoveredVoiceNoteId(null)
  }, [])

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
    !draftMarquee &&
    !moveDrag &&
    !textEditor &&
    selectedAnnotationIds.length === 0 &&
    !isDictating &&
    !annotations.some((annotation) => annotation.voice_note?.trim())
  ) {
    return null
  }

  const movePreviewById = moveDrag
    ? { [moveDrag.annotationId]: moveDrag.previewGeometry }
    : null

  const displayAnnotations = annotations.map((annotation) => {
    const preview = movePreviewById?.[annotation.annotation_id]
    if (!preview) return annotation
    return { ...annotation, geometry: preview }
  })

  const selectedSet = new Set(selectedAnnotationIds)

  const cursorClass = handActive
    ? 'cursor-grab active:cursor-grabbing'
    : notationPickActive
      ? 'cursor-pointer'
      : selectActive
      ? 'cursor-crosshair'
      : eraserActive
        ? 'cursor-cell'
        : textToolActive
          ? 'cursor-text'
          : stampToolActive
            ? 'cursor-copy'
            : strokeToolActive || shapeToolActive
              ? 'cursor-crosshair'
              : undefined

  const hasVoiceNotes = annotations.some((annotation) => annotation.voice_note?.trim())
  const svgPointerActive = (pointerActive || hasVoiceNotes) && !textEditor

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
        onPointerDown={pointerActive && !textEditor ? handlePointerDown : undefined}
        onPointerMove={svgPointerActive ? handlePointerMove : undefined}
        onPointerUp={pointerActive && !textEditor ? handlePointerUp : undefined}
        onPointerCancel={pointerActive && !textEditor ? handlePointerCancel : undefined}
        onPointerLeave={hasVoiceNotes ? handlePointerLeave : undefined}
      >
      {displayAnnotations.map((annotation) => (
        <g key={annotation.annotation_id} data-annotation-id={annotation.annotation_id}>
          <AnnotationGraphic annotation={annotation} viewport={viewport} />
        </g>
      ))}

      {selectedAnnotationIds.length > 0
        ? displayAnnotations
            .filter((annotation) => selectedSet.has(annotation.annotation_id))
            .map((annotation) => (
              <SelectionOutline
                key={`sel-${annotation.annotation_id}`}
                annotation={annotation}
                viewport={viewport}
              />
            ))
        : null}

      {draftMarquee ? <MarqueeGraphic marquee={draftMarquee} viewport={viewport} /> : null}

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

      <PdfDrawingDictationLayer
        annotations={displayAnnotations}
        viewport={viewport}
        dictationTargetId={dictationTargetId}
        dictationPreview={dictationPreview ?? dictationDraft}
        isDictating={isDictating}
        hoveredVoiceNoteId={hoveredVoiceNoteId}
        selectedAnnotationId={
          selectedAnnotationIds.length === 1 ? selectedAnnotationIds[0] : null
        }
        speechNotesAvailable={speechNotesAvailable}
        onSaveNote={onSaveVoiceNote}
        onDictateHoldStart={onDictateHoldStart}
        onDictateHoldEnd={onDictateHoldEnd}
        onHoverCardEnter={() => {
          hoverCardPinnedRef.current = true
        }}
        onHoverCardLeave={() => {
          hoverCardPinnedRef.current = false
          setHoveredVoiceNoteId(null)
        }}
      />
    </div>
  )
}
