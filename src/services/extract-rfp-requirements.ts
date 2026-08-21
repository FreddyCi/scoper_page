import { countObligationMatches, hasObligation } from '@/lib/obligation-pattern'
import type { BlockRecord, RfpRequirement, RfpRequirementsExtract } from '@/lib/types'
import { blockToCitation } from '@/lib/types'

/** Matches unused `rfpRequirementsResponseSchema` maxItems — heuristic cap, not LLM. */
export const RFP_REQUIREMENTS_MAX = 48

const MIN_REQUIREMENT_CHARS = 24

type RequirementCandidate = {
  label: string
  sourceBlock: BlockRecord
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

function isTocOrHeadingNoise(text: string): boolean {
  const trimmed = collapseWs(text)
  if (trimmed.length < MIN_REQUIREMENT_CHARS) return true
  if (/table\s+of\s+contents/i.test(trimmed) && trimmed.length < 80) return true
  if (/[.·…]{3,}/.test(trimmed)) return true
  if (
    trimmed.length < 60 &&
    !/[.?!]/.test(trimmed) &&
    /^(section|article|part|volume|exhibit|attachment|appendix)\b/i.test(trimmed)
  ) {
    return true
  }
  return false
}

function normalizeForDedupe(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isNearDuplicate(left: string, right: string): boolean {
  const a = normalizeForDedupe(left)
  const b = normalizeForDedupe(right)
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

/** Score blocks like `findMatchingBlock` — prefer the block that contains the sentence. */
function findCitationBlock(blocks: BlockRecord[], sentence: string): BlockRecord | null {
  const needle = sentence.toLowerCase()
  let best: BlockRecord | null = null
  let bestScore = 0

  for (const block of blocks) {
    let score = 0
    if (block.text.toLowerCase().includes(needle)) score += 3
    score += countObligationMatches(block.text)
    if (score > bestScore) {
      best = block
      bestScore = score
    }
  }

  return bestScore > 0 ? best : null
}

function collectCandidates(blocks: BlockRecord[]): RequirementCandidate[] {
  const candidates: RequirementCandidate[] = []

  for (const block of blocks) {
    if (!hasObligation(block.text)) continue

    const sentences = splitSentences(block.text)
    const matched = sentences.filter((sentence) => hasObligation(sentence) && !isTocOrHeadingNoise(sentence))

    if (matched.length === 0 && !isTocOrHeadingNoise(block.text)) {
      matched.push(collapseWs(block.text))
    }

    for (const label of matched) {
      candidates.push({ label, sourceBlock: block })
    }
  }

  return candidates
}

function dedupeCandidates(candidates: RequirementCandidate[]): RequirementCandidate[] {
  const unique: RequirementCandidate[] = []
  for (const candidate of candidates) {
    if (unique.some((kept) => isNearDuplicate(kept.label, candidate.label))) continue
    unique.push(candidate)
  }
  return unique
}

/**
 * Heuristic shall / must extract from baseline blocks. Not bitgpu — do not call `rfpRequirementsResponseSchema`.
 */
export function extractRfpRequirements(blocks: BlockRecord[]): RfpRequirementsExtract {
  const unique = dedupeCandidates(collectCandidates(blocks)).slice(0, RFP_REQUIREMENTS_MAX)

  const requirements: RfpRequirement[] = unique.map((candidate, index) => {
    const cited = findCitationBlock(blocks, candidate.label) ?? candidate.sourceBlock
    return {
      id: `req-${cited.block_id}-${index + 1}`,
      label: candidate.label,
      citation: blockToCitation(cited, candidate.label.slice(0, 280)),
    }
  })

  return {
    requirements,
    summary:
      requirements.length === 0
        ? 'No shall/must lines found'
        : `${requirements.length} obligation${requirements.length === 1 ? '' : 's'} extracted from baseline`,
  }
}

function fixtureBlock(
  block_id: string,
  text: string,
  page_num = 1,
  doc_id = 'rfp-baseline',
): BlockRecord {
  return { block_id, doc_id, page_num, text }
}

/** Dev harness — known shall + citation, ToC skip, empty input (BDA-260). */
export function runExtractRfpRequirementsHarness(): void {
  const knownShall =
    'The Contractor shall provide weekly status reports to the Contracting Officer.'

  const extracted = extractRfpRequirements([
    fixtureBlock(
      'b-toc',
      'Table of Contents\nInsurance requirements ........ 12\nThe offeror shall ........ 4',
      1,
    ),
    fixtureBlock('b-shall', knownShall, 3),
    fixtureBlock('b-dup', knownShall, 4),
    fixtureBlock('b-heading', 'Section 3 Contractor shall', 5),
  ])

  const hits = extracted.requirements.filter((row) => /weekly status reports/i.test(row.label))
  if (hits.length !== 1) {
    throw new Error(
      `runExtractRfpRequirementsHarness: expected one deduped known shall, got ${hits.length}`,
    )
  }

  const hit = hits[0]!
  if (!hit.label.includes('weekly status reports')) {
    throw new Error('runExtractRfpRequirementsHarness: known phrase missing from label')
  }
  if (hit.citation?.block_id !== 'b-shall') {
    throw new Error(
      `runExtractRfpRequirementsHarness: expected citation b-shall, got ${hit.citation?.block_id}`,
    )
  }
  if (hit.citation.page_num !== 3) {
    throw new Error(
      `runExtractRfpRequirementsHarness: expected page 3, got ${String(hit.citation.page_num)}`,
    )
  }

  const empty = extractRfpRequirements([])
  if (empty.requirements.length !== 0) {
    throw new Error('runExtractRfpRequirementsHarness: empty input should return no requirements')
  }

  const tocOnly = extractRfpRequirements([
    fixtureBlock('t1', 'Table of Contents'),
    fixtureBlock('t2', 'Insurance requirements ........ 12'),
    fixtureBlock('t3', 'The offeror shall ........ 8'),
  ])
  if (tocOnly.requirements.length !== 0) {
    throw new Error('runExtractRfpRequirementsHarness: ToC-only input should return no requirements')
  }

  const capped = extractRfpRequirements(
    Array.from({ length: 50 }, (_, index) =>
      fixtureBlock(`m-${index}`, `The vendor shall deliver item ${index} to the site.`),
    ),
  )
  if (capped.requirements.length !== RFP_REQUIREMENTS_MAX) {
    throw new Error(
      `runExtractRfpRequirementsHarness: expected cap ${RFP_REQUIREMENTS_MAX}, got ${capped.requirements.length}`,
    )
  }
}
