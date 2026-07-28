import { blockToCitation } from '@/lib/types'
import type { AssistantChatContent, CitationRef, DocumentMeta } from '@/lib/types'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import { ingestFile } from '@/services/ingest-router'

type FindChatCitationsOptions = {
  docIds?: string[]
  limit?: number
}

function extractSearchTerms(prompt: string): string[] {
  const cleaned = prompt.replace(/@[\w\s.-]+/g, ' ')
  const words = cleaned.match(/\b[a-zA-Z]{4,}\b/g) ?? []

  return [...new Set(words.map((word) => word.toLowerCase()))].slice(0, 8)
}

function scoreBlock(text: string, terms: string[]): number {
  const lower = text.toLowerCase()
  return terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0)
}

/** Keyword search over DuckDB blocks — lightweight pre–find_clause citation attach (BDA-052) */
export async function findChatCitations(
  prompt: string,
  documents: DocumentMeta[],
  options: FindChatCitationsOptions = {},
): Promise<CitationRef[]> {
  const limit = options.limit ?? 3
  const docIds =
    options.docIds?.filter(Boolean) ??
    documents.map((doc) => doc.doc_id).filter(Boolean)

  if (docIds.length === 0) return []

  const terms = extractSearchTerms(prompt)
  const scored: Array<{ score: number; blockId: string; citation: CitationRef }> = []

  for (const docId of docIds) {
    const blocks = await fetchDocumentBlocks(docId)

    for (const block of blocks) {
      const score = terms.length > 0 ? scoreBlock(block.text, terms) : 1
      if (score <= 0) continue

      scored.push({
        score,
        blockId: block.block_id,
        citation: blockToCitation(block),
      })
    }
  }

  scored.sort((left, right) => right.score - left.score)

  const citations: CitationRef[] = []
  const seen = new Set<string>()

  for (const item of scored) {
    if (seen.has(item.blockId)) continue
    seen.add(item.blockId)
    citations.push(item.citation)
    if (citations.length >= limit) break
  }

  if (citations.length === 0) {
    const fallbackBlocks = await fetchDocumentBlocks(docIds[0]!)
    for (const block of fallbackBlocks.slice(0, limit)) {
      citations.push(blockToCitation(block))
    }
  }

  return citations
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

  const document: DocumentMeta = {
    doc_id: ingested.doc_id,
    filename: ingested.filename,
    mime: ingested.mime,
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  }

  const citations = await findChatCitations('@minimal summarize document content', [document], {
    docIds: [document.doc_id],
    limit: 2,
  })

  if (ingested.block_count > 0 && citations.length === 0) {
    throw new Error('chat-citations harness: expected citations when blocks exist')
  }

  if (citations[0]?.doc_id !== document.doc_id) {
    throw new Error('chat-citations harness: expected citation doc_id to match document')
  }
}
