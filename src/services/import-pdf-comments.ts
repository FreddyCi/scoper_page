import { isDocumentRole } from '@/lib/document-roles'
import { pdfUserSpaceToLiteParseBbox } from '@/lib/citation-bbox'
import { loadPdfDocument } from '@/lib/pdfjs-viewer'
import type { Bbox, BlockRecord, DocumentRole } from '@/lib/types'
import { insertBlockComment } from '@/services/block-comments'
import { persistDocumentRole } from '@/services/document-roles'

type PdfRect = [number, number, number, number]

type ImportedPdfAnnotation = {
  pageNum: number
  subtype: string
  contents: string
  rect: PdfRect
  title?: string
}

export type ScoperExportMetadata = {
  isScoperExport: boolean
  role: DocumentRole | null
  commentMode: 'markup' | 'burned-in' | null
}

export type ImportPdfCommentsResult = {
  importedCount: number
  matchedBlocks: number
  skippedAnnotations: number
  role: DocumentRole | null
}

function rectToPdfBbox(rect: PdfRect): Bbox {
  const x = Math.min(rect[0], rect[2])
  const y = Math.min(rect[1], rect[3])
  return {
    x,
    y,
    width: Math.abs(rect[2] - rect[0]),
    height: Math.abs(rect[3] - rect[1]),
  }
}

function bboxOverlapArea(a: Bbox, b: Bbox): number {
  const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return overlapWidth * overlapHeight
}

function blockHasBbox(block: BlockRecord): block is BlockRecord & Bbox {
  return (
    block.x != null &&
    block.y != null &&
    block.width != null &&
    block.height != null &&
    block.width > 0 &&
    block.height > 0
  )
}

function parseCommentTexts(contents: string): string[] {
  const trimmed = contents.trim()
  if (!trimmed) return []

  const numberedLines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s/.test(line))

  if (numberedLines.length > 1) {
    return numberedLines
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
  }

  return [trimmed]
}

function parseRoleFromKeywords(keywords: string | undefined): DocumentRole | null {
  if (!keywords) return null
  const match = keywords.match(/role:(baseline|change_request|supporting|unknown)/)
  if (!match || !isDocumentRole(match[1])) return null
  return match[1]
}

function parseCommentModeFromKeywords(keywords: string | undefined): 'markup' | 'burned-in' | null {
  if (!keywords) return null
  const match = keywords.match(/comment-mode:(markup|burned-in)/)
  if (match?.[1] === 'markup' || match?.[1] === 'burned-in') {
    return match[1]
  }
  return null
}

function looksLikeScoperExportFilename(filename: string): boolean {
  return /-scoper-(markup|export)\.pdf$/i.test(filename)
}

/** Read Scoper export metadata embedded during annotated PDF export. */
export async function readScoperExportMetadata(
  bytes: Uint8Array,
  filename: string,
): Promise<ScoperExportMetadata> {
  const pdf = await loadPdfDocument(bytes)
  const metadata = await pdf.getMetadata().catch(() => null)
  const info = metadata?.info as { Keywords?: string } | undefined
  const keywords = typeof info?.Keywords === 'string' ? info.Keywords : undefined

  const role = parseRoleFromKeywords(keywords)
  const commentMode = parseCommentModeFromKeywords(keywords)
  const keywordExport = keywords?.includes('scoper-export') ?? false

  return {
    isScoperExport: keywordExport || looksLikeScoperExportFilename(filename),
    role,
    commentMode,
  }
}

async function extractMarkupAnnotations(
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
): Promise<ImportedPdfAnnotation[]> {
  const annotations: ImportedPdfAnnotation[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum)
    const pageAnnotations = await page.getAnnotations()

    for (const annotation of pageAnnotations) {
      const subtype = annotation.subtype ?? ''
      if (subtype !== 'Highlight' && subtype !== 'Text') continue

      const contents = typeof annotation.contents === 'string' ? annotation.contents.trim() : ''
      const title = typeof annotation.title === 'string' ? annotation.title : undefined
      if (!contents && title !== 'Scoper') continue

      if (!Array.isArray(annotation.rect) || annotation.rect.length !== 4) continue

      annotations.push({
        pageNum,
        subtype,
        contents,
        rect: annotation.rect as PdfRect,
        title,
      })
    }
  }

  return annotations
}

function findBestMatchingBlock(
  blocks: BlockRecord[],
  pageNum: number,
  targetBbox: Bbox,
): BlockRecord | null {
  let best: BlockRecord | null = null
  let bestScore = 0

  for (const block of blocks) {
    if (block.page_num !== pageNum || !blockHasBbox(block)) continue

    const score = bboxOverlapArea(targetBbox, block)
    if (score > bestScore) {
      bestScore = score
      best = block
    }
  }

  if (best && bestScore > 0) return best

  const centerX = targetBbox.x + targetBbox.width / 2
  const centerY = targetBbox.y + targetBbox.height / 2
  let nearest: BlockRecord | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const block of blocks) {
    if (block.page_num !== pageNum || !blockHasBbox(block)) continue

    const blockCenterX = block.x + block.width / 2
    const blockCenterY = block.y + block.height / 2
    const distance = Math.hypot(centerX - blockCenterX, centerY - blockCenterY)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = block
    }
  }

  return nearest
}

/** Restore review notes from a Scoper markup PDF into DuckDB block comments. */
export async function importPdfMarkupComments(options: {
  docId: string
  bytes: Uint8Array
  filename: string
  blocks: BlockRecord[]
}): Promise<ImportPdfCommentsResult> {
  const metadata = await readScoperExportMetadata(options.bytes, options.filename)
  if (!metadata.isScoperExport) {
    return {
      importedCount: 0,
      matchedBlocks: 0,
      skippedAnnotations: 0,
      role: metadata.role,
    }
  }

  if (metadata.commentMode === 'burned-in') {
    return {
      importedCount: 0,
      matchedBlocks: 0,
      skippedAnnotations: 0,
      role: metadata.role,
    }
  }

  const pdf = await loadPdfDocument(options.bytes)
  const annotations = await extractMarkupAnnotations(pdf)

  let importedCount = 0
  let skippedAnnotations = 0
  const matchedBlockIds = new Set<string>()

  for (const annotation of annotations) {
    const commentTexts = parseCommentTexts(annotation.contents)
    if (commentTexts.length === 0) {
      skippedAnnotations += 1
      continue
    }

    const page = await pdf.getPage(annotation.pageNum)
    const pageHeight = page.getViewport({ scale: 1 }).height
    const liteParseBbox = pdfUserSpaceToLiteParseBbox(rectToPdfBbox(annotation.rect), pageHeight)
    const block = findBestMatchingBlock(options.blocks, annotation.pageNum, liteParseBbox)

    if (!block) {
      skippedAnnotations += 1
      continue
    }

    matchedBlockIds.add(block.block_id)

    for (const text of commentTexts) {
      await insertBlockComment(block.block_id, text)
      importedCount += 1
    }
  }

  if (metadata.role) {
    await persistDocumentRole(options.docId, metadata.role)
  }

  return {
    importedCount,
    matchedBlocks: matchedBlockIds.size,
    skippedAnnotations,
    role: metadata.role,
  }
}

/** Dev harness — export markup PDF, re-ingest, and verify comments round-trip. */
export async function runImportPdfCommentsHarness(): Promise<void> {
  const { exportAnnotatedPdf } = await import('@/services/export-annotated-pdf')
  const { fetchDocumentBlocks } = await import('@/services/document-blocks')
  const { fetchCommentsForBlock, insertBlockComment } = await import('@/services/block-comments')
  const { ingestFile } = await import('@/services/ingest-router')

  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`runImportPdfCommentsHarness: failed to load sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const sourceFile = new File([blob], 'import-harness-source.pdf', { type: 'application/pdf' })
  const ingested = await ingestFile(sourceFile, { ocrEnabled: false })
  const blocks = await fetchDocumentBlocks(ingested.doc_id)
  const firstBlock = blocks[0]
  if (!firstBlock) {
    throw new Error('runImportPdfCommentsHarness failed: expected blocks on sample PDF')
  }

  await insertBlockComment(firstBlock.block_id, 'Round-trip review note.')

  const exportedBytes = await exportAnnotatedPdf(
    {
      doc_id: ingested.doc_id,
      filename: ingested.filename,
      mime: ingested.mime,
      role: 'baseline',
      uploaded_at: new Date().toISOString(),
    },
    { commentMode: 'markup' },
  )

  const exportedFile = new File([Uint8Array.from(exportedBytes)], 'import-harness-scoper-markup.pdf', {
    type: 'application/pdf',
  })
  const reingested = await ingestFile(exportedFile, { ocrEnabled: false })
  const reloadedBlocks = await fetchDocumentBlocks(reingested.doc_id)
  const commentedBlock = reloadedBlocks.find((block) => block.page_num === firstBlock.page_num)

  if (!commentedBlock) {
    throw new Error('runImportPdfCommentsHarness failed: expected blocks after re-ingest')
  }

  const comments = await fetchCommentsForBlock(commentedBlock.block_id)
  if (!comments.some((comment) => comment.text.includes('Round-trip review note'))) {
    throw new Error('runImportPdfCommentsHarness failed: imported comment not restored')
  }

  if (reingested.role !== 'baseline') {
    throw new Error('runImportPdfCommentsHarness failed: exported role not restored')
  }
}
