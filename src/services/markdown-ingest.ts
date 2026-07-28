import type { BlockRecord } from '@/lib/types'

const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/

function normalizeMarkdownText(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').replace(/\uFEFF/g, '').trim()
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Split markdown into heading sections with breadcrumb paths (BDA-081) */
export function splitMarkdownByHeadings(markdown: string): Array<{ sectionPath: string; body: string }> {
  const normalized = normalizeMarkdownText(markdown)
  if (!normalized) return []

  const lines = normalized.split('\n')
  const sections: Array<{ sectionPath: string; body: string }> = []
  const headingTrail: string[] = []
  let bodyLines: string[] = []

  function flushSection() {
    const body = bodyLines.join('\n').trim()
    bodyLines = []

    if (!body) return

    sections.push({
      sectionPath: headingTrail.join(' › '),
      body,
    })
  }

  for (const line of lines) {
    const headingMatch = HEADING_PATTERN.exec(line.trim())
    if (headingMatch) {
      flushSection()
      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      headingTrail.splice(level - 1)
      headingTrail[level - 1] = title
      headingTrail.length = level
      continue
    }

    bodyLines.push(line)
  }

  flushSection()

  if (sections.length === 0) {
    return [{ sectionPath: '', body: normalized }]
  }

  return sections
}

/** Convert markdown into DuckDB block records — headings → section_path, paragraphs → blocks */
export function parseMarkdownToBlocks(docId: string, markdown: string): BlockRecord[] {
  const sections = splitMarkdownByHeadings(markdown)
  const blocks: BlockRecord[] = []

  for (const [sectionIndex, section] of sections.entries()) {
    const paragraphs = splitParagraphs(section.body)

    for (const [paragraphIndex, text] of paragraphs.entries()) {
      blocks.push({
        block_id: `${docId}:md-${sectionIndex}-${paragraphIndex}`,
        doc_id: docId,
        page_num: sectionIndex + 1,
        section_path: section.sectionPath || undefined,
        text,
      })
    }
  }

  return blocks
}
