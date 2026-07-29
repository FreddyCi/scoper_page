import type { BlockRecord, DocumentMeta } from '@/lib/types'
import type {
  LiteParseMarkdownAnnotation,
  LiteParseMarkdownFormField,
  LiteParseMarkdownResult,
} from '@/lib/liteparse-protocol'
import type { DocumentCommentEntry } from '@/services/block-comments'

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

/** Fallback markdown when LiteParse markdown output is empty (e.g. scanned PDF + OCR). */
export function blocksToMarkdown(document: DocumentMeta, blocks: BlockRecord[]): string {
  if (blocks.length === 0) return ''

  const byPage = new Map<number, BlockRecord[]>()
  for (const block of blocks) {
    const pageNum = block.page_num ?? 0
    const pageBlocks = byPage.get(pageNum) ?? []
    pageBlocks.push(block)
    byPage.set(pageNum, pageBlocks)
  }

  const sections: string[] = [`# ${document.filename}`, '']
  for (const pageNum of [...byPage.keys()].sort((left, right) => left - right)) {
    const pageBlocks = byPage.get(pageNum) ?? []
    if (pageNum > 0) {
      sections.push(`## Page ${pageNum}`, '')
    }

    for (const block of pageBlocks) {
      const text = block.text.trim()
      if (!text) continue
      sections.push(text, '')
    }
  }

  return sections.join('\n').trim()
}

function markdownFrontMatter(document: DocumentMeta): string {
  const lines = [
    '---',
    `title: ${JSON.stringify(document.filename)}`,
    `doc_id: ${document.doc_id}`,
    `role: ${document.role}`,
    `exported_at: ${new Date().toISOString()}`,
    'parser: LiteParse (browser WASM)',
    '---',
    '',
  ]
  return lines.join('\n')
}

function appendixPdfAnnotations(annotations: LiteParseMarkdownAnnotation[]): string {
  if (annotations.length === 0) return ''

  const lines = ['## PDF annotations', '']
  for (const annotation of annotations) {
    const label = annotation.subtype || 'Annotation'
    const heading = `### Page ${annotation.pageNum} — ${label}`
    lines.push(heading, '')
    if (annotation.title?.trim()) {
      lines.push(`**Author:** ${annotation.title.trim()}`, '')
    }
    if (annotation.contents?.trim()) {
      lines.push(`> ${annotation.contents.trim().replace(/\n/g, '\n> ')}`, '')
    }
  }

  return `${lines.join('\n').trim()}\n`
}

function appendixFormFields(formFields: LiteParseMarkdownFormField[]): string {
  if (formFields.length === 0) return ''

  const lines = [
    '## PDF form fields',
    '',
    '| Field | Page | Type | Value |',
    '| --- | ---: | --- | --- |',
  ]

  for (const field of formFields) {
    lines.push(
      `| ${escapeTableCell(field.name?.trim() || '(unnamed)')} | ${field.page} | ${escapeTableCell(field.type)} | ${escapeTableCell(field.value?.trim() || '')} |`,
    )
  }

  return `${lines.join('\n')}\n`
}

function appendixScoperReviewNotes(entries: DocumentCommentEntry[]): string {
  if (entries.length === 0) return ''

  const lines = ['## Scoper review notes', '']
  for (const entry of entries) {
    const pageLabel =
      entry.block.page_num != null ? `Page ${entry.block.page_num}` : 'Unknown page'
    const excerpt = entry.block.text.trim().slice(0, 120)
    const excerptSuffix = entry.block.text.trim().length > 120 ? '…' : ''
    lines.push(`### ${pageLabel}`, '')
    if (excerpt) {
      lines.push(`> ${excerpt}${excerptSuffix}`, '')
    }
    lines.push(
      `- **${entry.comment.author_initials}** (${entry.comment.created_at}): ${entry.comment.text.trim()}`,
      '',
    )
  }

  return lines.join('\n').trim()
}

export type AssemblePdfMarkdownOptions = {
  document: DocumentMeta
  parseResult: LiteParseMarkdownResult
  scoperComments?: DocumentCommentEntry[]
  /** When LiteParse markdown is empty, use OCR/block fallback body instead. */
  fallbackBody?: string
}

export function assemblePdfMarkdown({
  document,
  parseResult,
  scoperComments = [],
  fallbackBody,
}: AssemblePdfMarkdownOptions): string {
  const body = parseResult.markdown.trim() || fallbackBody?.trim() || ''
  const sections = [markdownFrontMatter(document), body]

  const annotationAppendix = appendixPdfAnnotations(parseResult.annotations)
  if (annotationAppendix) sections.push('', annotationAppendix)

  const formAppendix = appendixFormFields(parseResult.formFields)
  if (formAppendix) sections.push('', formAppendix)

  const reviewAppendix = appendixScoperReviewNotes(scoperComments)
  if (reviewAppendix) sections.push('', reviewAppendix)

  return sections.join('\n').trim() + '\n'
}

export function markdownExportFilename(pdfFilename: string): string {
  const base = pdfFilename.replace(/\.pdf$/i, '').trim() || 'document'
  return `${base}.md`
}
