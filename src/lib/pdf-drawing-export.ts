import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'

import { liteParseBboxToPdfUserSpace } from '@/lib/citation-bbox'
import {
  normalizedAnnotationMarqueeBounds,
  type PdfDrawingNormalizedBounds,
  type PdfDrawingViewportSize,
} from '@/lib/pdf-drawing-geometry'
import { toPdfLatinText } from '@/lib/pdf-latin-text'
import type {
  PdfDrawingAnnotation,
  PdfDrawingEllipseGeometry,
  PdfDrawingGeometry,
  PdfDrawingNormalizedPoint,
  PdfDrawingRectGeometry,
  PdfDrawingStampGeometry,
  PdfDrawingStrokeGeometry,
  PdfDrawingTextGeometry,
} from '@/lib/types'

const DEFAULT_STROKE_WIDTH_PT = 4
const DEFAULT_HIGHLIGHTER_WIDTH_PT = 8
const DEFAULT_HIGHLIGHTER_OPACITY = 0.35
const DEFAULT_TEXT_PT = 14
const DEFAULT_STAMP_PT = 24
const DEFAULT_STAMP_STROKE_PT = 2
const VOICE_NOTE_FONT_PT = 8
const VOICE_NOTE_TITLE_PT = 7
const VOICE_NOTE_MAX_WIDTH_PT = 132
const VOICE_NOTE_GAP_PT = 6
const VOICE_NOTE_PADDING_PT = 5
const VOICE_NOTE_BG = rgb(1, 0.97, 0.86)
const VOICE_NOTE_BORDER = rgb(0.82, 0.62, 0.12)
const VOICE_NOTE_TITLE = rgb(0.35, 0.22, 0.02)
const VOICE_NOTE_BODY = rgb(0.18, 0.14, 0.1)

export type PdfDrawingPageSize = {
  widthPts: number
  heightPts: number
}

export type DrawPdfDrawingAnnotationsOptions = {
  font?: PDFFont
  boldFont?: PDFFont
}

function parseHexColor(hex: string, fallback: RGB): RGB {
  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return fallback
  }
  const value = Number.parseInt(normalized, 16)
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255)
}

function annotationColor(annotation: PdfDrawingAnnotation): RGB {
  return parseHexColor(annotation.color, rgb(0.1, 0.1, 0.1))
}

function strokeWidthPt(annotation: PdfDrawingAnnotation): number {
  const width = annotation.stroke_width ?? DEFAULT_STROKE_WIDTH_PT
  if (annotation.tool === 'highlighter') {
    return Math.max(width, DEFAULT_HIGHLIGHTER_WIDTH_PT)
  }
  return width
}

function strokeOpacity(annotation: PdfDrawingAnnotation): number {
  if (annotation.tool === 'highlighter') {
    return annotation.opacity ?? DEFAULT_HIGHLIGHTER_OPACITY
  }
  return annotation.opacity ?? 1
}

/** Map normalized top-left bounds to PDF user-space bbox (bottom-left origin). */
export function normalizedBoundsToPdfUserSpace(
  bounds: PdfDrawingNormalizedBounds,
  pageSize: PdfDrawingPageSize,
): { x: number; y: number; width: number; height: number } {
  return liteParseBboxToPdfUserSpace(
    {
      x: bounds.x * pageSize.widthPts,
      y: bounds.y * pageSize.heightPts,
      width: bounds.width * pageSize.widthPts,
      height: bounds.height * pageSize.heightPts,
    },
    pageSize.heightPts,
  )
}

/** Map normalized top-left point to PDF user-space coordinates. */
export function normalizedPointToPdfUserSpace(
  point: PdfDrawingNormalizedPoint,
  pageSize: PdfDrawingPageSize,
): { x: number; y: number } {
  const liteX = point.x * pageSize.widthPts
  const liteY = point.y * pageSize.heightPts
  return {
    x: liteX,
    y: pageSize.heightPts - liteY,
  }
}

function drawStrokeAnnotation(
  page: PDFPage,
  annotation: PdfDrawingAnnotation,
  geometry: PdfDrawingStrokeGeometry,
  pageSize: PdfDrawingPageSize,
): void {
  const color = annotationColor(annotation)
  const width = strokeWidthPt(annotation)
  const opacity = strokeOpacity(annotation)

  if (geometry.points.length === 0) return

  if (geometry.points.length === 1) {
    const center = normalizedPointToPdfUserSpace(geometry.points[0]!, pageSize)
    page.drawCircle({
      x: center.x,
      y: center.y,
      size: width,
      color,
      opacity,
      borderWidth: 0,
    })
    return
  }

  for (let index = 1; index < geometry.points.length; index += 1) {
    const start = normalizedPointToPdfUserSpace(geometry.points[index - 1]!, pageSize)
    const end = normalizedPointToPdfUserSpace(geometry.points[index]!, pageSize)
    page.drawLine({
      start,
      end,
      thickness: width,
      color,
      opacity,
      lineCap: 1,
    })
  }
}

function drawRectAnnotation(
  page: PDFPage,
  annotation: PdfDrawingAnnotation,
  geometry: PdfDrawingRectGeometry,
  pageSize: PdfDrawingPageSize,
): void {
  const pdfBbox = normalizedBoundsToPdfUserSpace(geometry, pageSize)
  page.drawRectangle({
    x: pdfBbox.x,
    y: pdfBbox.y,
    width: pdfBbox.width,
    height: pdfBbox.height,
    borderColor: annotationColor(annotation),
    borderWidth: strokeWidthPt(annotation),
    opacity: strokeOpacity(annotation),
  })
}

function drawEllipseAnnotation(
  page: PDFPage,
  annotation: PdfDrawingAnnotation,
  geometry: PdfDrawingEllipseGeometry,
  pageSize: PdfDrawingPageSize,
): void {
  const pdfBbox = normalizedBoundsToPdfUserSpace(geometry, pageSize)
  const centerX = pdfBbox.x + pdfBbox.width / 2
  const centerY = pdfBbox.y + pdfBbox.height / 2
  page.drawEllipse({
    x: centerX,
    y: centerY,
    xScale: pdfBbox.width / 2,
    yScale: pdfBbox.height / 2,
    borderColor: annotationColor(annotation),
    borderWidth: strokeWidthPt(annotation),
    opacity: strokeOpacity(annotation),
  })
}

function drawTextAnnotation(
  page: PDFPage,
  annotation: PdfDrawingAnnotation,
  geometry: PdfDrawingTextGeometry,
  pageSize: PdfDrawingPageSize,
  font: PDFFont,
): void {
  const label = annotation.text_body?.trim()
  if (!label) return

  const anchor = normalizedPointToPdfUserSpace(geometry, pageSize)
  const fontSize = DEFAULT_TEXT_PT
  const color = annotationColor(annotation)
  const opacity = strokeOpacity(annotation)

  page.drawText(toPdfLatinText(label), {
    x: anchor.x,
    y: anchor.y - fontSize,
    size: fontSize,
    font,
    color,
    opacity,
  })
}

function wrapPdfLatinText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const normalized = toPdfLatinText(text)
  if (!normalized) return []

  const words = normalized.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines
}

function drawVoiceNotationCallout(
  page: PDFPage,
  annotation: PdfDrawingAnnotation,
  pageSize: PdfDrawingPageSize,
  font: PDFFont,
  boldFont: PDFFont,
): void {
  const note = annotation.voice_note?.trim()
  if (!note) return

  const viewport: PdfDrawingViewportSize = {
    width: pageSize.widthPts,
    height: pageSize.heightPts,
  }
  const bounds = normalizedAnnotationMarqueeBounds(annotation, viewport)
  const mark = normalizedBoundsToPdfUserSpace(bounds, pageSize)
  const innerWidth = VOICE_NOTE_MAX_WIDTH_PT - VOICE_NOTE_PADDING_PT * 2
  const bodyLines = wrapPdfLatinText(note, font, VOICE_NOTE_FONT_PT, innerWidth)
  if (bodyLines.length === 0) return

  const title = 'Notation'
  const lineHeight = VOICE_NOTE_FONT_PT * 1.25
  const titleHeight = VOICE_NOTE_TITLE_PT + 3
  const boxWidth = VOICE_NOTE_MAX_WIDTH_PT
  const boxHeight =
    VOICE_NOTE_PADDING_PT * 2 + titleHeight + bodyLines.length * lineHeight
  const placeRight = mark.x + mark.width + VOICE_NOTE_GAP_PT + boxWidth <= pageSize.widthPts - 8
  const boxX = placeRight
    ? mark.x + mark.width + VOICE_NOTE_GAP_PT
    : Math.max(8, mark.x - VOICE_NOTE_GAP_PT - boxWidth)
  const boxY = Math.min(
    Math.max(8, mark.y + mark.height - boxHeight),
    pageSize.heightPts - boxHeight - 8,
  )

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: VOICE_NOTE_BG,
    borderColor: VOICE_NOTE_BORDER,
    borderWidth: 0.75,
  })

  const textX = boxX + VOICE_NOTE_PADDING_PT
  let cursorY = boxY + boxHeight - VOICE_NOTE_PADDING_PT - VOICE_NOTE_TITLE_PT
  page.drawText(title, {
    x: textX,
    y: cursorY,
    size: VOICE_NOTE_TITLE_PT,
    font: boldFont,
    color: VOICE_NOTE_TITLE,
  })
  cursorY -= titleHeight

  for (const line of bodyLines) {
    page.drawText(line, {
      x: textX,
      y: cursorY,
      size: VOICE_NOTE_FONT_PT,
      font,
      color: VOICE_NOTE_BODY,
    })
    cursorY -= lineHeight
  }
}

function stampSizePts(geometry: PdfDrawingStampGeometry, pageWidthPts: number): number {
  if (geometry.size != null && geometry.size > 0) {
    return geometry.size * pageWidthPts
  }
  return DEFAULT_STAMP_PT
}

function drawWindowStamp(
  page: PDFPage,
  annotation: PdfDrawingAnnotation,
  geometry: PdfDrawingStampGeometry,
  pageSize: PdfDrawingPageSize,
): void {
  if (geometry.stampKind !== 'window') return

  const center = normalizedPointToPdfUserSpace(geometry, pageSize)
  const sizePx = stampSizePts(geometry, pageSize.widthPts)
  const half = sizePx / 2
  const x = center.x - half
  const y = center.y - half
  const color = annotationColor(annotation)
  const borderWidth = annotation.stroke_width ?? DEFAULT_STAMP_STROKE_PT

  page.drawRectangle({
    x,
    y,
    width: sizePx,
    height: sizePx,
    borderColor: color,
    borderWidth,
  })

  page.drawLine({
    start: { x: x + half, y },
    end: { x: x + half, y: y + sizePx },
    thickness: borderWidth,
    color,
  })
  page.drawLine({
    start: { x, y: y + half },
    end: { x: x + sizePx, y: y + half },
    thickness: borderWidth,
    color,
  })
}

function drawAnnotationGraphic(
  page: PDFPage,
  annotation: PdfDrawingAnnotation,
  geometry: Exclude<PdfDrawingGeometry, PdfDrawingTextGeometry>,
  pageSize: PdfDrawingPageSize,
): void {
  switch (geometry.kind) {
    case 'stroke':
      drawStrokeAnnotation(page, annotation, geometry, pageSize)
      return
    case 'rect':
      drawRectAnnotation(page, annotation, geometry, pageSize)
      return
    case 'ellipse':
      drawEllipseAnnotation(page, annotation, geometry, pageSize)
      return
    case 'stamp':
      drawWindowStamp(page, annotation, geometry, pageSize)
      return
    default: {
      const _exhaustive: never = geometry
      return _exhaustive
    }
  }
}

/** Burn vector drawing marks onto a pdf-lib page (BDA-237). */
export function drawPdfDrawingAnnotationsOnPage(
  page: PDFPage,
  annotations: readonly PdfDrawingAnnotation[],
  options: DrawPdfDrawingAnnotationsOptions = {},
): void {
  if (annotations.length === 0) return

  const pageSize: PdfDrawingPageSize = {
    widthPts: page.getWidth(),
    heightPts: page.getHeight(),
  }

  const sorted = [...annotations].sort((left, right) =>
    left.created_at.localeCompare(right.created_at),
  )

  for (const annotation of sorted) {
    const geometry = annotation.geometry
    if (geometry.kind === 'text') {
      const label = annotation.text_body?.trim()
      if (label) {
        const font = options.boldFont ?? options.font
        if (!font) {
          throw new Error('drawPdfDrawingAnnotationsOnPage: font required for text marks')
        }
        drawTextAnnotation(page, annotation, geometry, pageSize, font)
      }
    } else {
      drawAnnotationGraphic(page, annotation, geometry, pageSize)
    }

    if (!annotation.voice_note?.trim()) continue
    const font = options.font
    const boldFont = options.boldFont ?? options.font
    if (!font || !boldFont) {
      throw new Error('drawPdfDrawingAnnotationsOnPage: font required for voice notation')
    }
    drawVoiceNotationCallout(page, annotation, pageSize, font, boldFont)
  }
}

/** Dev harness — single rect mark produces valid PDF bytes (BDA-237). */
export async function runPdfDrawingExportHarness(): Promise<void> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  drawPdfDrawingAnnotationsOnPage(
    page,
    [
      {
        annotation_id: 'pdf-draw-export-harness-rect',
        doc_id: 'harness-doc',
        page_num: 1,
        tool: 'rect',
        color: '#0EA5E9',
        stroke_width: 4,
        geometry: { kind: 'rect', x: 0.1, y: 0.2, width: 0.35, height: 0.12 },
        author_initials: 'HR',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        annotation_id: 'pdf-draw-export-harness-stamp',
        doc_id: 'harness-doc',
        page_num: 1,
        tool: 'stamp',
        color: '#0EA5E9',
        stroke_width: 2,
        geometry: { kind: 'stamp', x: 0.5, y: 0.5, stampKind: 'window' },
        voice_note: 'this is window 108',
        author_initials: 'HR',
        created_at: '2026-01-01T00:00:01.000Z',
      },
    ],
    { font, boldFont },
  )

  const bytes = await doc.save()
  if (bytes.byteLength < 900) {
    throw new Error('runPdfDrawingExportHarness failed: PDF output unexpectedly small')
  }

  const pdfText = new TextDecoder('latin1').decode(bytes)
  if (!pdfText.includes('re') && !pdfText.includes('S')) {
    throw new Error('runPdfDrawingExportHarness failed: expected vector operators in PDF')
  }
  if (!pdfText.includes('this is window 108') && !pdfText.includes('Notation')) {
    throw new Error('runPdfDrawingExportHarness failed: expected burned-in voice notation text')
  }

  const bounds = normalizedBoundsToPdfUserSpace(
    { x: 0.1, y: 0.2, width: 0.35, height: 0.12 },
    { widthPts: 612, heightPts: 792 },
  )
  if (bounds.width <= 0 || bounds.y < 0) {
    throw new Error('runPdfDrawingExportHarness failed: normalized bounds transform')
  }
}
