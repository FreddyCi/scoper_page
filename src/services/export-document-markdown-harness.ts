import {
  spreadsheetBlocksToMarkdown,
  wordBlocksToMarkdown,
} from '@/lib/assemble-blocks-markdown'
import type { BlockRecord } from '@/lib/types'
import { buildDocumentMarkdownExport } from '@/services/export-document-markdown'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { runDocxIngestHarness, runXlsxIngestHarness } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

export function runAssembleBlocksMarkdownHarness(): void {
  const docId = 'doc-blocks-md'
  const wordBlocks: BlockRecord[] = [
    {
      block_id: `${docId}:1`,
      doc_id: docId,
      section_path: 'Scope › Deliverables',
      text: 'Provide crane services per Section 2.2.2.',
    },
  ]
  const wordMd = wordBlocksToMarkdown(
    { doc_id: docId, filename: 'sample.docx', mime: 'application/vnd...', role: 'unknown', uploaded_at: '' },
    wordBlocks,
  )
  if (!wordMd.includes('## Scope › Deliverables')) {
    throw new Error('runAssembleBlocksMarkdownHarness: expected section heading in word export')
  }

  const sheetBlocks: BlockRecord[] = [
    {
      block_id: `${docId}:xlsx-0-0`,
      doc_id: docId,
      section_path: 'Sheet1 › A1:B1',
      text: 'Name | Value',
    },
    {
      block_id: `${docId}:xlsx-0-1`,
      doc_id: docId,
      section_path: 'Sheet1 › A2:B2',
      text: 'Alpha | 1',
    },
  ]
  const sheetMd = spreadsheetBlocksToMarkdown(
    { doc_id: docId, filename: 'sample.xlsx', mime: 'application/vnd...', role: 'unknown', uploaded_at: '' },
    sheetBlocks,
  )
  if (!sheetMd.includes('## Sheet1') || !sheetMd.includes('| Alpha |')) {
    throw new Error('runAssembleBlocksMarkdownHarness: expected GFM table in spreadsheet export')
  }
}

export async function runExportDocumentMarkdownHarness(): Promise<void> {
  runAssembleBlocksMarkdownHarness()

  const store = useSessionStore.getState()
  store.resetSession()
  await runDocxIngestHarness()

  const docxDoc = useSessionStore.getState().documents.find((doc) => doc.filename.includes('.docx'))
  if (!docxDoc || !getDocumentBytes(docxDoc.doc_id)) {
    throw new Error('runExportDocumentMarkdownHarness: expected ingested docx with bytes')
  }

  const docxMd = await buildDocumentMarkdownExport(docxDoc)
  if (!docxMd.includes('---') || docxMd.length < 40) {
    throw new Error('runExportDocumentMarkdownHarness: docx markdown export too short')
  }

  store.resetSession()
  await runXlsxIngestHarness()

  const xlsxDoc = useSessionStore.getState().documents.find((doc) => doc.filename.includes('.xlsx'))
  if (!xlsxDoc || !getDocumentBytes(xlsxDoc.doc_id)) {
    throw new Error('runExportDocumentMarkdownHarness: expected ingested xlsx with bytes')
  }

  const xlsxMd = await buildDocumentMarkdownExport(xlsxDoc)
  if (!xlsxMd.includes('|') || !xlsxMd.includes('---')) {
    throw new Error('runExportDocumentMarkdownHarness: xlsx markdown export missing table or front matter')
  }
}
