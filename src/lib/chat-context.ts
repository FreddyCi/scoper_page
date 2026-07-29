import { docMentionLabel } from '@/lib/chat-mentions'
import type { ChatContextAttachment, CitationRef, DocumentMeta } from '@/lib/types'

export function isContextDocument(doc: Pick<DocumentMeta, 'role' | 'mime'>): boolean {
  return doc.role === 'supporting' || doc.mime === 'text/markdown'
}

export function createDocumentContextAttachment(doc: DocumentMeta): ChatContextAttachment {
  return {
    id: `doc:${doc.doc_id}`,
    kind: 'document',
    docId: doc.doc_id,
    label: doc.filename,
    description: doc.mime === 'text/markdown' ? 'Markdown context' : 'Full document',
  }
}

export function createBlockContextAttachment(
  doc: DocumentMeta,
  citation: CitationRef,
): ChatContextAttachment {
  return {
    id: `block:${citation.block_id}`,
    kind: 'block',
    docId: citation.doc_id,
    blockId: citation.block_id,
    label: doc.filename,
    description: citation.page_num != null ? `Page ${citation.page_num} passage` : 'Selected passage',
    excerpt: citation.excerpt,
    pageNum: citation.page_num,
  }
}

export function mergeContextAttachments(
  existing: ChatContextAttachment[],
  next: ChatContextAttachment[],
): ChatContextAttachment[] {
  const seen = new Set(existing.map((item) => item.id))
  const merged = [...existing]

  for (const item of next) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }

  return merged
}

export function contextAttachmentsForDocuments(documents: DocumentMeta[]): ChatContextAttachment[] {
  return documents.filter(isContextDocument).map(createDocumentContextAttachment)
}

export function resolveContextDocIds(
  attachments: ChatContextAttachment[],
  fallbackDocIds: string[],
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()

  function add(docId: string | null | undefined) {
    if (!docId || seen.has(docId)) return
    seen.add(docId)
    ids.push(docId)
  }

  for (const docId of fallbackDocIds) add(docId)
  for (const attachment of attachments) add(attachment.docId)

  return ids
}

/** Doc IDs the agent should search — session scope plus pinned chat context */
export function resolveAgentSearchDocIds(
  attachments: ChatContextAttachment[],
  options: {
    mentionedDocIds: string[]
    sessionDocuments: DocumentMeta[]
    evaluationDocId: string | null
    activeDocId: string | null
  },
): string[] {
  const scopeIds: string[] = []

  if (options.mentionedDocIds.length > 0) {
    scopeIds.push(...options.mentionedDocIds)
  } else {
    if (options.evaluationDocId) scopeIds.push(options.evaluationDocId)
    if (options.activeDocId) scopeIds.push(options.activeDocId)
    scopeIds.push(...options.sessionDocuments.map((doc) => doc.doc_id))
  }

  return resolveContextDocIds(attachments, scopeIds)
}

export function buildPromptContextBlock(attachments: ChatContextAttachment[]): string {
  if (attachments.length === 0) return ''

  const sections = attachments.map((attachment) => {
    if (attachment.kind === 'block' && attachment.excerpt) {
      const pageLabel = attachment.pageNum != null ? ` (page ${attachment.pageNum})` : ''
      return [`Passage from ${attachment.label}${pageLabel}:`, attachment.excerpt].join('\n')
    }

    const docStub = {
      doc_id: attachment.docId,
      filename: attachment.label,
      mime: attachment.description === 'Markdown context' ? 'text/markdown' : 'application/pdf',
      role: 'unknown' as const,
      uploaded_at: '',
    }
    const prefix = attachment.description === 'Markdown context' ? 'Markdown context' : 'Document'
    return `${prefix}: ${attachment.label} (@${docMentionLabel(docStub)})`
  })

  return ['Attached context:', ...sections].join('\n\n')
}

export function buildAgentPrompt(prompt: string, attachments: ChatContextAttachment[]): string {
  const contextBlock = buildPromptContextBlock(attachments)
  if (!contextBlock) return prompt
  return `${contextBlock}\n\nUser question:\n${prompt}`
}
