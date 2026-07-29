import { sortBlocksReadingOrder } from '@/lib/bbox-utils'
import { getDuckdbClient } from '@/services/duckdb-client'
import type { BlockRecord } from '@/lib/types'

type BlockRow = {
  block_id: string
  doc_id: string
  page_num: number | null
  section_path: string | null
  text: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
}

function normalizeBlock(row: BlockRow): BlockRecord {
  const block: BlockRecord = {
    block_id: row.block_id,
    doc_id: row.doc_id,
    text: row.text,
  }

  if (row.page_num != null) block.page_num = row.page_num
  if (row.section_path != null) block.section_path = row.section_path
  if (row.x != null) block.x = row.x
  if (row.y != null) block.y = row.y
  if (row.width != null) block.width = row.width
  if (row.height != null) block.height = row.height

  return block
}

export async function fetchDocumentBlocks(docId: string): Promise<BlockRecord[]> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<BlockRow>(
    `SELECT block_id, doc_id, page_num, section_path, text, x, y, width, height
     FROM blocks
     WHERE doc_id = ?
     ORDER BY page_num NULLS LAST, y NULLS LAST, x NULLS LAST, block_id`,
    [docId],
  )

  return sortBlocksReadingOrder(rows.map(normalizeBlock))
}

export async function fetchBlockById(blockId: string): Promise<BlockRecord | null> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<BlockRow>(
    `SELECT block_id, doc_id, page_num, section_path, text, x, y, width, height
     FROM blocks
     WHERE block_id = ?
     LIMIT 1`,
    [blockId],
  )

  const row = rows[0]
  return row ? normalizeBlock(row) : null
}

export type BlocksByPage = {
  pageNum: number | null
  label: string
  blocks: BlockRecord[]
}

export function groupBlocksByPage(blocks: BlockRecord[]): BlocksByPage[] {
  const groups = new Map<string, BlocksByPage>()

  for (const block of blocks) {
    const key = block.page_num == null ? 'none' : String(block.page_num)
    const existing = groups.get(key)

    if (existing) {
      existing.blocks.push(block)
      continue
    }

    groups.set(key, {
      pageNum: block.page_num ?? null,
      label: block.page_num == null ? 'Unpaged' : `Page ${block.page_num}`,
      blocks: [block],
    })
  }

  for (const group of groups.values()) {
    group.blocks = sortBlocksReadingOrder(group.blocks)
  }

  return [...groups.values()].sort((left, right) => {
    if (left.pageNum == null) return 1
    if (right.pageNum == null) return -1
    return left.pageNum - right.pageNum
  })
}

export function groupBlocksBySection(blocks: BlockRecord[]): BlocksByPage[] {
  const groups = new Map<string, BlocksByPage>()

  for (const block of blocks) {
    const section = block.section_path?.trim() || 'Document'
    const existing = groups.get(section)

    if (existing) {
      existing.blocks.push(block)
      continue
    }

    groups.set(section, {
      pageNum: null,
      label: section,
      blocks: [block],
    })
  }

  for (const group of groups.values()) {
    group.blocks = sortBlocksReadingOrder(group.blocks)
  }

  return [...groups.values()]
}

function isPdfPageSectionLabel(label: string): boolean {
  return /^page \d+$/i.test(label.trim())
}

/** Read view for markdown — section headings only, never PDF-style page groups. */
export function groupBlocksForMarkdownRead(blocks: BlockRecord[]): BlocksByPage[] {
  if (blocks.length === 0) return []

  const hasMeaningfulSections = blocks.some(
    (block) => block.section_path?.trim() && !isPdfPageSectionLabel(block.section_path),
  )

  if (!hasMeaningfulSections) {
    return [
      {
        pageNum: null,
        label: 'Document',
        blocks: sortBlocksReadingOrder([...blocks]),
      },
    ]
  }

  const groups = groupBlocksBySection(blocks).map((group) =>
    isPdfPageSectionLabel(group.label) ? { ...group, label: 'Document' } : group,
  )

  const merged = new Map<string, BlocksByPage>()
  for (const group of groups) {
    const existing = merged.get(group.label)
    if (existing) {
      existing.blocks.push(...group.blocks)
      existing.blocks = sortBlocksReadingOrder(existing.blocks)
      continue
    }
    merged.set(group.label, { ...group, blocks: [...group.blocks] })
  }

  return [...merged.values()]
}

export function groupBlocksForDisplay(blocks: BlockRecord[]): BlocksByPage[] {
  const hasSections = blocks.some((block) => block.section_path?.trim())
  const hasPages = blocks.some((block) => block.page_num != null)

  if (hasSections && !hasPages) {
    return groupBlocksBySection(blocks)
  }

  return groupBlocksByPage(blocks)
}
