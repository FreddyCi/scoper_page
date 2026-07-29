import { assemblePdfMarkdown, blocksToMarkdown } from '@/lib/assemble-pdf-markdown'
import { buildPdfMarkdownExport } from '@/services/export-pdf-markdown'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { getLiteParseClient } from '@/services/liteparse-client'
import { runIngestHarness } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

export async function runExportPdfMarkdownHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()
  await runIngestHarness()

  const document = useSessionStore.getState().documents[0]
  if (!document || document.mime !== 'application/pdf') {
    throw new Error('ExportPdfMarkdownHarness: expected ingested PDF document')
  }

  if (!getDocumentBytes(document.doc_id)) {
    throw new Error('ExportPdfMarkdownHarness: missing document bytes')
  }

  const markdown = await buildPdfMarkdownExport(document, { ocrEnabled: false })
  if (!markdown.includes('---')) {
    throw new Error('ExportPdfMarkdownHarness: expected YAML front matter')
  }
  if (markdown.trim().length < 20) {
    throw new Error('ExportPdfMarkdownHarness: markdown body too short')
  }

  const liteparse = await getLiteParseClient()
  const bytes = getDocumentBytes(document.doc_id)!
  const parsed = await liteparse.parsePdfToMarkdown(bytes)
  const fromBlocks = blocksToMarkdown(
    document,
    (await liteparse.parsePdf(document.doc_id, bytes)).blocks,
  )

  const assembled = assemblePdfMarkdown({
    document,
    parseResult: parsed,
    fallbackBody: fromBlocks,
  })

  if (!assembled.trim()) {
    throw new Error('ExportPdfMarkdownHarness: assemble produced empty markdown')
  }
}
