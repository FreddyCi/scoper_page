import {
  blockAffectedByRegion,
  blockHasBbox,
  bboxOverlapArea,
  clipBlockTextByRegion,
  clipBlockTextOutsideRegion,
  compareBlocksReadingOrder,
  mergeBlockText,
  normalizeBbox,
  sortBlocksReadingOrder,
} from '@/lib/bbox-utils'
import type { LiteParseTextItem } from '@/lib/liteparse-protocol'
import { mergeTextItemsIntoBlocks } from '@/lib/text-item-merge'
import type { Bbox, BlockRecord } from '@/lib/types'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { getDuckdbClient } from '@/services/duckdb-client'
import { extractPdfPageTextItems } from '@/services/pdf-page-text-items'

function createAdjustedBlockId(docId: string, pageNum: number): string {
  return `${docId}:p${pageNum}:a${crypto.randomUUID().slice(0, 8)}`
}

function createResidualBlockId(docId: string, pageNum: number): string {
  return `${docId}:p${pageNum}:r${crypto.randomUUID().slice(0, 8)}`
}

function notifyBlocksChanged(docId: string) {
  window.dispatchEvent(
    new CustomEvent('scoper:blocks-changed', {
      detail: { docId },
    }),
  )
}

function textItemKey(item: LiteParseTextItem): string {
  return `${item.x.toFixed(2)}:${item.y.toFixed(2)}:${item.text}`
}

function textItemsInRegion(items: LiteParseTextItem[], region: Bbox): LiteParseTextItem[] {
  return items.filter((item) => bboxOverlapArea(item, region) > 0)
}

function textItemsOutsideRegion(items: LiteParseTextItem[], region: Bbox): LiteParseTextItem[] {
  return items.filter((item) => bboxOverlapArea(item, region) <= 0)
}

function textItemsInBlock(items: LiteParseTextItem[], block: BlockRecord & Bbox): LiteParseTextItem[] {
  return items.filter((item) => bboxOverlapArea(item, block) > 0)
}

function residualBbox(block: BlockRecord & Bbox, region: Bbox): Bbox | null {
  const aboveHeight = Math.max(0, region.y - block.y)
  const belowTop = region.y + region.height
  const belowHeight = Math.max(0, block.y + block.height - belowTop)

  if (aboveHeight >= belowHeight && aboveHeight > 0) {
    return { x: block.x, y: block.y, width: block.width, height: aboveHeight }
  }
  if (belowHeight > 0) {
    return { x: block.x, y: belowTop, width: block.width, height: belowHeight }
  }
  return null
}

function textItemsToBlockRecords(
  docId: string,
  pageNum: number,
  items: LiteParseTextItem[],
  createId: () => string,
  sectionPath?: string,
): BlockRecord[] {
  return mergeTextItemsIntoBlocks(items).map((item) => {
    const block: BlockRecord = {
      block_id: createId(),
      doc_id: docId,
      page_num: pageNum,
      text: item.text.trim(),
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    }
    if (sectionPath) block.section_path = sectionPath
    return block
  })
}

function fallbackRegionText(affected: Array<BlockRecord & Bbox>, region: Bbox): string {
  return mergeBlockText(
    affected
      .map((block) => ({
        ...block,
        text: clipBlockTextByRegion(block, region),
      }))
      .filter((block) => block.text.length > 0),
  )
}

function fallbackResidualBlocks(
  docId: string,
  pageNum: number,
  affected: Array<BlockRecord & Bbox>,
  region: Bbox,
): BlockRecord[] {
  const blocks: BlockRecord[] = []

  for (const block of affected) {
    const outsideText = clipBlockTextOutsideRegion(block, region)
    if (!outsideText) continue

    const bbox = residualBbox(block, region)
    if (!bbox) continue

    blocks.push({
      block_id: createResidualBlockId(docId, pageNum),
      doc_id: docId,
      page_num: pageNum,
      text: outsideText,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      ...(block.section_path ? { section_path: block.section_path } : {}),
    })
  }

  return blocks
}

/** Merge blocks overlapping a PDF region into one new block (drag-to-adjust). */
export async function redefineBlockRegion(options: {
  docId: string
  pageNum: number
  bbox: Bbox
  seedBlockId?: string
}): Promise<BlockRecord> {
  const region = normalizeBbox(options.bbox)
  const allBlocks = await fetchDocumentBlocks(options.docId)
  const pageBlocks = allBlocks.filter(
    (block): block is BlockRecord & Bbox =>
      block.page_num === options.pageNum && blockHasBbox(block),
  )

  const affected = pageBlocks
    .filter((block) => blockAffectedByRegion(block, region, options.seedBlockId))
    .sort(compareBlocksReadingOrder)

  if (affected.length === 0) {
    throw new Error('Adjusted region does not overlap any extract blocks on this page.')
  }

  const pdfBytes = getDocumentBytes(options.docId)
  let regionText = ''
  let residualBlocks: BlockRecord[] = []

  if (pdfBytes) {
    const pageItems = await extractPdfPageTextItems(pdfBytes, options.pageNum)
    const regionItems = textItemsInRegion(pageItems, region)
    const regionChunks = mergeTextItemsIntoBlocks(regionItems)
    regionText = mergeBlockText(
      regionChunks.map((item) => ({
        block_id: 'region',
        doc_id: options.docId,
        text: item.text,
      })),
    )

    const usedOutsideKeys = new Set<string>()
    for (const block of affected) {
      const outsideItems = textItemsOutsideRegion(textItemsInBlock(pageItems, block), region).filter(
        (item) => {
          const key = textItemKey(item)
          if (usedOutsideKeys.has(key)) return false
          usedOutsideKeys.add(key)
          return true
        },
      )

      if (outsideItems.length === 0) continue

      residualBlocks.push(
        ...textItemsToBlockRecords(
          options.docId,
          options.pageNum,
          outsideItems,
          () => createResidualBlockId(options.docId, options.pageNum),
          block.section_path,
        ),
      )
    }
  }

  if (!regionText) {
    regionText = fallbackRegionText(affected, region)
  }

  if (!regionText) {
    throw new Error('Adjusted region has no readable text to keep.')
  }

  const hasOutsideText = affected.some(
    (block) => clipBlockTextOutsideRegion(block, region).length > 0,
  )
  if (residualBlocks.length === 0 && hasOutsideText) {
    residualBlocks = fallbackResidualBlocks(options.docId, options.pageNum, affected, region)
  }

  const sectionPath = affected.find((block) => block.section_path)?.section_path
  const newBlock: BlockRecord = {
    block_id: createAdjustedBlockId(options.docId, options.pageNum),
    doc_id: options.docId,
    page_num: options.pageNum,
    text: regionText,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  }
  if (sectionPath) newBlock.section_path = sectionPath

  const duckdb = await getDuckdbClient()
  const replacedIds = affected.map((block) => block.block_id)

  await duckdb.insertBlock(newBlock)

  for (const residualBlock of sortBlocksReadingOrder(residualBlocks)) {
    await duckdb.insertBlock(residualBlock)
  }

  for (const oldBlockId of replacedIds) {
    await duckdb.query('UPDATE comments SET block_id = ? WHERE block_id = ?', [
      newBlock.block_id,
      oldBlockId,
    ])
    await duckdb.query('DELETE FROM blocks WHERE block_id = ?', [oldBlockId])
  }

  notifyBlocksChanged(options.docId)
  window.dispatchEvent(
    new CustomEvent('scoper:comments-imported', {
      detail: { docId: options.docId },
    }),
  )

  return newBlock
}
