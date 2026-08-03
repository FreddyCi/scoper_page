import type { DocumentMeta } from '@/lib/types'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const DOC_MIME = 'application/msword'
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const XLS_MIME = 'application/vnd.ms-excel'
export const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet'

const SPREADSHEET_MIMES = new Set([XLSX_MIME, XLS_MIME, ODS_MIME])

export function isWordDocument(doc: Pick<DocumentMeta, 'mime'>): boolean {
  return doc.mime === DOCX_MIME || doc.mime === DOC_MIME
}

export function isSpreadsheetDocument(
  doc: Pick<DocumentMeta, 'mime' | 'filename'>,
): boolean {
  if (SPREADSHEET_MIMES.has(doc.mime)) return true
  if (doc.mime === 'text/csv') return true
  const extension = doc.filename.split('.').pop()?.toLowerCase()
  return extension === 'xlsx' || extension === 'xls' || extension === 'ods' || extension === 'csv'
}

export function spreadsheetFormatLabel(doc: Pick<DocumentMeta, 'mime' | 'filename'>): string {
  if (doc.mime === ODS_MIME || doc.filename.toLowerCase().endsWith('.ods')) {
    return 'LibreOffice Calc'
  }
  if (doc.mime === XLS_MIME || doc.filename.toLowerCase().endsWith('.xls')) {
    return 'Excel (.xls)'
  }
  return 'Excel / Google Sheets'
}

export function isMarkdownDocument(doc: Pick<DocumentMeta, 'mime'>): boolean {
  return doc.mime === 'text/markdown'
}

/** Documents that use Read / Preview tabs instead of PDF extract split */
export function usesReadPreviewLayout(doc: Pick<DocumentMeta, 'mime' | 'filename'>): boolean {
  return isMarkdownDocument(doc) || isWordDocument(doc) || isSpreadsheetDocument(doc)
}

export function readLayoutKind(
  doc: Pick<DocumentMeta, 'mime' | 'filename'>,
): 'markdown' | 'word' | 'spreadsheet' | 'pdf' {
  if (isMarkdownDocument(doc)) return 'markdown'
  if (isWordDocument(doc)) return 'word'
  if (isSpreadsheetDocument(doc)) return 'spreadsheet'
  return 'pdf'
}
