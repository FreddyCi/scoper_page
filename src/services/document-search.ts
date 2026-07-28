import type { BlockRecord } from '@/lib/types'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import { ingestFile } from '@/services/ingest-router'

export type DocumentSearchHit = {
  block: BlockRecord
  score: number
  matchedTerms: string[]
}

export type DocumentSearchOptions = {
  docIds?: string[]
  limit?: number
}

const CLAUSE_SYNONYMS: Array<{ pattern: RegExp; terms: string[] }> = [
  { pattern: /indemn/i, terms: ['indemnif', 'indemnity', 'hold harmless', 'liability'] },
  { pattern: /liabil/i, terms: ['liability', 'indemnif', 'coverage', 'loss'] },
  { pattern: /certif|cmmi|qualif/i, terms: ['certif', 'cmmi', 'accredited', 'compliance', 'standard'] },
  { pattern: /pric|commercial|cost|fee/i, terms: ['pricing', 'price', 'cost', 'fee', 'subscription', 'license'] },
  { pattern: /insur|coverage|bond/i, terms: ['insurance', 'coverage', 'bond', 'liability'] },
  { pattern: /warrant/i, terms: ['warrant', 'guarantee', 'defect'] },
  { pattern: /termin/i, terms: ['termin', 'cancel', 'expire'] },
]

const FIND_VERB_PATTERN =
  /\b(find|locate|search|show|where|clause|section|mention|highlight|identify)\b/gi

/** Strip @-mentions and common search verbs before term extraction */
export function normalizeSearchQuery(query: string): string {
  return query
    .replace(/@[\w\s.-]+/g, ' ')
    .replace(FIND_VERB_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractSearchTerms(query: string): string[] {
  const cleaned = normalizeSearchQuery(query)
  const words = cleaned.match(/\b[a-zA-Z]{3,}\b/g) ?? []

  return [...new Set(words.map((word) => word.toLowerCase()))].slice(0, 10)
}

export function expandClauseTerms(terms: string[]): string[] {
  const expanded = new Set(terms)
  const source = terms.join(' ')

  for (const entry of CLAUSE_SYNONYMS) {
    if (entry.pattern.test(source)) {
      for (const term of entry.terms) {
        expanded.add(term)
      }
    }
  }

  return [...expanded]
}

export function scoreBlockText(
  text: string,
  terms: string[],
): { score: number; matchedTerms: string[] } {
  const lower = text.toLowerCase()
  const matchedTerms: string[] = []
  let score = 0

  for (const term of terms) {
    if (!lower.includes(term)) continue
    matchedTerms.push(term)
    score += term.length >= 8 ? 3 : term.length >= 5 ? 2 : 1
  }

  return { score, matchedTerms }
}

function selectFallbackBlocks(blocks: BlockRecord[], count: number): BlockRecord[] {
  if (blocks.length === 0 || count === 0) return []

  const sorted = [...blocks].sort((left, right) => {
    const leftPage = left.page_num ?? Number.MAX_SAFE_INTEGER
    const rightPage = right.page_num ?? Number.MAX_SAFE_INTEGER
    if (leftPage !== rightPage) return leftPage - rightPage
    return left.block_id.localeCompare(right.block_id)
  })

  if (sorted.length <= count) return sorted

  const picked: BlockRecord[] = []
  const step = Math.max(1, Math.floor(sorted.length / count))

  for (let index = 0; index < sorted.length && picked.length < count; index += step) {
    picked.push(sorted[index]!)
  }

  return picked
}

/** Keyword search over DuckDB-backed document blocks (BDA-053) */
export async function searchDocumentBlocks(
  query: string,
  options: DocumentSearchOptions = {},
): Promise<DocumentSearchHit[]> {
  const limit = options.limit ?? 12
  const docIds = options.docIds?.filter(Boolean) ?? []
  if (docIds.length === 0) return []

  const terms = expandClauseTerms(extractSearchTerms(query))
  const scored: DocumentSearchHit[] = []

  for (const docId of docIds) {
    const blocks = await fetchDocumentBlocks(docId)

    for (const block of blocks) {
      const { score, matchedTerms } =
        terms.length > 0 ? scoreBlockText(block.text, terms) : { score: 0, matchedTerms: [] }

      if (score <= 0) continue

      scored.push({ block, score, matchedTerms })
    }
  }

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    const leftPage = left.block.page_num ?? Number.MAX_SAFE_INTEGER
    const rightPage = right.block.page_num ?? Number.MAX_SAFE_INTEGER
    return leftPage - rightPage
  })

  const hits: DocumentSearchHit[] = []
  const seen = new Set<string>()

  for (const hit of scored) {
    if (seen.has(hit.block.block_id)) continue
    seen.add(hit.block.block_id)
    hits.push(hit)
    if (hits.length >= limit) break
  }

  if (hits.length > 0 || terms.length === 0) {
    return hits
  }

  const fallbackBlocks: BlockRecord[] = []
  for (const docId of docIds) {
    fallbackBlocks.push(...(await fetchDocumentBlocks(docId)))
  }

  return selectFallbackBlocks(fallbackBlocks, Math.min(limit, 3)).map((block) => ({
    block,
    score: 0,
    matchedTerms: [],
  }))
}

/** Dev harness — document search returns hits for ingested PDF (BDA-053) */
export async function runDocumentSearchHarness(): Promise<void> {
  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`document-search harness: failed to load sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const ingested = await ingestFile(new File([blob], 'minimal.pdf', { type: 'application/pdf' }), {
    ocrEnabled: false,
  })

  const hits = await searchDocumentBlocks('find document content', {
    docIds: [ingested.doc_id],
    limit: 3,
  })

  if (ingested.block_count > 0 && hits.length === 0) {
    throw new Error('document-search harness: expected hits when blocks exist')
  }

  if (hits[0]?.block.doc_id !== ingested.doc_id) {
    throw new Error('document-search harness: expected hit doc_id to match ingested document')
  }
}
