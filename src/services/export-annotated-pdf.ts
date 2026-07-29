import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import { DOCUMENT_ROLE_LABELS } from '@/lib/document-roles'
import { liteParseBboxToPdfUserSpace } from '@/lib/citation-bbox'
import { beginBlobSave } from '@/lib/download-blob'
import { addHighlightAnnotation, addTextNoteAnnotation } from '@/lib/pdf-export-annotations'
import { toPdfLatinText } from '@/lib/pdf-latin-text'
import type { Bbox, CommentRecord, DocumentMeta } from '@/lib/types'
import {
  fetchAnnotatedBlocksForExport,
  type AnnotatedBlockExport,
} from '@/services/block-comments'
import { getDocumentBytes } from '@/services/document-bytes-cache'

export type ExportCommentMode = 'markup' | 'burned-in'

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

function formatCommentForExport(
  comment: CommentRecord,
  index: number,
  total: number,
): string {
  const numbered = total > 1 ? `${index + 1}. ` : ''
  const author =
    comment.author_initials && comment.author_initials !== '?'
      ? `[${comment.author_initials}] `
      : ''
  return `${numbered}${author}${comment.text}`
}

function formatAnnotationContents(entry: AnnotatedBlockExport): string {
  return entry.comments
    .map((comment, index) => formatCommentForExport(comment, index, entry.comments.length))
    .join('\n')
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
    lines.push(
      ...wrapText(
        formatCommentForExport(comment, index, entry.comments.length),
        maxWidth,
        font,
        fontSize,
      ),
    )
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

const BURNED_IN_MARGIN_LEFT = 10
const BURNED_IN_CONTENT_GAP = 8
const BURNED_IN_MIN_NOTE_WIDTH = 72
const BURNED_IN_MAX_NOTE_WIDTH = 168
const BURNED_IN_NOTE_GAP = 8
const BURNED_IN_PAGE_BOTTOM = 48

function blockPdfBbox(block: AnnotatedBlockExport['block'], pageHeight: number): Bbox | null {
  if (!hasBbox(block)) return null
  return liteParseBboxToPdfUserSpace(
    { x: block.x, y: block.y, width: block.width, height: block.height },
    pageHeight,
  )
}

function contentLeftEdgeForPage(entries: AnnotatedBlockExport[], pageHeight: number): number {
  let contentLeft = Number.POSITIVE_INFINITY
  for (const entry of entries) {
    const bbox = blockPdfBbox(entry.block, pageHeight)
    if (bbox) contentLeft = Math.min(contentLeft, bbox.x)
  }
  return Number.isFinite(contentLeft) ? contentLeft : 72
}

function marginNoteWidth(contentLeft: number): number {
  const available = contentLeft - BURNED_IN_MARGIN_LEFT - BURNED_IN_CONTENT_GAP
  return Math.max(
    BURNED_IN_MIN_NOTE_WIDTH,
    Math.min(BURNED_IN_MAX_NOTE_WIDTH, available),
  )
}

type PlacedMarginNote = {
  bottom: number
  top: number
}

function resolveMarginNoteY(
  preferredY: number,
  noteHeight: number,
  placed: PlacedMarginNote[],
  pageHeight: number,
): number {
  let candidate = Math.max(BURNED_IN_PAGE_BOTTOM, preferredY)

  for (let attempt = 0; attempt < placed.length + 4; attempt += 1) {
    const candidateTop = candidate + noteHeight
    const collision = placed.find(
      (note) =>
        !(
          candidateTop + BURNED_IN_NOTE_GAP < note.bottom ||
          candidate > note.top + BURNED_IN_NOTE_GAP
        ),
    )

    if (!collision) {
      return Math.min(candidate, pageHeight - noteHeight - 12)
    }

    candidate = collision.bottom - BURNED_IN_NOTE_GAP - noteHeight
  }

  return Math.max(BURNED_IN_PAGE_BOTTOM, preferredY)
}

function drawMarginNoteBox(
  page: PDFPage,
  anchorX: number,
  anchorY: number,
  noteWidth: number,
  noteHeight: number,
  noteLines: string[],
  boldFont: PDFFont,
  lineHeight: number,
  notePadding: number,
): void {
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

function drawBurnedInPageAnnotations(
  page: PDFPage,
  pageHeight: number,
  entries: AnnotatedBlockExport[],
  font: PDFFont,
  boldFont: PDFFont,
): void {
  const contentLeft = contentLeftEdgeForPage(entries, pageHeight)
  const noteWidth = marginNoteWidth(contentLeft)
  const anchorX = BURNED_IN_MARGIN_LEFT
  const lineHeight = 10
  const notePadding = 6

  const sorted = [...entries].sort((left, right) => {
    const leftBbox = blockPdfBbox(left.block, pageHeight)
    const rightBbox = blockPdfBbox(right.block, pageHeight)
    const leftY = leftBbox?.y ?? 0
    const rightY = rightBbox?.y ?? 0
    return rightY - leftY
  })

  const placed: PlacedMarginNote[] = []

  sorted.forEach((entry, index) => {
    const noteLines = buildCommentBody(entry, font, 8, noteWidth - 12)
    const noteHeight = noteLines.length * lineHeight + notePadding * 2
    const pdfBbox = blockPdfBbox(entry.block, pageHeight)

    if (pdfBbox) {
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
    }

    const preferredY = pdfBbox
      ? pdfBbox.y + (pdfBbox.height - noteHeight) / 2
      : pageHeight - 96 - index * (noteHeight + BURNED_IN_NOTE_GAP)

    const anchorY = resolveMarginNoteY(preferredY, noteHeight, placed, pageHeight)
    placed.push({ bottom: anchorY, top: anchorY + noteHeight })

    drawMarginNoteBox(
      page,
      anchorX,
      anchorY,
      noteWidth,
      noteHeight,
      noteLines,
      boldFont,
      lineHeight,
      notePadding,
    )
  })
}

function addMarkupBlockAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  pageHeight: number,
  entry: AnnotatedBlockExport,
  noteIndex: number,
): void {
  const { block } = entry
  const contents = formatAnnotationContents(entry)

  if (hasBbox(block)) {
    const pdfBbox = liteParseBboxToPdfUserSpace(
      { x: block.x, y: block.y, width: block.width, height: block.height },
      pageHeight,
    )
    addHighlightAnnotation(pdfDoc, page, pdfBbox, contents)
    return
  }

  addTextNoteAnnotation(pdfDoc, page, 48, pageHeight - 72 - noteIndex * 28, contents)
}

function annotatedExportFilename(filename: string, mode: ExportCommentMode): string {
  const base = filename.replace(/\.pdf$/i, '')
  const suffix = mode === 'markup' ? 'scoper-markup' : 'scoper-export'
  return `${base}-${suffix}.pdf`
}

export { annotatedExportFilename }

export type ExportAnnotatedPdfOptions = {
  commentMode?: ExportCommentMode
}

/** Build a PDF copy with role metadata and review notes. */
export async function exportAnnotatedPdf(
  document: DocumentMeta,
  options: ExportAnnotatedPdfOptions = {},
): Promise<Uint8Array> {
  const commentMode = options.commentMode ?? 'markup'

  if (document.mime !== 'application/pdf') {
    throw new Error('Annotated export is available for PDF documents only.')
  }

  const bytes = getDocumentBytes(document.doc_id)
  if (!bytes) {
    throw new Error('Original PDF bytes are unavailable for this session. Re-upload the document.')
  }

  const annotatedBlocks = await fetchAnnotatedBlocksForExport(document.doc_id)
  const pdfDoc = await PDFDocument.load(bytes.slice(), { ignoreEncryption: true })
  const pages = pdfDoc.getPages()

  pdfDoc.setTitle(document.filename)
  pdfDoc.setSubject(
    `Scoper export · ${DOCUMENT_ROLE_LABELS[document.role]} · ${commentMode === 'markup' ? 'toggleable markup' : 'burned-in notes'}`,
  )
  pdfDoc.setKeywords([`role:${document.role}`, 'scoper-export', `comment-mode:${commentMode}`])
  pdfDoc.setProducer('Scoper')

  if (commentMode === 'burned-in' && pages.length > 0) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    drawExportBanner(pages[0], document, annotatedBlocks.length, font, boldFont)
  }

  const notesByPage = new Map<number, AnnotatedBlockExport[]>()
  for (const entry of annotatedBlocks) {
    const pageNum = entry.block.page_num ?? 1
    const bucket = notesByPage.get(pageNum) ?? []
    bucket.push(entry)
    notesByPage.set(pageNum, bucket)
  }

  if (commentMode === 'burned-in') {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    for (const [pageNum, entries] of notesByPage) {
      if (pageNum < 1 || pageNum > pages.length) continue
      const page = pages[pageNum - 1]
      const pageHeight = page.getHeight()

      drawBurnedInPageAnnotations(page, pageHeight, entries, font, boldFont)
    }
  } else {
    for (const [pageNum, entries] of notesByPage) {
      if (pageNum < 1 || pageNum > pages.length) continue
      const page = pages[pageNum - 1]
      const pageHeight = page.getHeight()

      entries.forEach((entry, index) => {
        addMarkupBlockAnnotation(pdfDoc, page, pageHeight, entry, index)
      })
    }
  }

  return pdfDoc.save()
}

export async function downloadAnnotatedPdf(
  document: DocumentMeta,
  options: ExportAnnotatedPdfOptions = {},
): Promise<void> {
  const commentMode = options.commentMode ?? 'markup'
  const filename = annotatedExportFilename(document.filename, commentMode)
  const writeBlob = await beginBlobSave({
    filename,
    mime: 'application/pdf',
    extension: '.pdf',
  })

  const pdfBytes = await exportAnnotatedPdf(document, { commentMode })
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

  const pdfBytes = await exportAnnotatedPdf(
    {
      doc_id: ingested.doc_id,
      filename: ingested.filename,
      mime: ingested.mime,
      role: 'baseline',
      uploaded_at: new Date().toISOString(),
    },
    { commentMode: 'markup' },
  )

  if (pdfBytes.byteLength < 100) {
    throw new Error('runAnnotatedPdfExportHarness failed: exported PDF too small')
  }
}
