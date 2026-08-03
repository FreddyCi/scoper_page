import { stripYamlFrontMatter } from '@/lib/assemble-pdf-markdown'
import { contextMarkdownFilenameFromSource } from '@/lib/assemble-blocks-markdown'
import {
  isSpreadsheetDocument,
  isWordDocument,
} from '@/lib/document-preview'
import type { DocumentMeta, IngestResult } from '@/lib/types'
import {
  buildDocumentMarkdownExport,
  type ExportDocumentMarkdownOptions,
} from '@/services/export-document-markdown'
import { ingestFile } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

export type ConvertDocumentToContextOptions = ExportDocumentMarkdownOptions

function supportsContextConversion(document: DocumentMeta): boolean {
  return (
    document.mime === 'application/pdf' ||
    isWordDocument(document) ||
    isSpreadsheetDocument(document)
  )
}

/**
 * Export supported office/PDF documents to markdown, ingest as supporting context,
 * attach to chat, and open in the workspace tab row.
 */
export async function convertDocumentToContextDocument(
  document: DocumentMeta,
  options: ConvertDocumentToContextOptions = {},
): Promise<IngestResult> {
  if (!supportsContextConversion(document)) {
    throw new Error('Context conversion supports PDF, Word, and spreadsheet files only.')
  }

  const markdown = stripYamlFrontMatter(
    await buildDocumentMarkdownExport(document, {
      ocrEnabled: options.ocrEnabled ?? true,
      includeScoperComments: document.mime === 'application/pdf',
      onProgress: options.onProgress,
    }),
  )

  if (!markdown.trim()) {
    throw new Error('No text could be extracted from this file for context conversion.')
  }

  const filename = contextMarkdownFilenameFromSource(document.filename)
  const file = new File([markdown], filename, { type: 'text/markdown' })
  const result = await ingestFile(file, { ocrEnabled: false })

  const store = useSessionStore.getState()
  store.commitIngestResults([result])
  store.setActiveDocId(result.doc_id)

  return result
}
