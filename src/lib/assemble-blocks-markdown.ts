import type { BlockRecord, DocumentMeta } from '@/lib/types'

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export function markdownFrontMatterForDocument(
  document: DocumentMeta,
  parserLabel: string,
): string {
  const lines = [
    '---',
    `title: ${JSON.stringify(document.filename)}`,
    `doc_id: ${document.doc_id}`,
    `role: ${document.role}`,
    `exported_at: ${new Date().toISOString()}`,
    `parser: ${parserLabel}`,
    '---',
    '',
  ]
  return lines.join('\n')
}

/** Word / generic blocks — section_path breadcrumbs become headings. */
export function wordBlocksToMarkdown(document: DocumentMeta, blocks: BlockRecord[]): string {
  if (blocks.length === 0) return ''

  const sections: string[] = [`# ${document.filename}`, '']
  let lastPath = ''

  for (const block of blocks) {
    const path = block.section_path?.trim() ?? ''
    if (path && path !== lastPath) {
      sections.push(`## ${path}`, '')
      lastPath = path
    }

    const text = block.text.trim()
    if (!text) continue
    sections.push(text, '')
  }

  return sections.join('\n').trim()
}

function sheetNameFromSectionPath(sectionPath: string | undefined): string {
  if (!sectionPath) return 'Sheet'
  const parts = sectionPath.split('›').map((part) => part.trim())
  return parts[0] || 'Sheet'
}

function rowCellsFromBlock(block: BlockRecord): string[] {
  return block.text.split(' | ').map((cell) => cell.trim())
}

/** Spreadsheet ingest blocks → GFM tables grouped by sheet. */
export function spreadsheetBlocksToMarkdown(
  document: DocumentMeta,
  blocks: BlockRecord[],
): string {
  if (blocks.length === 0) return ''

  const bySheet = new Map<string, BlockRecord[]>()
  for (const block of blocks) {
    const sheet = sheetNameFromSectionPath(block.section_path)
    const list = bySheet.get(sheet) ?? []
    list.push(block)
    bySheet.set(sheet, list)
  }

  const sections: string[] = [`# ${document.filename}`, '']

  for (const [sheetName, sheetBlocks] of bySheet) {
    sections.push(`## ${sheetName}`, '')

    const rows = sheetBlocks.map((block) => rowCellsFromBlock(block))
    const colCount = Math.max(...rows.map((row) => row.length), 1)
    const normalized = rows.map((row) => {
      const copy = [...row]
      while (copy.length < colCount) copy.push('')
      return copy
    })

    if (normalized.length === 0) continue

    const header = normalized[0]!
    const hasHeader = header.some((cell) => cell.length > 0)
    const bodyRows = hasHeader ? normalized.slice(1) : normalized
    const tableHeader = hasHeader ? header : normalized[0]!.map((_, index) => `Col ${index + 1}`)

    sections.push(
      `| ${tableHeader.map(escapeTableCell).join(' | ')} |`,
      `| ${tableHeader.map(() => '---').join(' | ')} |`,
    )

    for (const row of hasHeader ? bodyRows : normalized) {
      sections.push(`| ${row.map(escapeTableCell).join(' | ')} |`)
    }
    sections.push('')
  }

  return sections.join('\n').trim()
}

export function assembleBlocksMarkdownExport(
  document: DocumentMeta,
  body: string,
  parserLabel: string,
): string {
  const trimmed = body.trim()
  if (!trimmed) return ''
  return `${markdownFrontMatterForDocument(document, parserLabel)}\n${trimmed}\n`
}

export function markdownExportFilenameFromSource(filename: string): string {
  const base = filename.replace(/\.[^.]+$/i, '').trim() || 'document'
  return `${base}.md`
}

export function contextMarkdownFilenameFromSource(filename: string): string {
  const base = filename.replace(/\.[^.]+$/i, '').trim() || 'document'
  return `${base}-context.md`
}
