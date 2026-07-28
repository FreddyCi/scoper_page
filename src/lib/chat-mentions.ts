import type { DocumentMeta } from '@/lib/types'

/** Display label for @-mentions — filename without extension */
export function docMentionLabel(doc: DocumentMeta): string {
  return doc.filename.replace(/\.[^.]+$/, '')
}

/** Active @-mention query at the cursor, if any */
export function findActiveMentionQuery(
  text: string,
  cursor: number,
): { query: string; start: number } | null {
  const before = text.slice(0, cursor)
  const match = before.match(/@([\w\s.-]*)$/)
  if (!match || match.index == null) return null

  return {
    query: match[1] ?? '',
    start: match.index,
  }
}

export function filterDocumentsForMention(
  documents: DocumentMeta[],
  query: string,
): DocumentMeta[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return documents

  return documents.filter(
    (doc) =>
      doc.filename.toLowerCase().includes(normalized) ||
      docMentionLabel(doc).toLowerCase().includes(normalized),
  )
}

function resolveMentionToken(token: string, documents: DocumentMeta[]): DocumentMeta | null {
  const normalized = token.trim().toLowerCase()
  if (!normalized) return null

  const exact =
    documents.find((doc) => docMentionLabel(doc).toLowerCase() === normalized) ??
    documents.find((doc) => doc.filename.toLowerCase() === normalized)

  if (exact) return exact

  return (
    documents.find((doc) => doc.filename.toLowerCase().startsWith(normalized)) ??
    documents.find((doc) => docMentionLabel(doc).toLowerCase().startsWith(normalized)) ??
    null
  )
}

/** Resolve @-mentions in a prompt to document ids (deduped, in order) */
export function resolveMentionedDocIds(text: string, documents: DocumentMeta[]): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const pattern = /@([\w\s.-]+)/g

  for (const match of text.matchAll(pattern)) {
    const doc = resolveMentionToken(match[1] ?? '', documents)
    if (!doc || seen.has(doc.doc_id)) continue
    seen.add(doc.doc_id)
    ids.push(doc.doc_id)
  }

  return ids
}

export function insertDocMention(
  text: string,
  mentionStart: number,
  cursor: number,
  doc: DocumentMeta,
): { text: string; cursor: number } {
  const label = docMentionLabel(doc)
  const before = text.slice(0, mentionStart)
  const after = text.slice(cursor)
  const nextText = `${before}@${label} ${after}`
  const nextCursor = before.length + label.length + 2

  return { text: nextText, cursor: nextCursor }
}
