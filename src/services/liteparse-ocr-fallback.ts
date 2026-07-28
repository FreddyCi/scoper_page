/**
 * Browser-safe OCR for scanned PDFs — LiteParse's built-in OCR merge requires a
 * Tokio runtime and panics in WASM, so we render pages with PDF.js and run
 * Tesseract on the main thread instead.
 */
import { normalizeLiteParseResult } from '@/lib/liteparse-normalize'
import type { LiteParseParseResult, LiteParseTextItem } from '@/lib/liteparse-protocol'
import { countPdfPages, renderPdfPage } from '@/lib/pdf-page-render'
import type { OcrRecognitionResult } from '@/lib/ocr-protocol'
import { recognizeImageSource } from '@/services/ocr-main'

function ocrResultsToTextItems(
  results: OcrRecognitionResult[],
  pdfWidth: number,
  pdfHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): LiteParseTextItem[] {
  const scaleX = pdfWidth / viewportWidth
  const scaleY = pdfHeight / viewportHeight
  const items: LiteParseTextItem[] = []

  for (const result of results) {
    const text = result.text.trim()
    if (!text) continue

    const [x1, y1, x2, y2] = result.bbox
    items.push({
      text,
      x: x1 * scaleX,
      y: y1 * scaleY,
      width: (x2 - x1) * scaleX,
      height: (y2 - y1) * scaleY,
      confidence: result.confidence,
    })
  }

  return items
}

export async function parsePdfWithOcrFallback(
  docId: string,
  bytes: Uint8Array,
  pageNumbers?: number[],
  dpi = 150,
): Promise<LiteParseParseResult> {
  const totalPages = await countPdfPages(bytes)
  const targets =
    pageNumbers && pageNumbers.length > 0
      ? pageNumbers.filter((pageNum) => pageNum >= 1 && pageNum <= totalPages)
      : Array.from({ length: totalPages }, (_, index) => index + 1)

  const rawPages = []
  const textParts: string[] = []

  for (const pageNum of targets) {
    const rendered = await renderPdfPage(bytes, pageNum, dpi)
    const ocrResults = await recognizeImageSource(rendered.canvas)
    const textItems = ocrResultsToTextItems(
      ocrResults,
      rendered.pdfWidth,
      rendered.pdfHeight,
      rendered.canvas.width,
      rendered.canvas.height,
    )

    rawPages.push({
      pageNum,
      width: rendered.pdfWidth,
      height: rendered.pdfHeight,
      textItems,
    })
    textParts.push(textItems.map((item) => item.text).join(' '))
  }

  return normalizeLiteParseResult(docId, rawPages, textParts.join('\n'))
}
