import {
  blockHasBbox,
  blockIncludedInRegion,
  compareBlocksReadingOrder,
  mergeBlockText,
  normalizeBbox,
} from '@/lib/bbox-utils'
import type { Bbox, BlockRecord } from '@/lib/types'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import { getDuckdbClient } from '@/services/duckdb-client'

function createAdjustedBlockId(docId: string, pageNum: number): string {
  return `${docId}:p${pageNum}:a${crypto.randomUUID().slice(0, 8)}`
}

function notifyBlocksChanged(docId: string) {
  window.dispatchEvent(
    new CustomEvent('scoper:blocks-changed', {
      detail: { docId },
    }),
  )
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

  const included = pageBlocks
    .filter((block) => blockIncludedInRegion(block, region, options.seedBlockId))
    .sort(compareBlocksReadingOrder)

  if (included.length === 0) {
    throw new Error('Adjusted region does not overlap any extract blocks on this page.')
  }

  const mergedText = mergeBlockText(included)
  if (!mergedText) {
    throw new Error('Adjusted region has no readable text to keep.')
  }

  const sectionPath = included.find((block) => block.section_path)?.section_path
  const newBlock: BlockRecord = {
    block_id: createAdjustedBlockId(options.docId, options.pageNum),
    doc_id: options.docId,
    page_num: options.pageNum,
    text: mergedText,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  }
  if (sectionPath) newBlock.section_path = sectionPath

  const duckdb = await getDuckdbClient()
  const replacedIds = included.map((block) => block.block_id)

  await duckdb.insertBlock(newBlock)

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
