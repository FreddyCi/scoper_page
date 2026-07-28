import type { LiteParseTextItem } from '@/lib/liteparse-protocol'

const LINE_Y_TOLERANCE_RATIO = 0.55
/** Max normalized line gap to treat two lines as one wrapped paragraph. */
const WRAP_GAP_RATIO = 0.65
/** Allow slightly larger gaps only when the previous line clearly continues. */
const CONTINUATION_GAP_RATIO = 0.9
const MAX_HORIZONTAL_GAP_RATIO = 1.8
const MIN_HORIZONTAL_GAP_PTS = 6
/** Avoid page-sized blocks — split when a merged block would exceed this length. */
const MAX_BLOCK_CHARS = 420

function lineCenter(item: LiteParseTextItem): number {
  return item.y + item.height / 2
}

function compareReadingOrder(a: LiteParseTextItem, b: LiteParseTextItem): number {
  const yDiff = a.y - b.y
  const tolerance = Math.min(a.height, b.height, 1) * LINE_Y_TOLERANCE_RATIO
  if (Math.abs(yDiff) > tolerance) return yDiff
  return a.x - b.x
}

function sameLine(a: LiteParseTextItem, b: LiteParseTextItem): boolean {
  const lineHeight = Math.max(a.height, b.height, 1)
  return Math.abs(lineCenter(a) - lineCenter(b)) <= lineHeight * LINE_Y_TOLERANCE_RATIO
}

function shouldMergeHorizontally(a: LiteParseTextItem, b: LiteParseTextItem): boolean {
  const gap = b.x - (a.x + a.width)
  const lineHeight = Math.max(a.height, b.height, 1)
  if (gap < 0) return true
  return gap <= Math.max(MIN_HORIZONTAL_GAP_PTS, lineHeight * MAX_HORIZONTAL_GAP_RATIO)
}

function joinText(left: string, right: string): string {
  const trimmedLeft = left.trimEnd()
  const trimmedRight = right.trimStart()
  if (!trimmedLeft) return trimmedRight
  if (!trimmedRight) return trimmedLeft
  if (trimmedLeft.endsWith('-')) return `${trimmedLeft}${trimmedRight}`
  return `${trimmedLeft} ${trimmedRight}`
}

function unionBbox(a: LiteParseTextItem, b: LiteParseTextItem): Pick<
  LiteParseTextItem,
  'x' | 'y' | 'width' | 'height'
> {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  }
}

function combineItems(a: LiteParseTextItem, b: LiteParseTextItem): LiteParseTextItem {
  const bbox = unionBbox(a, b)
  const confidence =
    a.confidence != null && b.confidence != null
      ? (a.confidence + b.confidence) / 2
      : (a.confidence ?? b.confidence)

  return {
    text: joinText(a.text, b.text),
    ...bbox,
    ...(a.fontName || b.fontName
      ? { fontName: a.fontName ?? b.fontName }
      : {}),
    ...(a.fontSize != null || b.fontSize != null
      ? { fontSize: Math.max(a.fontSize ?? 0, b.fontSize ?? 0) || undefined }
      : {}),
    ...(confidence != null ? { confidence } : {}),
  }
}

function groupIntoLines(items: LiteParseTextItem[]): LiteParseTextItem[][] {
  const lines: LiteParseTextItem[][] = []
  let current: LiteParseTextItem[] = []

  for (const item of items) {
    if (current.length === 0) {
      current.push(item)
      continue
    }

    const last = current[current.length - 1]
    if (sameLine(last, item)) {
      current.push(item)
    } else {
      lines.push(current)
      current = [item]
    }
  }

  if (current.length > 0) lines.push(current)
  return lines
}

function mergeLineLeftToRight(lineItems: LiteParseTextItem[]): LiteParseTextItem[] {
  const sorted = [...lineItems].sort((a, b) => a.x - b.x)
  const segments: LiteParseTextItem[] = []
  let current = sorted[0]

  for (let index = 1; index < sorted.length; index += 1) {
    const next = sorted[index]
    if (shouldMergeHorizontally(current, next)) {
      current = combineItems(current, next)
    } else {
      segments.push(current)
      current = next
    }
  }

  segments.push(current)
  return segments
}

function endsWithSentenceBoundary(text: string): boolean {
  return /[.!?]["')\]]*\s*$/.test(text.trim())
}

function startsWithLowercase(text: string): boolean {
  return /^[a-z(["']/.test(text.trim())
}

function looksLikeContinuation(text: string): boolean {
  return /[,;:([-–—]\s*$/.test(text.trim())
}

function looksLikeHeading(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0 || trimmed.length > 90) return false
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true
  return /^(section|article|appendix|exhibit|schedule)\s+[\d.]+/i.test(trimmed)
}

function normalizedLineGap(prev: LiteParseTextItem, next: LiteParseTextItem): number {
  const gap = next.y - (prev.y + prev.height)
  const lineHeight = Math.max(prev.height, next.height, 12)
  return gap / lineHeight
}

function shouldMergeWrappedLines(prev: LiteParseTextItem, next: LiteParseTextItem): boolean {
  const prevText = prev.text.trim()
  const nextText = next.text.trim()
  if (!prevText || !nextText) return false

  if (prevText.length + nextText.length + 1 > MAX_BLOCK_CHARS) return false
  if (looksLikeHeading(prevText) || looksLikeHeading(nextText)) return false

  const gapRatio = normalizedLineGap(prev, next)

  if (gapRatio > CONTINUATION_GAP_RATIO) return false

  if (endsWithSentenceBoundary(prevText)) {
    return gapRatio <= 0.35 && startsWithLowercase(nextText)
  }

  if (gapRatio <= WRAP_GAP_RATIO) return true
  if (looksLikeContinuation(prevText) && gapRatio <= CONTINUATION_GAP_RATIO) return true

  return false
}

function mergeLineSegmentsIntoBlocks(segments: LiteParseTextItem[]): LiteParseTextItem[] {
  if (segments.length === 0) return []

  const sorted = [...segments].sort(compareReadingOrder)
  const blocks: LiteParseTextItem[] = []
  let current = sorted[0]

  for (let index = 1; index < sorted.length; index += 1) {
    const next = sorted[index]
    if (shouldMergeWrappedLines(current, next)) {
      current = combineItems(current, next)
    } else {
      blocks.push(current)
      current = next
    }
  }

  blocks.push(current)
  return blocks
}

/** Merge word/fragment-level text items into line- and paragraph-sized blocks. */
export function mergeTextItemsIntoBlocks(items: LiteParseTextItem[]): LiteParseTextItem[] {
  if (items.length <= 1) return items

  const sorted = [...items].sort(compareReadingOrder)
  const lines = groupIntoLines(sorted)
  const lineSegments = lines.flatMap(mergeLineLeftToRight)
  return mergeLineSegmentsIntoBlocks(lineSegments)
}
