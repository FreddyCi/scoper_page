import type { TextItem } from 'pdfjs-dist/types/src/display/api'

import type { LiteParseTextItem } from '@/lib/liteparse-protocol'
import { loadPdfDocument, pdfjs } from '@/lib/pdfjs-viewer'

function isTextItem(item: TextItem | { type: string }): item is TextItem {
  return 'str' in item
}

/** Extract positioned text runs from a PDF page (LiteParse top-left coordinates). */
export async function extractPdfPageTextItems(
  bytes: Uint8Array,
  pageNum: number,
): Promise<LiteParseTextItem[]> {
  const pdf = await loadPdfDocument(bytes)
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1 })
  const textContent = await page.getTextContent()

  const items: LiteParseTextItem[] = []

  for (const raw of textContent.items) {
    if (!isTextItem(raw)) continue

    const text = raw.str.trim()
    if (!text) continue

    const tx = pdfjs.Util.transform(viewport.transform, raw.transform)
    const fontHeight = Math.hypot(tx[2], tx[3]) || raw.height || 12
    const x = tx[4]
    const y = tx[5] - fontHeight
    const width = raw.width || Math.max(Math.hypot(tx[0], tx[1]) * text.length * 0.45, 1)

    items.push({
      text,
      x,
      y,
      width: Math.max(width, 1),
      height: Math.max(fontHeight, 1),
      fontName: raw.fontName,
    })
  }

  return items
}
