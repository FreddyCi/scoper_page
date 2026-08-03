import {
  assembleBlocksMarkdownExport,
  contextMarkdownFilenameFromSource,
  markdownExportFilenameFromSource,
  spreadsheetBlocksToMarkdown,
  wordBlocksToMarkdown,
} from '@/lib/assemble-blocks-markdown'
import {
  isSpreadsheetDocument,
  isWordDocument,
} from '@/lib/document-preview'
import type { DocumentMeta } from '@/lib/types'
import { parseDocxToBlocks } from '@/services/docx-ingest'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import {
  buildPdfMarkdownExport,
  type ExportPdfMarkdownOptions,
} from '@/services/export-pdf-markdown'
import { getFileExtension } from '@/lib/upload-accept'
import { parseCsvToBlocks, parseXlsxToBlocks } from '@/services/xlsx-ingest'

export type ExportDocumentMarkdownOptions = ExportPdfMarkdownOptions

function requireBytes(document: DocumentMeta): ArrayBuffer {
  const bytes = getDocumentBytes(document.doc_id)
  if (!bytes) {
    throw new Error(`Missing file bytes for ${document.filename}. Re-upload the document first.`)
  }
  return bytes
}

export async function buildDocumentMarkdownExport(
  document: DocumentMeta,
  options: ExportDocumentMarkdownOptions = {},
): Promise<string> {
  if (document.mime === 'application/pdf') {
    return buildPdfMarkdownExport(document, options)
  }

  if (isWordDocument(document)) {
    const bytes = requireBytes(document)
    const blocks = await parseDocxToBlocks(document.doc_id, bytes)
    const body = wordBlocksToMarkdown(document, blocks)
    if (!body) {
      throw new Error('Word document contains no extractable text for markdown export.')
    }
    return assembleBlocksMarkdownExport(document, body, 'mammoth (browser)')
  }

  if (isSpreadsheetDocument(document)) {
    const bytes = requireBytes(document)
    const isCsv =
      document.mime === 'text/csv' || getFileExtension(document.filename) === 'csv'
    const blocks = isCsv
      ? parseCsvToBlocks(document.doc_id, bytes)
      : parseXlsxToBlocks(document.doc_id, bytes)
    const body = spreadsheetBlocksToMarkdown(document, blocks)
    if (!body) {
      throw new Error('Spreadsheet contains no extractable cells for markdown export.')
    }
    return assembleBlocksMarkdownExport(document, body, 'SheetJS (browser)')
  }

  if (document.mime === 'text/markdown') {
    const bytes = requireBytes(document)
    const text = new TextDecoder('utf-8').decode(bytes)
    return assembleBlocksMarkdownExport(document, text, 'source file')
  }

  throw new Error(`Markdown export is not supported for ${document.filename}.`)
}

export async function exportDocumentMarkdownBlob(
  document: DocumentMeta,
  options?: ExportDocumentMarkdownOptions,
): Promise<{ blob: Blob; filename: string }> {
  const markdown = await buildDocumentMarkdownExport(document, options)
  const filename = markdownExportFilenameFromSource(document.filename)

  return {
    blob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
    filename,
  }
}

export { contextMarkdownFilenameFromSource }
