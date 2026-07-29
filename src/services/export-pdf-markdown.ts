import {
  assemblePdfMarkdown,
  blocksToMarkdown,
  markdownExportFilename,
} from '@/lib/assemble-pdf-markdown'
import type { LiteParseProgress } from '@/lib/liteparse-protocol'
import type { DocumentMeta } from '@/lib/types'
import { fetchDocumentComments } from '@/services/block-comments'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { getLiteParseClient } from '@/services/liteparse-client'

export type ExportPdfMarkdownOptions = {
  ocrEnabled?: boolean
  includeScoperComments?: boolean
  onProgress?: (progress: LiteParseProgress) => void
}

export async function buildPdfMarkdownExport(
  document: DocumentMeta,
  options: ExportPdfMarkdownOptions = {},
): Promise<string> {
  if (document.mime !== 'application/pdf') {
    throw new Error('Markdown export supports PDF documents only')
  }

  const bytes = getDocumentBytes(document.doc_id)
  if (!bytes) {
    throw new Error(`Missing PDF bytes for ${document.filename}. Re-upload the document first.`)
  }

  const liteparse = await getLiteParseClient()
  const { markdown, ocrBlocks } = await liteparse.parsePdfToMarkdownWithOcrFallback(
    document.doc_id,
    bytes,
    {
      ocrEnabled: options.ocrEnabled ?? true,
      onProgress: options.onProgress,
    },
  )

  const scoperComments =
    options.includeScoperComments === false
      ? []
      : await fetchDocumentComments(document.doc_id)

  const fallbackBody =
    markdown.markdown.trim().length === 0 && ocrBlocks && ocrBlocks.length > 0
      ? blocksToMarkdown(document, ocrBlocks)
      : markdown.markdown.trim().length < 40 && ocrBlocks && ocrBlocks.length > 0
        ? blocksToMarkdown(document, ocrBlocks)
        : undefined

  return assemblePdfMarkdown({
    document,
    parseResult: markdown,
    scoperComments,
    fallbackBody,
  })
}

export function pdfMarkdownExportFilename(filename: string): string {
  return markdownExportFilename(filename)
}

export async function exportPdfMarkdownBlob(
  document: DocumentMeta,
  options?: ExportPdfMarkdownOptions,
): Promise<{ blob: Blob; filename: string }> {
  const markdown = await buildPdfMarkdownExport(document, options)
  const filename = pdfMarkdownExportFilename(document.filename)

  return {
    blob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
    filename,
  }
}
