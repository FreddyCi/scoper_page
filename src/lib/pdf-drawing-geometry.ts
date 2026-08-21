import type { PageViewport } from 'pdfjs-dist'

import type {
  PdfDrawingAnnotation,
  PdfDrawingEllipseGeometry,
  PdfDrawingGeometry,
  PdfDrawingNormalizedPoint,
  PdfDrawingRectGeometry,
  PdfDrawingStrokeGeometry,
  PdfDrawingTextGeometry,
} from '@/lib/types'

/** Display size of the rendered PDF page (CSS pixels), e.g. canvas layout or `PageViewport`. */
export type PdfDrawingViewportSize = {
  width: number
  height: number
}

export type PdfDrawingNormalizedBounds = {
  x: number
  y: number
  width: number
  height: number
}

const EPSILON = 1e-9

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

export function viewportSizeFromPageViewport(viewport: PageViewport): PdfDrawingViewportSize {
  return { width: viewport.width, height: viewport.height }
}

/** Map pointer position on the page overlay to normalized page coordinates (0–1, top-left origin). */
export function normalizePoint(
  pixelX: number,
  pixelY: number,
  viewport: PdfDrawingViewportSize,
): PdfDrawingNormalizedPoint {
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new Error('normalizePoint: viewport size must be positive')
  }
  return {
    x: clamp01(pixelX / viewport.width),
    y: clamp01(pixelY / viewport.height),
  }
}

/** Map normalized coordinates back to overlay pixel space at the current viewport size. */
export function denormalizePoint(
  point: PdfDrawingNormalizedPoint,
  viewport: PdfDrawingViewportSize,
): { x: number; y: number } {
  return {
    x: point.x * viewport.width,
    y: point.y * viewport.height,
  }
}

export function normalizedPointsBounds(
  points: readonly PdfDrawingNormalizedPoint[],
): PdfDrawingNormalizedBounds | null {
  if (points.length === 0) return null

  let minX = points[0]!.x
  let minY = points[0]!.y
  let maxX = points[0]!.x
  let maxY = points[0]!.y

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 0),
    height: Math.max(maxY - minY, 0),
  }
}

export function normalizedStrokeBounds(
  stroke: PdfDrawingStrokeGeometry,
): PdfDrawingNormalizedBounds | null {
  return normalizedPointsBounds(stroke.points)
}

/** Normalized axis-aligned box from drag start/end (BDA-228). */
export function normalizedBoundsFromCorners(
  start: PdfDrawingNormalizedPoint,
  end: PdfDrawingNormalizedPoint,
): PdfDrawingNormalizedBounds {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export function isNormalizedBoundsLargeEnough(
  bounds: PdfDrawingNormalizedBounds,
  viewport: PdfDrawingViewportSize,
  minDiagonalPx = 4,
): boolean {
  const widthPx = bounds.width * viewport.width
  const heightPx = bounds.height * viewport.height
  return Math.hypot(widthPx, heightPx) >= minDiagonalPx
}

export function normalizedGeometryBounds(
  geometry: PdfDrawingGeometry,
): PdfDrawingNormalizedBounds | null {
  switch (geometry.kind) {
    case 'stroke':
      return normalizedStrokeBounds(geometry)
    case 'rect':
    case 'ellipse':
      return {
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
      }
    case 'text':
    case 'stamp':
      return { x: geometry.x, y: geometry.y, width: 0, height: 0 }
    default: {
      const _exhaustive: never = geometry
      return _exhaustive
    }
  }
}

/** Shortest distance from `(px, py)` to segment `(x1,y1)–`(x2,y2)` in pixel space. */
export function distancePointToSegmentPx(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  if (lengthSq < EPSILON) {
    return Math.hypot(px - x1, py - y1)
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.hypot(px - projX, py - projY)
}

export function hitTestNormalizedRect(
  pointer: PdfDrawingNormalizedPoint,
  rect: PdfDrawingRectGeometry | PdfDrawingNormalizedBounds,
  padding = 0,
): boolean {
  return (
    pointer.x >= rect.x - padding &&
    pointer.x <= rect.x + rect.width + padding &&
    pointer.y >= rect.y - padding &&
    pointer.y <= rect.y + rect.height + padding
  )
}

/** @deprecated Use hitTestNormalizedRect — kept for ellipse-only call sites. */
export function hitTestNormalizedBounds(
  pointer: PdfDrawingNormalizedPoint,
  bounds: PdfDrawingNormalizedBounds,
  padding = 0,
): boolean {
  return hitTestNormalizedRect(pointer, bounds, padding)
}

export const PDF_DRAWING_TEXT_LABEL_FONT_PX = 14
const PDF_DRAWING_STAMP_DEFAULT_PX = 24

/** Estimated label box for hit-testing and selection (matches overlay `text` rendering). */
export function normalizedTextLabelBounds(
  geometry: PdfDrawingTextGeometry,
  textBody: string | undefined,
  viewport: PdfDrawingViewportSize,
  fontSizePx = PDF_DRAWING_TEXT_LABEL_FONT_PX,
): PdfDrawingNormalizedBounds {
  const label = textBody?.trim() ?? ''
  const charWidthPx = fontSizePx * 0.58
  const widthPx = Math.max(label.length * charWidthPx + 6, fontSizePx * 1.5)
  const heightPx = fontSizePx * 1.35
  const widthN = Math.min(widthPx / viewport.width, Math.max(0, 1 - geometry.x))
  const heightN = Math.min(heightPx / viewport.height, Math.max(0, 1 - geometry.y))
  return {
    x: geometry.x,
    y: geometry.y,
    width: widthN,
    height: heightN,
  }
}

export function normalizedStampBounds(
  geometry: Extract<PdfDrawingGeometry, { kind: 'stamp' }>,
  viewport: PdfDrawingViewportSize,
  defaultSizePx = PDF_DRAWING_STAMP_DEFAULT_PX,
): PdfDrawingNormalizedBounds {
  const sizePx =
    geometry.size != null && geometry.size > 0 ? geometry.size * viewport.width : defaultSizePx
  const widthN = sizePx / viewport.width
  const heightN = sizePx / viewport.height
  const halfW = widthN / 2
  const halfH = heightN / 2
  const x = Math.max(0, geometry.x - halfW)
  const y = Math.max(0, geometry.y - halfH)
  return {
    x,
    y,
    width: Math.min(widthN, Math.max(0, 1 - x)),
    height: Math.min(heightN, Math.max(0, 1 - y)),
  }
}

export function hitTestPdfDrawingAnnotation(
  pointer: PdfDrawingNormalizedPoint,
  annotation: PdfDrawingAnnotation,
  viewport: PdfDrawingViewportSize,
  options: PdfDrawingHitTestOptions = {},
): boolean {
  const geometry = annotation.geometry
  const shapePadding = options.shapePadding ?? 0

  if (geometry.kind === 'text') {
    const bounds = normalizedTextLabelBounds(geometry, annotation.text_body, viewport)
    return hitTestNormalizedRect(pointer, bounds, shapePadding)
  }

  if (geometry.kind === 'stamp') {
    const bounds = normalizedStampBounds(geometry, viewport)
    return hitTestNormalizedRect(pointer, bounds, shapePadding)
  }

  return hitTestPdfDrawingGeometry(pointer, geometry, viewport, options)
}

export function hitTestNormalizedEllipse(
  pointer: PdfDrawingNormalizedPoint,
  ellipse: PdfDrawingEllipseGeometry,
  padding = 0,
): boolean {
  if (ellipse.width <= 0 || ellipse.height <= 0) return false

  const cx = ellipse.x + ellipse.width / 2
  const cy = ellipse.y + ellipse.height / 2
  const rx = ellipse.width / 2 + padding
  const ry = ellipse.height / 2 + padding
  if (rx <= 0 || ry <= 0) return false

  const nx = (pointer.x - cx) / rx
  const ny = (pointer.y - cy) / ry
  return nx * nx + ny * ny <= 1
}

export function hitTestStroke(
  pointer: PdfDrawingNormalizedPoint,
  stroke: PdfDrawingStrokeGeometry,
  viewport: PdfDrawingViewportSize,
  hitRadiusPx: number,
): boolean {
  if (stroke.points.length === 0) return false

  const pointerPx = denormalizePoint(pointer, viewport)

  if (stroke.points.length === 1) {
    const only = denormalizePoint(stroke.points[0]!, viewport)
    return Math.hypot(pointerPx.x - only.x, pointerPx.y - only.y) <= hitRadiusPx
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    const start = denormalizePoint(stroke.points[index - 1]!, viewport)
    const end = denormalizePoint(stroke.points[index]!, viewport)
    if (
      distancePointToSegmentPx(
        pointerPx.x,
        pointerPx.y,
        start.x,
        start.y,
        end.x,
        end.y,
      ) <= hitRadiusPx
    ) {
      return true
    }
  }

  return false
}

export type PdfDrawingHitTestOptions = {
  /** Eraser radius in CSS pixels (default 8). */
  hitRadiusPx?: number
  /** Extra normalized padding for rect/ellipse hits. */
  shapePadding?: number
}

export function hitTestPdfDrawingGeometry(
  pointer: PdfDrawingNormalizedPoint,
  geometry: PdfDrawingGeometry,
  viewport: PdfDrawingViewportSize,
  options: PdfDrawingHitTestOptions = {},
): boolean {
  const hitRadiusPx = options.hitRadiusPx ?? 8
  const shapePadding = options.shapePadding ?? 0

  switch (geometry.kind) {
    case 'stroke':
      return hitTestStroke(pointer, geometry, viewport, hitRadiusPx)
    case 'rect':
      return hitTestNormalizedRect(pointer, geometry, shapePadding)
    case 'ellipse':
      return hitTestNormalizedEllipse(pointer, geometry, shapePadding)
    case 'text':
    case 'stamp': {
      const anchorPx = denormalizePoint(geometry, viewport)
      const pointerPx = denormalizePoint(pointer, viewport)
      return Math.hypot(pointerPx.x - anchorPx.x, pointerPx.y - anchorPx.y) <= hitRadiusPx
    }
    default: {
      const _exhaustive: never = geometry
      return _exhaustive
    }
  }
}

function eraserHitRadiusPx(annotation: PdfDrawingAnnotation, eraserRadiusPx: number): number {
  const strokeWidth = annotation.stroke_width ?? 4
  return Math.max(eraserRadiusPx, strokeWidth / 2 + 4)
}

/** Topmost annotation at pointer (last in paint order wins). */
export function findPdfDrawingAnnotationAtPointer(
  pointer: PdfDrawingNormalizedPoint,
  annotations: readonly PdfDrawingAnnotation[],
  viewport: PdfDrawingViewportSize,
  eraserRadiusPx = 12,
): PdfDrawingAnnotation | null {
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index]!
    const hitRadiusPx = eraserHitRadiusPx(annotation, eraserRadiusPx)
    if (
      hitTestPdfDrawingAnnotation(pointer, annotation, viewport, {
        hitRadiusPx,
        shapePadding: 0.005,
      })
    ) {
      return annotation
    }
  }
  return null
}

/** Axis-aligned bounds used for marquee selection (expands point anchors). */
export function normalizedAnnotationMarqueeBounds(
  annotation: PdfDrawingAnnotation,
  viewport: PdfDrawingViewportSize,
): PdfDrawingNormalizedBounds {
  const geometry = annotation.geometry
  const base = normalizedGeometryBounds(geometry)
  if (!base) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  if (geometry.kind === 'stroke' || geometry.kind === 'rect' || geometry.kind === 'ellipse') {
    return base
  }

  if (geometry.kind === 'text') {
    return normalizedTextLabelBounds(geometry, annotation.text_body, viewport)
  }

  if (geometry.kind === 'stamp') {
    return normalizedStampBounds(geometry, viewport)
  }

  return { x: base.x, y: base.y, width: 0, height: 0 }
}

function normalizedRectsIntersect(
  a: PdfDrawingNormalizedBounds,
  b: PdfDrawingNormalizedBounds,
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** Annotations whose marquee bounds intersect `marquee` (normalized top-left box). */
export function findPdfDrawingAnnotationsInMarquee(
  marquee: PdfDrawingNormalizedBounds,
  annotations: readonly PdfDrawingAnnotation[],
  viewport: PdfDrawingViewportSize,
): PdfDrawingAnnotation[] {
  return annotations.filter((annotation) =>
    normalizedRectsIntersect(normalizedAnnotationMarqueeBounds(annotation, viewport), marquee),
  )
}

export function translatePdfDrawingGeometry(
  geometry: PdfDrawingGeometry,
  deltaX: number,
  deltaY: number,
): PdfDrawingGeometry {
  switch (geometry.kind) {
    case 'stroke':
      return {
        kind: 'stroke',
        points: geometry.points.map((point) => ({
          x: point.x + deltaX,
          y: point.y + deltaY,
        })),
      }
    case 'rect':
    case 'ellipse':
      return {
        ...geometry,
        x: geometry.x + deltaX,
        y: geometry.y + deltaY,
      }
    case 'text':
    case 'stamp':
      return {
        ...geometry,
        x: geometry.x + deltaX,
        y: geometry.y + deltaY,
      }
    default: {
      const _exhaustive: never = geometry
      return _exhaustive
    }
  }
}

/** Dev harness — normalized round-trip and eraser hit-test smoke (BDA-222). */
export function runPdfDrawingGeometryHarness(): void {
  const point = { x: 0.25, y: 0.5 }
  const smallViewport: PdfDrawingViewportSize = { width: 400, height: 600 }
  const largeViewport: PdfDrawingViewportSize = { width: 800, height: 1200 }

  for (const viewport of [smallViewport, largeViewport]) {
    const pixel = denormalizePoint(point, viewport)
    const roundTrip = normalizePoint(pixel.x, pixel.y, viewport)
    if (
      Math.abs(roundTrip.x - point.x) > 1e-10 ||
      Math.abs(roundTrip.y - point.y) > 1e-10
    ) {
      throw new Error('runPdfDrawingGeometryHarness failed: normalize/denormalize round-trip')
    }
  }

  const stroke: PdfDrawingStrokeGeometry = {
    kind: 'stroke',
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ],
  }
  // Midpoint of the stroke in normalized space is (0.5, 0.5) — map through the non-square viewport.
  const midPointer = normalizePoint(200, 300, smallViewport)
  if (Math.abs(midPointer.x - 0.5) > 1e-10 || Math.abs(midPointer.y - 0.5) > 1e-10) {
    throw new Error('runPdfDrawingGeometryHarness failed: stroke midpoint normalization')
  }
  if (!hitTestStroke(midPointer, stroke, smallViewport, 12)) {
    throw new Error('runPdfDrawingGeometryHarness failed: expected hit on stroke segment')
  }
  const farPointer = normalizePoint(10, 590, smallViewport)
  if (hitTestStroke(farPointer, stroke, smallViewport, 4)) {
    throw new Error('runPdfDrawingGeometryHarness failed: unexpected hit far from stroke')
  }

  const rect: PdfDrawingRectGeometry = {
    kind: 'rect',
    x: 0.2,
    y: 0.2,
    width: 0.2,
    height: 0.2,
  }
  if (!hitTestNormalizedRect({ x: 0.25, y: 0.25 }, rect)) {
    throw new Error('runPdfDrawingGeometryHarness failed: expected rect hit')
  }
  if (hitTestNormalizedRect({ x: 0.05, y: 0.05 }, rect)) {
    throw new Error('runPdfDrawingGeometryHarness failed: unexpected rect hit')
  }

  const box = normalizedBoundsFromCorners({ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.7 })
  if (box.x !== 0.2 || box.width !== 0.3 || !isNormalizedBoundsLargeEnough(box, smallViewport)) {
    throw new Error('runPdfDrawingGeometryHarness failed: normalizedBoundsFromCorners')
  }

  const bounds = normalizedGeometryBounds(stroke)
  if (!bounds || bounds.width < 0.79 || bounds.height < 0.79) {
    throw new Error('runPdfDrawingGeometryHarness failed: stroke bounds')
  }

  const sampleAnnotation: PdfDrawingAnnotation = {
    annotation_id: 'harness-ann',
    doc_id: 'doc',
    page_num: 1,
    tool: 'pen',
    color: '#000',
    stroke_width: 4,
    geometry: stroke,
    author_initials: 'T',
    created_at: new Date().toISOString(),
  }
  const hit = findPdfDrawingAnnotationAtPointer(midPointer, [sampleAnnotation], smallViewport, 12)
  if (!hit || hit.annotation_id !== 'harness-ann') {
    throw new Error('runPdfDrawingGeometryHarness failed: annotation hit lookup')
  }

  const moved = translatePdfDrawingGeometry(rect, 0.05, 0.05)
  if (moved.kind !== 'rect' || moved.x !== 0.25) {
    throw new Error('runPdfDrawingGeometryHarness failed: translate rect')
  }

  const marqueeHits = findPdfDrawingAnnotationsInMarquee(
    { x: 0, y: 0, width: 0.5, height: 0.5 },
    [sampleAnnotation],
    smallViewport,
  )
  if (marqueeHits.length !== 1) {
    throw new Error('runPdfDrawingGeometryHarness failed: marquee select')
  }

  const textAnnotation: PdfDrawingAnnotation = {
    annotation_id: 'harness-text',
    doc_id: 'doc',
    page_num: 1,
    tool: 'text',
    color: '#000',
    geometry: { kind: 'text', x: 0.2, y: 0.2 },
    text_body: 'Window A1',
    author_initials: 'T',
    created_at: new Date().toISOString(),
  }
  const textMidPointer = normalizePoint(110, 130, smallViewport)
  if (!hitTestPdfDrawingAnnotation(textMidPointer, textAnnotation, smallViewport)) {
    throw new Error('runPdfDrawingGeometryHarness failed: text label hit box')
  }
  const textFarPointer = normalizePoint(350, 130, smallViewport)
  if (hitTestPdfDrawingAnnotation(textFarPointer, textAnnotation, smallViewport)) {
    throw new Error('runPdfDrawingGeometryHarness failed: unexpected text label hit')
  }

  const stampGeometry = { kind: 'stamp' as const, x: 0.5, y: 0.5, stampKind: 'window' as const }
  const stampBounds = normalizedStampBounds(stampGeometry, smallViewport)
  const stampHalfW = (24 / smallViewport.width) / 2
  const stampHalfH = (24 / smallViewport.height) / 2
  if (
    Math.abs(stampBounds.x - (0.5 - stampHalfW)) > 1e-10 ||
    Math.abs(stampBounds.y - (0.5 - stampHalfH)) > 1e-10
  ) {
    throw new Error('runPdfDrawingGeometryHarness failed: stamp bounds centered on anchor')
  }
}
