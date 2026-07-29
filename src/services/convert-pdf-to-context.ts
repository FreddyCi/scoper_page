import {
  contextMarkdownFilename,
  stripYamlFrontMatter,
} from '@/lib/assemble-pdf-markdown'
import type { DocumentMeta, IngestResult } from '@/lib/types'
import {
  buildPdfMarkdownExport,
  type ExportPdfMarkdownOptions,
} from '@/services/export-pdf-markdown'
import { ingestFile } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

export type ConvertPdfToContextOptions = ExportPdfMarkdownOptions

/**
 * Parse a PDF to markdown (LiteParse), ingest as a supporting context document,
 * attach it to chat, and open it in the workspace tab row.
 */
export async function convertPdfToContextDocument(
  document: DocumentMeta,
  options: ConvertPdfToContextOptions = {},
): Promise<IngestResult> {
  if (document.mime !== 'application/pdf') {
    throw new Error('Context conversion supports PDF documents only')
  }

  const markdown = stripYamlFrontMatter(
    await buildPdfMarkdownExport(document, {
      ocrEnabled: options.ocrEnabled ?? true,
      includeScoperComments: options.includeScoperComments ?? true,
      onProgress: options.onProgress,
    }),
  )

  if (!markdown.trim()) {
    throw new Error('No text could be extracted from this PDF for context conversion.')
  }

  const filename = contextMarkdownFilename(document.filename)
  const file = new File([markdown], filename, { type: 'text/markdown' })
  const result = await ingestFile(file, { ocrEnabled: false })

  const store = useSessionStore.getState()
  store.commitIngestResults([result])
  store.setActiveDocId(result.doc_id)

  return result
}
