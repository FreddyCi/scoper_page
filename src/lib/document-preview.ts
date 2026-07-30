import type { DocumentMeta } from '@/lib/types'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const DOC_MIME = 'application/msword'

export function isWordDocument(doc: Pick<DocumentMeta, 'mime'>): boolean {
  return doc.mime === DOCX_MIME || doc.mime === DOC_MIME
}

export function isMarkdownDocument(doc: Pick<DocumentMeta, 'mime'>): boolean {
  return doc.mime === 'text/markdown'
}

/** Documents that use Read / Preview tabs instead of PDF extract split */
export function usesReadPreviewLayout(doc: Pick<DocumentMeta, 'mime'>): boolean {
  return isMarkdownDocument(doc) || isWordDocument(doc)
}

export function readLayoutKind(
  doc: Pick<DocumentMeta, 'mime'>,
): 'markdown' | 'word' | 'pdf' {
  if (isMarkdownDocument(doc)) return 'markdown'
  if (isWordDocument(doc)) return 'word'
  return 'pdf'
}
