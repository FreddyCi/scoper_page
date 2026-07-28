import type { PageViewport } from 'pdfjs-dist'

import type { Bbox, CitationRef } from '@/lib/types'

/** Stored block bboxes — LiteParse convention: origin top-left, y increases down, PDF points (1/72 in). */
export const LITEPARSE_BBOX_DPI = 72

export type ViewportHighlightRect = {
  left: number
  top: number
  width: number
  height: number
}

/** Convert PDF user space bbox back to LiteParse top-left page coordinates. */
export function pdfUserSpaceToLiteParseBbox(bbox: Bbox, pageHeightPts: number): Bbox {
  return {
    x: bbox.x,
    y: pageHeightPts - bbox.y - bbox.height,
    width: bbox.width,
    height: bbox.height,
  }
}

/** Convert a top-left page bbox to PDF user space for PDF.js viewport helpers. */
export function liteParseBboxToPdfUserSpace(bbox: Bbox, pageHeightPts: number): Bbox {
  return {
    x: bbox.x,
    y: pageHeightPts - bbox.y - bbox.height,
    width: bbox.width,
    height: bbox.height,
  }
}

/** Map a stored block bbox to canvas viewport pixels at the current render scale. */
export function bboxToViewportHighlight(
  bbox: Bbox,
  viewport: PageViewport,
): ViewportHighlightRect {
  const pageHeightPts = viewport.height / viewport.scale
  const pdfBbox = liteParseBboxToPdfUserSpace(bbox, pageHeightPts)
  const [left, top, right, bottom] = viewport.convertToViewportRectangle([
    pdfBbox.x,
    pdfBbox.y,
    pdfBbox.x + pdfBbox.width,
    pdfBbox.y + pdfBbox.height,
  ])

  return {
    left: Math.min(left, right),
    top: Math.min(top, bottom),
    width: Math.abs(right - left),
    height: Math.abs(bottom - top),
  }
}

export function citationViewportHighlight(
  citation: CitationRef | null | undefined,
  pageNumber: number,
  viewport: PageViewport,
): ViewportHighlightRect | null {
  if (!citation?.bbox || citation.page_num !== pageNumber) return null
  return bboxToViewportHighlight(citation.bbox, viewport)
}

/** Map viewport pixel rect back to stored LiteParse bbox coordinates. */
export function viewportRectToLiteParseBbox(
  rect: ViewportHighlightRect,
  viewport: PageViewport,
): Bbox {
  const pageHeightPts = viewport.height / viewport.scale
  const [x1, y1] = viewport.convertToPdfPoint(rect.left, rect.top)
  const [x2, y2] = viewport.convertToPdfPoint(rect.left + rect.width, rect.top + rect.height)
  const pdfBbox = {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
  return pdfUserSpaceToLiteParseBbox(pdfBbox, pageHeightPts)
}

/** Render scale matching a target DPI relative to PDF points (72 dpi). */
export function pdfRenderScaleForDpi(dpi = LITEPARSE_BBOX_DPI): number {
  return dpi / 72
}
