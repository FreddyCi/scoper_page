import { stableDocIdFromFile } from '@/lib/stable-id'
import type { LiteParseParseResult } from '@/lib/liteparse-protocol'
import type { DocumentMeta, IngestResult, BlockRecord } from '@/lib/types'
import {
  getFileExtension,
  isAcceptedUploadFile,
  mimeFromFilename,
} from '@/lib/upload-accept'
import { getDuckdbClient } from '@/services/duckdb-client'
import { cacheDocumentBytes } from '@/services/document-bytes-cache'
import { resolveDocumentRoleForIngest } from '@/services/document-roles'
import { getLiteParseClient } from '@/services/liteparse-client'
import { parseMarkdownToBlocks } from '@/services/markdown-ingest'
import { useSessionStore } from '@/store/session-store'

export type IngestOptions = {
  ocrEnabled?: boolean
}

export type IngestFileError = {
  filename: string
  error: string
}

export type IngestBatchResult = {
  results: IngestResult[]
  errors: IngestFileError[]
}

type IngestFormat = 'pdf' | 'word' | 'markdown' | 'excel'

function resolveMime(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type
  }
  return mimeFromFilename(file.name)
}

function detectIngestFormat(file: File): IngestFormat {
  const mime = resolveMime(file)
  const extension = getFileExtension(file.name)

  if (mime === 'application/pdf' || extension === 'pdf') return 'pdf'

  if (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'doc' ||
    extension === 'docx'
  ) {
    return 'word'
  }

  if (mime === 'text/markdown' || extension === 'md' || extension === 'markdown') {
    return 'markdown'
  }

  if (
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    extension === 'xls' ||
    extension === 'xlsx'
  ) {
    return 'excel'
  }

  throw new Error(`Unsupported file type: ${file.name}`)
}

function ocrWasUsed(ocrEnabled: boolean, parsed: LiteParseParseResult): boolean {
  if (!ocrEnabled) return false
  return parsed.pages.some((page) =>
    page.textItems.some((item) => item.confidence !== undefined),
  )
}

async function persistIngestBlocks(
  document: DocumentMeta,
  blocks: BlockRecord[],
): Promise<void> {
  const duckdb = await getDuckdbClient()
  await duckdb.insertDocument(document)

  for (const block of blocks) {
    await duckdb.insertBlock(block)
  }
}

async function persistIngest(
  document: DocumentMeta,
  blocks: LiteParseParseResult['blocks'],
): Promise<void> {
  await persistIngestBlocks(document, blocks)
}

async function ingestPdf(
  file: File,
  docId: string,
  ocrEnabled: boolean,
): Promise<IngestResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  cacheDocumentBytes(docId, bytes)
  const liteparse = await getLiteParseClient()
  const parsed = await liteparse.parsePdf(docId, bytes, { ocrEnabled })

  const role = await resolveDocumentRoleForIngest(
    docId,
    useSessionStore.getState().documents,
    'application/pdf',
  )

  const document: DocumentMeta = {
    doc_id: docId,
    filename: file.name,
    mime: 'application/pdf',
    role,
    uploaded_at: new Date().toISOString(),
  }

  await persistIngest(document, parsed.blocks)

  return {
    doc_id: docId,
    filename: file.name,
    mime: document.mime,
    block_count: parsed.blocks.length,
    ocr_used: ocrWasUsed(ocrEnabled, parsed),
    role: document.role,
  }
}

async function ingestMarkdown(file: File, docId: string): Promise<IngestResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  cacheDocumentBytes(docId, bytes)

  const markdown = new TextDecoder('utf-8').decode(bytes)
  const blocks = parseMarkdownToBlocks(docId, markdown)

  if (blocks.length === 0) {
    throw new Error(`Markdown file is empty: ${file.name}`)
  }

  const role = await resolveDocumentRoleForIngest(
    docId,
    useSessionStore.getState().documents,
    'text/markdown',
  )

  const document: DocumentMeta = {
    doc_id: docId,
    filename: file.name,
    mime: 'text/markdown',
    role,
    uploaded_at: new Date().toISOString(),
  }

  await persistIngestBlocks(document, blocks)

  return {
    doc_id: docId,
    filename: file.name,
    mime: document.mime,
    block_count: blocks.length,
    ocr_used: false,
    role: document.role,
  }
}

function ingestFormatStub(format: IngestFormat, filename: string): never {
  const labels: Record<Exclude<IngestFormat, 'pdf'>, string> = {
    word: 'Word',
    markdown: 'Markdown',
    excel: 'Excel',
  }

  if (format === 'pdf') {
    throw new Error(`Unexpected PDF stub for ${filename}`)
  }

  throw new Error(`${labels[format]} ingest not implemented (Phase 10)`)
}

export async function ingestFile(
  file: File,
  options: IngestOptions = {},
): Promise<IngestResult> {
  if (!isAcceptedUploadFile(file)) {
    throw new Error(`Unsupported file type: ${file.name}`)
  }

  const docId = await stableDocIdFromFile(file)
  const ocrEnabled = options.ocrEnabled ?? true
  const format = detectIngestFormat(file)

  switch (format) {
    case 'pdf':
      return ingestPdf(file, docId, ocrEnabled)
    case 'markdown':
      return ingestMarkdown(file, docId)
    case 'word':
    case 'excel':
      return ingestFormatStub(format, file.name)
    default: {
      const exhaustive: never = format
      throw new Error(`Unsupported ingest format: ${String(exhaustive)}`)
    }
  }
}

export async function ingestFiles(
  files: File[],
  options: IngestOptions = {},
): Promise<IngestBatchResult> {
  const results: IngestResult[] = []
  const errors: IngestFileError[] = []

  for (const file of files) {
    try {
      results.push(await ingestFile(file, options))
    } catch (error) {
      errors.push({
        filename: file.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { results, errors }
}

/** Dev harness — ingest sample PDF; verify DuckDB document + blocks (BDA-023) */
export async function runIngestHarness(): Promise<void> {
  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`Failed to load sample PDF: ${response.status}`)
  }

  const blob = await response.blob()
  const file = new File([blob], 'minimal.pdf', { type: 'application/pdf' })
  const ingested = await ingestFile(file, { ocrEnabled: false })

  if (ingested.block_count === 0) {
    throw new Error('Ingest harness: expected block_count > 0')
  }

  const duckdb = await getDuckdbClient()
  const documents = await duckdb.query<{ doc_id: string }>(
    'SELECT doc_id FROM documents WHERE doc_id = ?',
    [ingested.doc_id],
  )
  const blocks = await duckdb.query<{ count: number }>(
    'SELECT COUNT(*)::INTEGER AS count FROM blocks WHERE doc_id = ?',
    [ingested.doc_id],
  )

  if (documents.length !== 1) {
    throw new Error('Ingest harness: expected document row in DuckDB')
  }

  const blockCount = blocks[0]?.count ?? 0
  if (blockCount !== ingested.block_count) {
    throw new Error('Ingest harness: DuckDB block count mismatch')
  }
}

/** Dev harness — ingest sample markdown; verify DuckDB blocks with section_path (BDA-081) */
export async function runMarkdownIngestHarness(): Promise<void> {
  const markdown = [
    '# Smoke Test Plan',
    '',
    'Validate application behavior under normal conditions.',
    '',
    '## When to Perform Smoke Tests',
    '',
    '- Regularly to monitor system health',
    '- After deployments',
    '',
    '## Test Types',
    '',
    '| Type | Purpose |',
    '| --- | --- |',
    '| Software | Validate app behavior |',
    '| Network | Ensure systems communicate |',
  ].join('\n')

  const file = new File([markdown], 'harness-sample.md', { type: 'text/markdown' })
  const ingested = await ingestFile(file)

  if (ingested.role !== 'supporting') {
    throw new Error('Markdown ingest harness: expected supporting role for new markdown upload')
  }

  if (ingested.block_count < 3) {
    throw new Error('Markdown ingest harness: expected multiple blocks')
  }

  const duckdb = await getDuckdbClient()
  const documents = await duckdb.query<{ doc_id: string }>(
    'SELECT doc_id FROM documents WHERE doc_id = ?',
    [ingested.doc_id],
  )
  const blocks = await duckdb.query<{ section_path: string | null; text: string }>(
    'SELECT section_path, text FROM blocks WHERE doc_id = ? ORDER BY block_id',
    [ingested.doc_id],
  )

  if (documents.length !== 1) {
    throw new Error('Markdown ingest harness: expected document row in DuckDB')
  }

  const withSectionPath = blocks.filter((block) => block.section_path?.includes('Smoke Test Plan'))
  if (withSectionPath.length === 0) {
    throw new Error('Markdown ingest harness: expected section_path from headings')
  }
}
