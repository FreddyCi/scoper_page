import type { LiteParsePageResult, LiteParseParseResult, LiteParseTextItem } from '@/lib/liteparse-protocol'
import { mergeTextItemsIntoBlocks } from '@/lib/text-item-merge'
import type { BlockRecord } from '@/lib/types'

type RawTextItem = {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontName?: string
  fontSize?: number
  confidence?: number
}

type RawPage = {
  pageNum: number
  width: number
  height: number
  textItems: RawTextItem[]
}

function normalizeTextItem(item: RawTextItem): LiteParseTextItem | null {
  const text = item.text.trim()
  if (!text) return null

  return {
    text,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    ...(item.fontName ? { fontName: item.fontName } : {}),
    ...(item.fontSize !== undefined ? { fontSize: item.fontSize } : {}),
    ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
  }
}

export function textItemsToBlocks(
  docId: string,
  pageNum: number,
  textItems: LiteParseTextItem[],
): BlockRecord[] {
  return textItems.map((item, index) => ({
    block_id: `${docId}:p${pageNum}:i${index}`,
    doc_id: docId,
    page_num: pageNum,
    text: item.text,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
  }))
}

export function buildParseResultFromPages(
  docId: string,
  pages: LiteParsePageResult[],
  text: string,
): LiteParseParseResult {
  const blocks = pages.flatMap((page) => textItemsToBlocks(docId, page.pageNum, page.textItems))

  return { pages, blocks, text }
}

export function normalizeLiteParseResult(
  docId: string,
  rawPages: RawPage[],
  text: string,
): LiteParseParseResult {
  const pages: LiteParsePageResult[] = rawPages.map((page) => {
    const textItems = mergeTextItemsIntoBlocks(
      page.textItems
        .map(normalizeTextItem)
        .filter((item): item is LiteParseTextItem => item !== null),
    )

    return {
      pageNum: page.pageNum,
      width: page.width,
      height: page.height,
      textItems,
    }
  })

  return buildParseResultFromPages(
    docId,
    pages,
    text ||
      pages
        .flatMap((page) => page.textItems.map((item) => item.text))
        .join('\n'),
  )
}
