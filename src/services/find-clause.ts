import { blockToCitation } from '@/lib/types'
import type { FindClauseResult } from '@/lib/types'
import {
  expandClauseTerms,
  extractSearchTerms,
  normalizeSearchQuery,
  searchDocumentBlocks,
  type DocumentSearchHit,
} from '@/services/document-search'
import { ingestFile } from '@/services/ingest-router'

export type FindClauseOptions = {
  docIds?: string[]
  limit?: number
}

function buildRelevance(query: string, hit: DocumentSearchHit): string {
  if (hit.matchedTerms.length > 0) {
    return `Matches ${hit.matchedTerms.slice(0, 3).join(', ')}`
  }

  const terms = expandClauseTerms(extractSearchTerms(query))
  if (terms.length > 0) {
    return `Closest excerpt for "${normalizeSearchQuery(query) || query}"`
  }

  return 'Document excerpt'
}

function buildFindClauseSummary(query: string, hits: DocumentSearchHit[]): string {
  const label = normalizeSearchQuery(query) || query.trim()
  const exactMatches = hits.filter((hit) => hit.matchedTerms.length > 0)

  if (hits.length === 0) {
    return label
      ? `I couldn't find any clauses matching "${label}" in the uploaded documents.`
      : 'Upload a document first, then ask me to find a clause.'
  }

  if (exactMatches.length === 0) {
    return `I didn't find an exact match for "${label}". Here are nearby excerpts you can review in the document viewer.`
  }

  if (exactMatches.length === 1) {
    return `I found 1 clause related to "${label}". Open a source chip below to highlight it in the document viewer.`
  }

  return `I found ${exactMatches.length} clauses related to "${label}". Use the source chips below to jump to each passage.`
}

/** Retrieve clause matches from DuckDB blocks — MVP find_clause tool (BDA-053) */
export async function findClause(
  query: string,
  options: FindClauseOptions = {},
): Promise<FindClauseResult> {
  const limit = options.limit ?? 6
  const hits = await searchDocumentBlocks(query, {
    docIds: options.docIds,
    limit,
  })

  const matches = hits.map((hit) => ({
    citation: blockToCitation(hit.block),
    relevance: buildRelevance(query, hit),
  }))

  return {
    matches,
    summary: buildFindClauseSummary(query, hits),
  }
}

/** Dev harness — find_clause returns citations for sample PDF (BDA-053) */
export async function runFindClauseHarness(): Promise<void> {
  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`find-clause harness: failed to load sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const ingested = await ingestFile(new File([blob], 'minimal.pdf', { type: 'application/pdf' }), {
    ocrEnabled: false,
  })

  const result = await findClause('find indemnification', {
    docIds: [ingested.doc_id],
    limit: 3,
  })

  if (ingested.block_count > 0 && result.matches.length === 0) {
    throw new Error('find-clause harness: expected matches when blocks exist')
  }

  if (!result.summary.trim()) {
    throw new Error('find-clause harness: expected summary text')
  }

  if (result.matches[0]?.citation.doc_id !== ingested.doc_id) {
    throw new Error('find-clause harness: expected citation doc_id to match ingested document')
  }
}
