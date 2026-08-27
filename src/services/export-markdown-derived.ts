import * as XLSX from 'xlsx'

import type { BlockRecord, DocumentMeta } from '@/lib/types'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { buildDocumentMarkdownExport } from '@/services/export-document-markdown'
import { buildProposalPdfBytes } from '@/services/export-proposal-pdf'
import { markdownToDocxBytes } from '@/services/markdown-to-docx'
import { parseMarkdownToBlocks } from '@/services/markdown-ingest'

function stemFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/i, '').trim() || 'document'
}

export function markdownPdfExportFilename(filename: string): string {
  return `${stemFromFilename(filename)}.pdf`
}

export function markdownExcelExportFilename(filename: string): string {
  return `${stemFromFilename(filename)}.xlsx`
}

export function markdownWordExportFilename(filename: string): string {
  return `${stemFromFilename(filename)}.docx`
}

function stripYamlFrontMatter(markdown: string): string {
  const trimmed = markdown.trimStart()
  if (!trimmed.startsWith('---')) return markdown
  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return markdown
  return trimmed.slice(end + 4).trimStart()
}

async function blocksForMarkdownExport(document: DocumentMeta): Promise<BlockRecord[]> {
  const blocks = await fetchDocumentBlocks(document.doc_id)
  if (blocks.length > 0) return blocks

  const bytes = getDocumentBytes(document.doc_id)
  if (!bytes) return []

  const text = new TextDecoder('utf-8').decode(bytes)
  return parseMarkdownToBlocks(document.doc_id, text)
}

function blocksToWorkbook(blocks: BlockRecord[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()
  const rows: string[][] = [['Section', 'Text']]

  for (const block of blocks) {
    rows.push([block.section_path?.trim() ?? '', block.text.trim()])
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Content')
  return workbook
}

/** Render markdown document content to PDF (plain-text layout). */
export async function buildMarkdownDocumentPdfBytes(document: DocumentMeta): Promise<Uint8Array> {
  const markdown = await buildDocumentMarkdownExport(document)
  const body = stripYamlFrontMatter(markdown)
  return buildProposalPdfBytes(body)
}

/** Render markdown source to a Word document (GFM headings, tables, links, inline styles). */
export async function buildMarkdownDocxBytes(markdown: string): Promise<Uint8Array> {
  return markdownToDocxBytes(markdown)
}

/** Export markdown document content to Word (.docx). */
export async function buildMarkdownDocumentDocxBytes(document: DocumentMeta): Promise<Uint8Array> {
  const markdown = await buildDocumentMarkdownExport(document)
  const body = stripYamlFrontMatter(markdown)
  return buildMarkdownDocxBytes(body)
}

/** Export markdown blocks (or parsed source) to a two-column Excel workbook. */
export async function buildMarkdownDocumentExcelBytes(document: DocumentMeta): Promise<Uint8Array> {
  const blocks = await blocksForMarkdownExport(document)

  if (blocks.length === 0) {
    const markdown = await buildDocumentMarkdownExport(document)
    const body = stripYamlFrontMatter(markdown).trim()
    if (!body) {
      throw new Error('Markdown document contains no extractable content for Excel export.')
    }

    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Section', 'Text'],
      ['', body],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Content')
    return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }))
  }

  const workbook = blocksToWorkbook(blocks)
  return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }))
}

/** Dev harness — markdown → PDF / Excel smoke */
export async function runExportMarkdownDerivedHarness(): Promise<void> {
  const sampleBlocks = parseMarkdownToBlocks(
    'harness-md',
    '# Buyer Rubric\n\nMandatory requirements.\n\n## Technical\n\n- Item one\n- Item two',
  )
  const workbook = blocksToWorkbook(sampleBlocks)
  const xlsxBytes = new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }))

  if (xlsxBytes.length < 120) {
    throw new Error('runExportMarkdownDerivedHarness: Excel output unexpectedly small')
  }

  const pdfBytes = await buildProposalPdfBytes('# Buyer Rubric\n\nMandatory requirements.')
  if (pdfBytes.length < 800) {
    throw new Error('runExportMarkdownDerivedHarness: PDF output unexpectedly small')
  }

  if (markdownExcelExportFilename('buyer-rubric.md') !== 'buyer-rubric.xlsx') {
    throw new Error('runExportMarkdownDerivedHarness: unexpected Excel filename')
  }

  const docxBytes = await buildMarkdownDocxBytes(
    '# Buyer Rubric\n\n**Mandatory** requirements.\n\n| Item | Status |\n| --- | --- |\n| Alpha | Green |',
  )
  if (docxBytes.length < 2_000 || docxBytes[0] !== 0x50 || docxBytes[1] !== 0x4b) {
    throw new Error('runExportMarkdownDerivedHarness: DOCX output missing zip signature')
  }

  if (markdownWordExportFilename('buyer-rubric.md') !== 'buyer-rubric.docx') {
    throw new Error('runExportMarkdownDerivedHarness: unexpected Word filename')
  }
}
