import { stableDocIdFromFile } from '@/lib/stable-id'
import type { LiteParseParseResult } from '@/lib/liteparse-protocol'
import type { DocumentMeta, IngestResult, BlockRecord } from '@/lib/types'
import {
  getFileExtension,
  isAcceptedUploadFile,
  mimeFromFilename,
} from '@/lib/upload-accept'
import {
  ODS_MIME,
  XLSX_MIME,
  XLS_MIME,
} from '@/lib/document-preview'
import { getDuckdbClient } from '@/services/duckdb-client'
import { cacheDocumentBytes } from '@/services/document-bytes-cache'
import { resolveDocumentRoleForIngest } from '@/services/document-roles'
import { getLiteParseClient } from '@/services/liteparse-client'
import { parseMarkdownToBlocks } from '@/services/markdown-ingest'
import { parseDocxToBlocks } from '@/services/docx-ingest'
import { parseCsvToBlocks, parseXlsxToBlocks } from '@/services/xlsx-ingest'
import { importPdfMarkupComments, readScoperExportMetadata } from '@/services/import-pdf-comments'
import { useSessionStore } from '@/store/session-store'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function resolveSpreadsheetMime(mime: string, filename: string): string {
  const extension = getFileExtension(filename)
  if (mime === ODS_MIME || extension === 'ods') return ODS_MIME
  if (mime === XLS_MIME || extension === 'xls') return XLS_MIME
  return XLSX_MIME
}

export type IngestOptions = {
  ocrEnabled?: boolean
  /** Skip LiteParse block extract — cache PDF bytes only (plan/drawing mark-up). */
  skipPdfTextExtract?: boolean
  onProgress?: (progress: IngestProgress) => void
  onFileProgress?: (progress: IngestFileProgress) => void
}

export type IngestFileProgress = {
  filePercent: number
  phase?: string
}

export type IngestProgress = {
  completed: number
  total: number
  percent: number
  currentFilename: string
  filePercent?: number
  phase?: string
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
    mime === ODS_MIME ||
    mime === 'text/csv' ||
    extension === 'xls' ||
    extension === 'xlsx' ||
    extension === 'ods' ||
    extension === 'csv'
  ) {
    return 'excel'
  }

  throw new Error(`Unsupported file type: ${file.name}`)
}

function computeIngestPercent(completed: number, total: number, filePercent = 0): number {
  if (total === 0) return filePercent >= 100 ? 100 : 0
  return Math.min(100, Math.round(((completed + filePercent / 100) / total) * 100))
}

function reportFileProgress(
  options: IngestOptions,
  fileIndex: number,
  totalFiles: number,
  filename: string,
  filePercent: number,
  phase?: string,
): void {
  options.onFileProgress?.({ filePercent, phase })
  options.onProgress?.({
    completed: fileIndex,
    total: totalFiles,
    percent: computeIngestPercent(fileIndex, totalFiles, filePercent),
    currentFilename: filename,
    filePercent,
    phase,
  })
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
  options: IngestOptions = {},
  fileIndex = 0,
  totalFiles = 1,
): Promise<IngestResult> {
  const report = (filePercent: number, phase?: string) => {
    reportFileProgress(options, fileIndex, totalFiles, file.name, filePercent, phase)
  }

  report(2, 'Reading file')
  const bytes = new Uint8Array(await file.arrayBuffer())
  cacheDocumentBytes(docId, bytes)

  report(8, 'Reading metadata')
  const scoperMeta = await readScoperExportMetadata(bytes, file.name)

  if (options.skipPdfTextExtract) {
    const roleFromExport = scoperMeta.role
    const role =
      roleFromExport ??
      (await resolveDocumentRoleForIngest(
        docId,
        useSessionStore.getState().documents,
        'application/pdf',
      ))

    const document: DocumentMeta = {
      doc_id: docId,
      filename: file.name,
      mime: 'application/pdf',
      role,
      uploaded_at: new Date().toISOString(),
    }

    report(40, 'Storing preview')
    await persistIngestBlocks(document, [])
    report(100, 'Done')

    return {
      doc_id: docId,
      filename: file.name,
      mime: document.mime,
      block_count: 0,
      ocr_used: false,
      role: document.role,
    }
  }

  const liteparse = await getLiteParseClient()

  report(12, 'Parsing document')
  const parsed = await liteparse.parsePdf(docId, bytes, {
    ocrEnabled,
    onProgress: (progress) => {
      const parsePercent = 12 + Math.round(progress.percent * 0.68)
      const phase =
        progress.totalPages > 1
          ? `Parsing pages (${progress.completedPages}/${progress.totalPages})`
          : 'Parsing document'
      report(parsePercent, phase)
    },
  })

  const roleFromExport = scoperMeta.role
  const role =
    roleFromExport ??
    (await resolveDocumentRoleForIngest(
      docId,
      useSessionStore.getState().documents,
      'application/pdf',
    ))

  const document: DocumentMeta = {
    doc_id: docId,
    filename: file.name,
    mime: 'application/pdf',
    role,
    uploaded_at: new Date().toISOString(),
  }

  report(82, 'Saving blocks')
  await persistIngest(document, parsed.blocks)

  if (scoperMeta.isScoperExport && scoperMeta.commentMode !== 'burned-in') {
    report(90, 'Importing comments')
    const { fetchDocumentBlocks } = await import('@/services/document-blocks')
    await importPdfMarkupComments({
      docId,
      bytes,
      filename: file.name,
      blocks: await fetchDocumentBlocks(docId),
    })
  }

  report(100, 'Done')

  return {
    doc_id: docId,
    filename: file.name,
    mime: document.mime,
    block_count: parsed.blocks.length,
    ocr_used: ocrWasUsed(ocrEnabled, parsed),
    role: document.role,
  }
}

async function ingestMarkdown(
  file: File,
  docId: string,
  options: IngestOptions = {},
  fileIndex = 0,
  totalFiles = 1,
): Promise<IngestResult> {
  reportFileProgress(options, fileIndex, totalFiles, file.name, 10, 'Reading file')
  const bytes = new Uint8Array(await file.arrayBuffer())
  cacheDocumentBytes(docId, bytes)

  reportFileProgress(options, fileIndex, totalFiles, file.name, 40, 'Parsing markdown')
  const { stripYamlFrontMatter } = await import('@/lib/assemble-pdf-markdown')
  const markdown = stripYamlFrontMatter(new TextDecoder('utf-8').decode(bytes))
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

  reportFileProgress(options, fileIndex, totalFiles, file.name, 80, 'Saving blocks')
  await persistIngestBlocks(document, blocks)
  reportFileProgress(options, fileIndex, totalFiles, file.name, 100, 'Done')

  return {
    doc_id: docId,
    filename: file.name,
    mime: document.mime,
    block_count: blocks.length,
    ocr_used: false,
    role: document.role,
  }
}

async function ingestDocx(
  file: File,
  docId: string,
  options: IngestOptions = {},
  fileIndex = 0,
  totalFiles = 1,
): Promise<IngestResult> {
  const extension = getFileExtension(file.name)
  if (extension === 'doc') {
    throw new Error(
      `Legacy Word .doc is not supported (${file.name}). Save as .docx and re-upload.`,
    )
  }

  reportFileProgress(options, fileIndex, totalFiles, file.name, 10, 'Reading file')
  const bytes = new Uint8Array(await file.arrayBuffer())
  cacheDocumentBytes(docId, bytes)

  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  )
  reportFileProgress(options, fileIndex, totalFiles, file.name, 40, 'Parsing document')
  const blocks = await parseDocxToBlocks(docId, arrayBuffer)

  const role = await resolveDocumentRoleForIngest(
    docId,
    useSessionStore.getState().documents,
    DOCX_MIME,
  )

  const document: DocumentMeta = {
    doc_id: docId,
    filename: file.name,
    mime: DOCX_MIME,
    role,
    uploaded_at: new Date().toISOString(),
  }

  reportFileProgress(options, fileIndex, totalFiles, file.name, 80, 'Saving blocks')
  await persistIngestBlocks(document, blocks)
  reportFileProgress(options, fileIndex, totalFiles, file.name, 100, 'Done')

  return {
    doc_id: docId,
    filename: file.name,
    mime: document.mime,
    block_count: blocks.length,
    ocr_used: false,
    role: document.role,
  }
}

async function ingestExcel(
  file: File,
  docId: string,
  options: IngestOptions = {},
  fileIndex = 0,
  totalFiles = 1,
): Promise<IngestResult> {
  reportFileProgress(options, fileIndex, totalFiles, file.name, 10, 'Reading file')
  const bytes = new Uint8Array(await file.arrayBuffer())
  cacheDocumentBytes(docId, bytes)

  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  )
  reportFileProgress(options, fileIndex, totalFiles, file.name, 40, 'Parsing spreadsheet')
  const isCsv = getFileExtension(file.name) === 'csv'
  const blocks = isCsv
    ? parseCsvToBlocks(docId, arrayBuffer)
    : parseXlsxToBlocks(docId, arrayBuffer)
  const mime = resolveMime(file)
  const spreadsheetMime = isCsv ? 'text/csv' : resolveSpreadsheetMime(mime, file.name)

  const role = await resolveDocumentRoleForIngest(
    docId,
    useSessionStore.getState().documents,
    spreadsheetMime,
  )

  const document: DocumentMeta = {
    doc_id: docId,
    filename: file.name,
    mime: spreadsheetMime,
    role,
    uploaded_at: new Date().toISOString(),
  }

  reportFileProgress(options, fileIndex, totalFiles, file.name, 80, 'Saving blocks')
  await persistIngestBlocks(document, blocks)
  reportFileProgress(options, fileIndex, totalFiles, file.name, 100, 'Done')

  return {
    doc_id: docId,
    filename: file.name,
    mime: document.mime,
    block_count: blocks.length,
    ocr_used: false,
    role: document.role,
  }
}

export async function ingestFile(
  file: File,
  options: IngestOptions = {},
  fileIndex = 0,
  totalFiles = 1,
): Promise<IngestResult> {
  if (!isAcceptedUploadFile(file)) {
    throw new Error(`Unsupported file type: ${file.name}`)
  }

  const docId = await stableDocIdFromFile(file)
  const ocrEnabled = options.ocrEnabled ?? true
  const format = detectIngestFormat(file)

  switch (format) {
    case 'pdf':
      return ingestPdf(file, docId, ocrEnabled, options, fileIndex, totalFiles)
    case 'markdown':
      return ingestMarkdown(file, docId, options, fileIndex, totalFiles)
    case 'word':
      return ingestDocx(file, docId, options, fileIndex, totalFiles)
    case 'excel':
      return ingestExcel(file, docId, options, fileIndex, totalFiles)
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
  const total = files.length

  for (let index = 0; index < files.length; index++) {
    const file = files[index]!
    reportFileProgress(options, index, total, file.name, 0, 'Starting')

    try {
      results.push(await ingestFile(file, options, index, total))
    } catch (error) {
      errors.push({
        filename: file.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    options.onProgress?.({
      completed: index + 1,
      total,
      percent: computeIngestPercent(index + 1, total, 0),
      currentFilename: file.name,
      filePercent: 100,
      phase: 'Complete',
    })
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

  useSessionStore.getState().commitIngestResults([ingested])
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

/** Dev harness — ingest sample .docx; verify DuckDB blocks with section_path (BDA-080) */
export async function runDocxIngestHarness(): Promise<void> {
  const response = await fetch('/sample/minimal.docx')
  if (!response.ok) {
    throw new Error(`Docx ingest harness: failed to load sample docx (${response.status})`)
  }

  const blob = await response.blob()
  const file = new File([blob], 'harness-sample.docx', { type: DOCX_MIME })
  const ingested = await ingestFile(file)

  if (ingested.block_count < 2) {
    throw new Error('Docx ingest harness: expected multiple blocks')
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
    throw new Error('Docx ingest harness: expected document row in DuckDB')
  }

  const withSectionPath = blocks.filter((block) => block.section_path?.includes('Statement of Work'))
  if (withSectionPath.length === 0) {
    throw new Error('Docx ingest harness: expected section_path from Word headings')
  }

  const nestedSection = blocks.find((block) => block.section_path?.includes('Deliverables'))
  if (!nestedSection) {
    throw new Error('Docx ingest harness: expected nested heading section_path')
  }
}

/** Dev harness — ingest sample .xlsx; verify DuckDB blocks with sheet cell-range paths (BDA-081) */
export async function runXlsxIngestHarness(): Promise<void> {
  const response = await fetch('/sample/minimal.xlsx')
  if (!response.ok) {
    throw new Error(`Xlsx ingest harness: failed to load sample xlsx (${response.status})`)
  }

  const blob = await response.blob()
  const file = new File([blob], 'harness-sample.xlsx', { type: XLSX_MIME })
  const ingested = await ingestFile(file)

  if (ingested.block_count < 2) {
    throw new Error('Xlsx ingest harness: expected multiple row blocks')
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
    throw new Error('Xlsx ingest harness: expected document row in DuckDB')
  }

  const sheetBlocks = blocks.filter((block) => block.section_path?.includes('RFP Checklist'))
  if (sheetBlocks.length === 0) {
    throw new Error('Xlsx ingest harness: expected section_path with sheet name')
  }

  if (!blocks.some((block) => block.text.includes('CMMI Level 3'))) {
    throw new Error('Xlsx ingest harness: expected row text from sample spreadsheet')
  }
}
