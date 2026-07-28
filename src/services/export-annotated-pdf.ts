import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import { DOCUMENT_ROLE_LABELS } from '@/lib/document-roles'
import { liteParseBboxToPdfUserSpace } from '@/lib/citation-bbox'
import { beginBlobSave } from '@/lib/download-blob'
import { toPdfLatinText } from '@/lib/pdf-latin-text'
import type { Bbox, DocumentMeta } from '@/lib/types'
import {
  fetchAnnotatedBlocksForExport,
  type AnnotatedBlockExport,
} from '@/services/block-comments'
import { getDocumentBytes } from '@/services/document-bytes-cache'

const HIGHLIGHT_COLOR = rgb(0.98, 0.75, 0.14)
const HIGHLIGHT_BORDER = rgb(0.85, 0.55, 0.05)
const NOTE_BG = rgb(1, 0.97, 0.88)
const NOTE_BORDER = rgb(0.85, 0.55, 0.05)
const BANNER_BG = rgb(0.12, 0.14, 0.18)
const BANNER_TEXT = rgb(0.95, 0.96, 0.98)

function hasBbox(block: AnnotatedBlockExport['block']): block is AnnotatedBlockExport['block'] & Bbox {
  return (
    block.x != null &&
    block.y != null &&
    block.width != null &&
    block.height != null &&
    block.width > 0 &&
    block.height > 0
  )
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

function buildCommentBody(
  entry: AnnotatedBlockExport,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = ['Review note']
  entry.comments.forEach((comment, index) => {
    const prefix = entry.comments.length > 1 ? `${index + 1}. ` : ''
    lines.push(...wrapText(`${prefix}${comment.text}`, maxWidth, font, fontSize))
  })
  return lines
}

function drawWrappedText(
  page: PDFPage,
  lines: string[],
  x: number,
  y: number,
  font: PDFFont,
  fontSize: number,
  color = rgb(0.15, 0.12, 0.08),
  lineHeight = fontSize * 1.25,
): void {
  let cursorY = y
  for (const line of lines) {
    page.drawText(line, { x: x + 6, y: cursorY, size: fontSize, font, color })
    cursorY -= lineHeight
  }
}

function drawExportBanner(
  page: PDFPage,
  document: DocumentMeta,
  commentCount: number,
  font: PDFFont,
  boldFont: PDFFont,
): void {
  const pageWidth = page.getWidth()
  const pageHeight = page.getHeight()
  const bannerHeight = 28
  const roleLabel = DOCUMENT_ROLE_LABELS[document.role]
  const noteLabel =
    commentCount === 0
      ? 'No review notes'
      : `${commentCount} review note${commentCount === 1 ? '' : 's'}`

  page.drawRectangle({
    x: 0,
    y: pageHeight - bannerHeight,
    width: pageWidth,
    height: bannerHeight,
    color: BANNER_BG,
  })

  page.drawText('Scoper export', {
    x: 12,
    y: pageHeight - bannerHeight + 9,
    size: 10,
    font: boldFont,
    color: BANNER_TEXT,
  })

  page.drawText(`Role: ${roleLabel}  |  ${noteLabel}`, {
    x: 108,
    y: pageHeight - bannerHeight + 9,
    size: 9,
    font,
    color: rgb(0.78, 0.8, 0.86),
  })
}

function drawBlockAnnotation(
  page: PDFPage,
  pageHeight: number,
  entry: AnnotatedBlockExport,
  font: PDFFont,
  boldFont: PDFFont,
  noteIndex: number,
): void {
  const { block } = entry
  const pageWidth = page.getWidth()
  const noteWidth = Math.min(240, pageWidth - 24)
  const noteLines = buildCommentBody(entry, font, 8, noteWidth - 12)
  const lineHeight = 10
  const notePadding = 6
  const noteHeight = noteLines.length * lineHeight + notePadding * 2

  let anchorX = 48
  let anchorY = pageHeight - 80 - noteIndex * (noteHeight + 12)

  if (hasBbox(block)) {
    const pdfBbox = liteParseBboxToPdfUserSpace(
      { x: block.x, y: block.y, width: block.width, height: block.height },
      pageHeight,
    )

    page.drawRectangle({
      x: pdfBbox.x,
      y: pdfBbox.y,
      width: pdfBbox.width,
      height: pdfBbox.height,
      color: HIGHLIGHT_COLOR,
      opacity: 0.35,
      borderColor: HIGHLIGHT_BORDER,
      borderWidth: 1,
    })

    anchorX = Math.min(Math.max(12, pdfBbox.x), pageWidth - noteWidth - 12)
    anchorY = Math.max(48, pdfBbox.y - noteHeight - 8)
  }

  page.drawRectangle({
    x: anchorX,
    y: anchorY,
    width: noteWidth,
    height: noteHeight,
    color: NOTE_BG,
    borderColor: NOTE_BORDER,
    borderWidth: 0.75,
  })

  drawWrappedText(
    page,
    noteLines,
    anchorX,
    anchorY + noteHeight - notePadding - 8,
    boldFont,
    8,
    rgb(0.35, 0.22, 0.02),
    lineHeight,
  )
}

function annotatedExportFilename(filename: string): string {
  const base = filename.replace(/\.pdf$/i, '')
  return `${base}-scoper-export.pdf`
}

export { annotatedExportFilename }

/** Build a PDF copy with role metadata, highlights, and review notes burned in. */
export async function exportAnnotatedPdf(document: DocumentMeta): Promise<Uint8Array> {
  if (document.mime !== 'application/pdf') {
    throw new Error('Annotated export is available for PDF documents only.')
  }

  const bytes = getDocumentBytes(document.doc_id)
  if (!bytes) {
    throw new Error('Original PDF bytes are unavailable for this session. Re-upload the document.')
  }

  const annotatedBlocks = await fetchAnnotatedBlocksForExport(document.doc_id)
  const pdfDoc = await PDFDocument.load(bytes.slice(), { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pages = pdfDoc.getPages()

  pdfDoc.setTitle(document.filename)
  pdfDoc.setSubject(`Scoper export · ${DOCUMENT_ROLE_LABELS[document.role]}`)
  pdfDoc.setKeywords([`role:${document.role}`, 'scoper-export'])
  pdfDoc.setProducer('Scoper')

  if (pages.length > 0) {
    drawExportBanner(pages[0], document, annotatedBlocks.length, font, boldFont)
  }

  const notesByPage = new Map<number, AnnotatedBlockExport[]>()
  for (const entry of annotatedBlocks) {
    const pageNum = entry.block.page_num ?? 1
    const bucket = notesByPage.get(pageNum) ?? []
    bucket.push(entry)
    notesByPage.set(pageNum, bucket)
  }

  for (const [pageNum, entries] of notesByPage) {
    if (pageNum < 1 || pageNum > pages.length) continue
    const page = pages[pageNum - 1]
    const pageHeight = page.getHeight()

    entries.forEach((entry, index) => {
      drawBlockAnnotation(page, pageHeight, entry, font, boldFont, index)
    })
  }

  return pdfDoc.save()
}

export async function downloadAnnotatedPdf(document: DocumentMeta): Promise<void> {
  const filename = annotatedExportFilename(document.filename)
  const writeBlob = await beginBlobSave({
    filename,
    mime: 'application/pdf',
    extension: '.pdf',
  })

  const pdfBytes = await exportAnnotatedPdf(document)
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
  await writeBlob(blob)
}

/** Dev harness — export annotated PDF bytes for a commented sample document */
export async function runAnnotatedPdfExportHarness(): Promise<void> {
  const { fetchDocumentBlocks } = await import('@/services/document-blocks')
  const { insertBlockComment } = await import('@/services/block-comments')
  const { ingestFile } = await import('@/services/ingest-router')

  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`runAnnotatedPdfExportHarness: failed to load sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const ingested = await ingestFile(new File([blob], 'export-harness.pdf', { type: 'application/pdf' }), {
    ocrEnabled: false,
  })

  const blocks = await fetchDocumentBlocks(ingested.doc_id)
  const firstBlock = blocks[0]
  if (!firstBlock) {
    throw new Error('runAnnotatedPdfExportHarness failed: expected blocks on sample PDF')
  }

  await insertBlockComment(firstBlock.block_id, 'Export harness review note.')

  const pdfBytes = await exportAnnotatedPdf({
    doc_id: ingested.doc_id,
    filename: ingested.filename,
    mime: ingested.mime,
    role: 'baseline',
    uploaded_at: new Date().toISOString(),
  })

  if (pdfBytes.byteLength < 100) {
    throw new Error('runAnnotatedPdfExportHarness failed: exported PDF too small')
  }
}
