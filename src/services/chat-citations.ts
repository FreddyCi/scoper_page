import type { AssistantChatContent, CitationRef, DocumentMeta } from '@/lib/types'
import { findClause } from '@/services/find-clause'
import { ingestFile } from '@/services/ingest-router'

type FindChatCitationsOptions = {
  docIds?: string[]
  limit?: number
}

/** Map find_clause matches to inline citation chips for assistant messages */
export async function findChatCitations(
  prompt: string,
  _documents: DocumentMeta[],
  options: FindChatCitationsOptions = {},
): Promise<CitationRef[]> {
  const result = await findClause(prompt, {
    docIds: options.docIds,
    limit: options.limit ?? 3,
  })

  return result.matches.map((match) => match.citation)
}

export function buildAssistantRichContent(
  text: string,
  citationChips: CitationRef[],
): AssistantChatContent | undefined {
  const trimmed = text.trim()
  if (!trimmed && citationChips.length === 0) return undefined

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    paragraphs: paragraphs.length > 0 ? paragraphs : [trimmed || 'Ready to help with your documents.'],
    citationChips: citationChips.length > 0 ? citationChips : undefined,
  }
}

/** Dev harness — find citations from ingested blocks (BDA-052) */
export async function runChatCitationsHarness(): Promise<void> {
  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`chat-citations harness: failed to load sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const ingested = await ingestFile(new File([blob], 'minimal.pdf', { type: 'application/pdf' }), {
    ocrEnabled: false,
  })

  const citations = await findChatCitations('@minimal summarize document content', [], {
    docIds: [ingested.doc_id],
    limit: 2,
  })

  if (ingested.block_count > 0 && citations.length === 0) {
    throw new Error('chat-citations harness: expected citations when blocks exist')
  }

  if (citations[0]?.doc_id !== ingested.doc_id) {
    throw new Error('chat-citations harness: expected citation doc_id to match document')
  }
}
