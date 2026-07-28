import mammoth from 'mammoth'

import type { BlockRecord } from '@/lib/types'

const BLOCK_TAGS = new Set(['p', 'li', 'td', 'th', 'blockquote', 'pre'])

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function headingLevel(tagName: string): number | null {
  const match = /^h([1-6])$/i.exec(tagName)
  return match ? Number(match[1]) : null
}

/** Walk mammoth HTML output and emit paragraph blocks with heading breadcrumbs */
export function htmlToDocxBlocks(docId: string, html: string): BlockRecord[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: BlockRecord[] = []
  const headingTrail: string[] = []
  let sectionIndex = -1
  let blockIndex = 0

  function pushBlock(text: string) {
    const pageNum = Math.max(sectionIndex, 0) + 1
    blocks.push({
      block_id: `${docId}:docx-${Math.max(sectionIndex, 0)}-${blockIndex}`,
      doc_id: docId,
      page_num: pageNum,
      section_path: headingTrail.length > 0 ? headingTrail.join(' › ') : undefined,
      text,
    })
    blockIndex += 1
  }

  function walk(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const element = node as Element
    const tag = element.tagName.toLowerCase()
    const level = headingLevel(tag)

    if (level != null) {
      const title = normalizeText(element.textContent ?? '')
      if (title) {
        sectionIndex += 1
        blockIndex = 0
        headingTrail.splice(level - 1)
        headingTrail[level - 1] = title
        headingTrail.length = level
      }
      return
    }

    if (BLOCK_TAGS.has(tag)) {
      const text = normalizeText(element.textContent ?? '')
      if (text) {
        pushBlock(text)
      }
      return
    }

    for (const child of element.childNodes) {
      walk(child)
    }
  }

  if (doc.body) {
    for (const child of doc.body.childNodes) {
      walk(child)
    }
  }

  return blocks
}

/** Parse .docx bytes via mammoth → HTML → DuckDB blocks with section_path (BDA-080) */
export async function parseDocxToBlocks(docId: string, bytes: ArrayBuffer): Promise<BlockRecord[]> {
  const result = await mammoth.convertToHtml({ arrayBuffer: bytes })
  const blocks = htmlToDocxBlocks(docId, result.value)

  if (blocks.length === 0) {
    throw new Error('Word document contains no extractable text')
  }

  return blocks
}
