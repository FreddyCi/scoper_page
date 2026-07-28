import type { Bbox, BlockRecord } from '@/lib/types'

export function blockHasBbox(block: BlockRecord): block is BlockRecord & Bbox {
  return (
    block.x != null &&
    block.y != null &&
    block.width != null &&
    block.height != null &&
    block.width > 0 &&
    block.height > 0
  )
}

export function bboxOverlapArea(a: Bbox, b: Bbox): number {
  const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return overlapWidth * overlapHeight
}

export function bboxContainsPoint(bbox: Bbox, x: number, y: number): boolean {
  return x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height
}

export function bboxCenter(bbox: Bbox): { x: number; y: number } {
  return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 }
}

export function blockIncludedInRegion(block: BlockRecord & Bbox, region: Bbox, seedBlockId?: string): boolean {
  if (seedBlockId && block.block_id === seedBlockId) return true

  const blockArea = block.width * block.height
  const overlap = bboxOverlapArea(block, region)
  if (blockArea > 0 && overlap / blockArea >= 0.12) return true

  const center = bboxCenter(block)
  return bboxContainsPoint(region, center.x, center.y)
}

export function normalizeBbox(bbox: Bbox, minWidth = 8, minHeight = 8): Bbox {
  return {
    x: bbox.x,
    y: bbox.y,
    width: Math.max(minWidth, bbox.width),
    height: Math.max(minHeight, bbox.height),
  }
}

export function compareBlocksReadingOrder(a: BlockRecord, b: BlockRecord): number {
  const pageA = a.page_num ?? 0
  const pageB = b.page_num ?? 0
  if (pageA !== pageB) return pageA - pageB

  const yA = a.y ?? 0
  const yB = b.y ?? 0
  if (Math.abs(yA - yB) > 2) return yA - yB

  return (a.x ?? 0) - (b.x ?? 0)
}

export function joinBlockText(left: string, right: string): string {
  const trimmedLeft = left.trimEnd()
  const trimmedRight = right.trimStart()
  if (!trimmedLeft) return trimmedRight
  if (!trimmedRight) return trimmedLeft
  if (trimmedLeft.endsWith('-')) return `${trimmedLeft}${trimmedRight}`
  return `${trimmedLeft} ${trimmedRight}`
}

export function mergeBlockText(blocks: BlockRecord[]): string {
  return blocks.reduce((text, block) => joinBlockText(text, block.text), '').trim()
}

export function unionBlockBboxes(blocks: Array<BlockRecord & Bbox>): Bbox {
  const x = Math.min(...blocks.map((block) => block.x))
  const y = Math.min(...blocks.map((block) => block.y))
  const right = Math.max(...blocks.map((block) => block.x + block.width))
  const bottom = Math.max(...blocks.map((block) => block.y + block.height))
  return { x, y, width: right - x, height: bottom - y }
}
