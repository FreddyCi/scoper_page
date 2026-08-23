import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import { toPdfLatinText } from '@/lib/pdf-latin-text'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 54
const MARGIN_TOP = 54
const MARGIN_BOTTOM = 54
const LINE_HEIGHT_RATIO = 1.35

type MarkdownLineStyle = {
  fontSize: number
  bold: boolean
  indent: number
  color: { r: number; g: number; b: number }
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = toPdfLatinText(text).split(' ').filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = words[0] ?? ''

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index]
    const candidate = `${current} ${word}`
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

function styleForMarkdownLine(line: string): MarkdownLineStyle {
  if (line.startsWith('# ')) {
    return { fontSize: 16, bold: true, indent: 0, color: { r: 0.1, g: 0.1, b: 0.12 } }
  }
  if (line.startsWith('## ')) {
    return { fontSize: 13, bold: true, indent: 0, color: { r: 0.12, g: 0.12, b: 0.15 } }
  }
  if (line.startsWith('### ')) {
    return { fontSize: 11.5, bold: true, indent: 0, color: { r: 0.15, g: 0.15, b: 0.18 } }
  }
  if (line.startsWith('> ')) {
    return { fontSize: 10, bold: false, indent: 12, color: { r: 0.35, g: 0.35, b: 0.4 } }
  }
  if (line.startsWith('- ')) {
    return { fontSize: 10, bold: false, indent: 14, color: { r: 0.2, g: 0.2, b: 0.24 } }
  }
  if (line === '---') {
    return { fontSize: 10, bold: false, indent: 0, color: { r: 0.5, g: 0.5, b: 0.55 } }
  }
  if (line.startsWith('_') && line.endsWith('_')) {
    return { fontSize: 10, bold: false, indent: 0, color: { r: 0.4, g: 0.4, b: 0.45 } }
  }
  return { fontSize: 10.5, bold: false, indent: 0, color: { r: 0.15, g: 0.15, b: 0.18 } }
}

function stripMarkdownPrefix(line: string): string {
  if (line === '---') return '—'
  if (line.startsWith('# ')) return line.slice(2).trim()
  if (line.startsWith('## ')) return line.slice(3).trim()
  if (line.startsWith('### ')) return line.slice(4).trim()
  if (line.startsWith('> ')) return line.slice(2).trim()
  if (line.startsWith('- ')) return line.slice(2).trim()
  if (line.startsWith('_') && line.endsWith('_')) return line.slice(1, -1).trim()
  return line
}

type PdfWriter = {
  page: PDFPage
  cursorY: number
  regularFont: PDFFont
  boldFont: PDFFont
}

function addPage(writer: PdfWriter, pdf: PDFDocument): PdfWriter {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  return { ...writer, page, cursorY: PAGE_HEIGHT - MARGIN_TOP }
}

function ensureSpace(writer: PdfWriter, pdf: PDFDocument, needed: number): PdfWriter {
  if (writer.cursorY - needed >= MARGIN_BOTTOM) return writer
  return addPage(writer, pdf)
}

function drawLine(
  writer: PdfWriter,
  pdf: PDFDocument,
  text: string,
  style: MarkdownLineStyle,
): PdfWriter {
  const font = style.bold ? writer.boldFont : writer.regularFont
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2 - style.indent
  const content = stripMarkdownPrefix(text)
  const lines =
    content.trim().length === 0 ? [] : wrapText(content, maxWidth, font, style.fontSize)
  const lineHeight = style.fontSize * LINE_HEIGHT_RATIO
  const blockHeight = lines.length > 0 ? lines.length * lineHeight + 4 : lineHeight

  let next = ensureSpace(writer, pdf, blockHeight)
  next = { ...next, cursorY: next.cursorY - 4 }

  for (const line of lines) {
    next = ensureSpace(next, pdf, lineHeight)
    next.page.drawText(line, {
      x: MARGIN_X + style.indent,
      y: next.cursorY - style.fontSize,
      size: style.fontSize,
      font,
      color: rgb(style.color.r, style.color.g, style.color.b),
    })
    next = { ...next, cursorY: next.cursorY - lineHeight }
  }

  return next
}

/** Render assembled proposal markdown to a downloadable PDF (plain text layout). */
export async function buildProposalPdfBytes(markdown: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  let writer: PdfWriter = {
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    cursorY: PAGE_HEIGHT - MARGIN_TOP,
    regularFont,
    boldFont,
  }

  const normalized = markdown.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    writer = drawLine(writer, pdf, 'Empty proposal export.', {
      fontSize: 11,
      bold: false,
      indent: 0,
      color: { r: 0.2, g: 0.2, b: 0.24 },
    })
  } else {
    for (const rawLine of normalized.split('\n')) {
      const line = rawLine.trimEnd()
      if (!line.trim()) {
        writer = { ...writer, cursorY: writer.cursorY - 8 }
        continue
      }
      writer = drawLine(writer, pdf, line, styleForMarkdownLine(line))
    }
  }

  return pdf.save()
}

export function proposalPdfExportFilename(
  rfpFilename: string,
  exportMode: 'complete' | 'drafted-only' = 'complete',
): string {
  const stem = rfpFilename.replace(/\.[^.]+$/i, '').trim() || 'proposal'
  const safe = stem.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const suffix = exportMode === 'drafted-only' ? 'partial-draft' : 'draft'
  return `${safe || 'proposal'}-${suffix}.pdf`
}

/** Dev harness — proposal PDF bytes smoke */
export async function runExportProposalPdfHarness(): Promise<void> {
  const bytes = await buildProposalPdfBytes(
    '# Volume: Technical\n\n## Approach\n\nSample body text for export.',
  )
  if (bytes.length < 800) {
    throw new Error('runExportProposalPdfHarness: PDF output unexpectedly small')
  }
}
