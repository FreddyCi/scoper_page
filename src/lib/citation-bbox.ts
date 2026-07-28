import type { PageViewport } from 'pdfjs-dist'

import type { Bbox, CitationRef } from '@/lib/types'

/** LiteParse block bboxes are PDF user-space points (1/72 inch). */
export const LITEPARSE_BBOX_DPI = 72

export type ViewportHighlightRect = {
  left: number
  top: number
  width: number
  height: number
}

/** Map a PDF-user-space bbox to canvas viewport pixels at the current render scale. */
export function bboxToViewportHighlight(
  bbox: Bbox,
  viewport: PageViewport,
): ViewportHighlightRect {
  const [left, top, right, bottom] = viewport.convertToViewportRectangle([
    bbox.x,
    bbox.y,
    bbox.x + bbox.width,
    bbox.y + bbox.height,
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

/** Render scale matching a target DPI relative to PDF points (72 dpi). */
export function pdfRenderScaleForDpi(dpi = LITEPARSE_BBOX_DPI): number {
  return dpi / 72
}
