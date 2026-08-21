import { PROPOSAL_SECTION_HINT } from '@/services/build-proposal-rfp-profile'
import type { BlockRecord, RfpInstructionField } from '@/lib/types'
import { blockToCitation } from '@/lib/types'

const DUE_LINE =
  /\b(proposals?\s+(?:are\s+)?due|proposal\s+due|due\s+date|closing\s+date|submit(?:tal)?s?\s+(?:by|no\s+later\s+than)|must\s+be\s+received\s+by)\b/i

const HAS_DATE =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december))\b/i

const QA_LINE =
  /\b(q\s*&\s*a|questions?\s+due|question\s+submittal\s+deadline|inquiries?\s+due|written\s+questions?\s+(?:are\s+)?due)\b/i

const PAGE_LIMIT =
  /\b(not\s+to\s+exceed|page\s+limit|limited\s+to|maximum\s+of)\s+(\d+)\s+pages?\b/i

const VOLUME_HEADING =
  /\b(volume\s+(?:[ivxlcdm]+|\d+)|section\s+l)\b[^\n]{0,100}/i

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}/

export type RfpInstructionsExtract = {
  dueDate?: RfpInstructionField
  questionsDue?: RfpInstructionField
  pageLimit?: RfpInstructionField
  volumes: RfpInstructionField[]
  block_ids: string[]
  summary: string
}

function collapseWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => collapseWs(part))
    .filter((part) => part.length > 0)
}

function blockScore(block: BlockRecord, pattern: RegExp): number {
  if (!pattern.test(block.text)) return 0
  let score = 1
  if (PROPOSAL_SECTION_HINT.test(block.text)) score += 2
  if (HAS_DATE.test(block.text) && (DUE_LINE.test(block.text) || QA_LINE.test(block.text))) {
    score += 1
  }
  return score
}

function bestBlock(blocks: BlockRecord[], pattern: RegExp): BlockRecord | null {
  let best: BlockRecord | null = null
  let bestScore = 0
  for (const block of blocks) {
    const score = blockScore(block, pattern)
    if (score > bestScore) {
      best = block
      bestScore = score
    }
  }
  return bestScore > 0 ? best : null
}

function sentenceMatching(block: BlockRecord, pattern: RegExp): string {
  const matched = splitSentences(block.text).find((sentence) => pattern.test(sentence))
  return collapseWs(matched ?? block.text).slice(0, 280)
}

function fieldFromBlock(
  block: BlockRecord,
  label: string,
  value: string,
): RfpInstructionField {
  return {
    label,
    value,
    citation: blockToCitation(block, value.slice(0, 280)),
  }
}

function collectVolumeHeadings(blocks: BlockRecord[]): RfpInstructionField[] {
  const seen = new Set<string>()
  const volumes: RfpInstructionField[] = []

  for (const block of blocks) {
    if (!VOLUME_HEADING.test(block.text)) continue
    const sentence = sentenceMatching(block, VOLUME_HEADING)
    const key = sentence.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    volumes.push(fieldFromBlock(block, 'Volume', sentence))
    if (volumes.length >= 8) break
  }

  return volumes
}

function collectBlockIds(fields: Array<RfpInstructionField | undefined>): string[] {
  const ids = new Set<string>()
  for (const field of fields) {
    const blockId = field?.citation?.block_id
    if (blockId) ids.add(blockId)
  }
  return [...ids]
}

/**
 * Heuristic instructions extract from baseline blocks. Values are source excerpts — never ISO dates.
 */
export function extractRfpInstructions(blocks: BlockRecord[]): RfpInstructionsExtract {
  let dueDate: RfpInstructionField | undefined
  const dueBlock = bestBlock(blocks, DUE_LINE)
  if (dueBlock && HAS_DATE.test(dueBlock.text)) {
    dueDate = fieldFromBlock(dueBlock, 'Due date', sentenceMatching(dueBlock, DUE_LINE))
  }

  let questionsDue: RfpInstructionField | undefined
  const qaBlock = bestBlock(blocks, QA_LINE)
  if (qaBlock) {
    questionsDue = fieldFromBlock(qaBlock, 'Questions due', sentenceMatching(qaBlock, QA_LINE))
  }

  let pageLimit: RfpInstructionField | undefined
  for (const block of blocks) {
    const match = block.text.match(PAGE_LIMIT)
    if (!match) continue
    const value = collapseWs(match[0])
    pageLimit = fieldFromBlock(block, 'Page limit', value)
    break
  }

  const volumes = collectVolumeHeadings(blocks)
  const block_ids = collectBlockIds([dueDate, questionsDue, pageLimit, ...volumes])

  const foundCount =
    (dueDate ? 1 : 0) + (questionsDue ? 1 : 0) + (pageLimit ? 1 : 0) + volumes.length

  return {
    ...(dueDate ? { dueDate } : {}),
    ...(questionsDue ? { questionsDue } : {}),
    ...(pageLimit ? { pageLimit } : {}),
    volumes,
    block_ids,
    summary:
      foundCount === 0
        ? 'No solicitation instruction fields found'
        : `${foundCount} instruction field${foundCount === 1 ? '' : 's'} extracted from baseline`,
  }
}

function fixtureBlock(
  block_id: string,
  text: string,
  doc_id = 'rfp-instructions-harness',
  page_num = 1,
): BlockRecord {
  return { block_id, doc_id, page_num, text }
}

/** Dev harness — due + page limit extract, no invented dates (BDA-267). */
export function runExtractRfpInstructionsHarness(): void {
  const extracted = extractRfpInstructions([
    fixtureBlock(
      'inst-due',
      'Section L Instructions to Offerors. Proposals are due March 1, 2026 at 2:00 PM local time.',
      'rfp-instructions-harness',
      2,
    ),
    fixtureBlock(
      'inst-pages',
      'Technical Volume I shall not to exceed 15 pages excluding cover sheets.',
      'rfp-instructions-harness',
      4,
    ),
    fixtureBlock('inst-vol', 'Volume II Cost Proposal pricing tables.', 'rfp-instructions-harness', 5),
  ])

  if (!extracted.dueDate?.value.includes('March 1')) {
    throw new Error('runExtractRfpInstructionsHarness: missing due date phrase')
  }
  if (extracted.dueDate.citation?.block_id !== 'inst-due') {
    throw new Error('runExtractRfpInstructionsHarness: due date citation mismatch')
  }
  if (!extracted.pageLimit?.value.match(/15\s+pages?/i)) {
    throw new Error('runExtractRfpInstructionsHarness: missing page limit')
  }
  if (extracted.pageLimit.citation?.block_id !== 'inst-pages') {
    throw new Error('runExtractRfpInstructionsHarness: page limit citation mismatch')
  }
  if (extracted.volumes.length === 0) {
    throw new Error('runExtractRfpInstructionsHarness: expected volume headings')
  }
  if (!extracted.block_ids.includes('inst-due') || !extracted.block_ids.includes('inst-pages')) {
    throw new Error('runExtractRfpInstructionsHarness: block_ids missing cited blocks')
  }

  const empty = extractRfpInstructions([
    fixtureBlock('empty-1', 'General background information about the agency mission.'),
  ])
  if (empty.dueDate || empty.questionsDue || empty.pageLimit) {
    throw new Error('runExtractRfpInstructionsHarness: sparse doc should not invent fields')
  }
  for (const field of [empty.dueDate, empty.questionsDue, empty.pageLimit, ...empty.volumes]) {
    if (field && ISO_DATE_ONLY.test(field.value.trim())) {
      throw new Error('runExtractRfpInstructionsHarness: fabricated ISO date in extract')
    }
  }
}
