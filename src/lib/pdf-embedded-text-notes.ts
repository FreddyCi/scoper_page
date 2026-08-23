import type { PageViewport } from 'pdfjs-dist'

export type PdfEmbeddedTextNote = {
  id: string
  pageNum: number
  contents: string
  title: string | null
  /** Viewport CSS pixels at current scale (top-left origin). */
  left: number
  top: number
  width: number
  height: number
}

type PdfJsAnnotation = {
  subtype?: string
  contents?: string
  contentsObj?: { str?: string }
  title?: string
  titleObj?: { str?: string }
  rect?: number[]
}

export function readPdfAnnotationContents(annotation: PdfJsAnnotation): string {
  if (typeof annotation.contents === 'string' && annotation.contents.trim()) {
    return annotation.contents.trim()
  }
  if (typeof annotation.contentsObj?.str === 'string' && annotation.contentsObj.str.trim()) {
    return annotation.contentsObj.str.trim()
  }
  return ''
}

export function readPdfAnnotationTitle(annotation: PdfJsAnnotation): string | null {
  if (typeof annotation.title === 'string' && annotation.title.trim()) {
    return annotation.title.trim()
  }
  const fromObj = annotation.titleObj?.str?.trim()
  return fromObj || null
}

function annotationRectToViewport(
  rect: number[],
  viewport: PageViewport,
): Pick<PdfEmbeddedTextNote, 'left' | 'top' | 'width' | 'height'> | null {
  if (rect.length !== 4) return null

  const [left, top, right, bottom] = viewport.convertToViewportRectangle(rect)
  return {
    left: Math.min(left, right),
    top: Math.min(top, bottom),
    width: Math.abs(right - left),
    height: Math.abs(bottom - top),
  }
}

/** Sticky-note annotations embedded in a PDF (Preview / Acrobat style). */
export function mapPdfEmbeddedTextNotes(
  annotations: PdfJsAnnotation[],
  pageNum: number,
  viewport: PageViewport,
): PdfEmbeddedTextNote[] {
  const notes: PdfEmbeddedTextNote[] = []
  const seenContents = new Set<string>()

  annotations.forEach((annotation, index) => {
    const subtype = (annotation.subtype ?? '').toLowerCase()
    if (subtype !== 'text') return

    const contents = readPdfAnnotationContents(annotation)
    if (!contents) return

    const dedupeKey = `${pageNum}::${contents}`
    if (seenContents.has(dedupeKey)) return
    seenContents.add(dedupeKey)

    const rect = Array.isArray(annotation.rect) ? annotation.rect : null
    if (!rect) return

    const box = annotationRectToViewport(rect, viewport)
    if (!box) return

    notes.push({
      id: `${pageNum}-text-${index}`,
      pageNum,
      contents,
      title: readPdfAnnotationTitle(annotation),
      ...box,
    })
  })

  return notes
}

/** Dev harness — Scoper export fixture exposes sticky-note comments on page 8. */
export async function runPdfEmbeddedTextNotesHarness(): Promise<void> {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { loadPdfDocument } = await import('@/lib/pdfjs-viewer')

  const fixturePath = join(process.cwd(), 'sample/windows-drawing.pdf')
  const bytes = readFileSync(fixturePath)
  const pdf = await loadPdfDocument(bytes)
  const page = await pdf.getPage(8)
  const viewport = page.getViewport({ scale: 1 })
  const annotations = await page.getAnnotations()
  const notes = mapPdfEmbeddedTextNotes(annotations, 8, viewport)

  if (notes.length < 2) {
    throw new Error(`runPdfEmbeddedTextNotesHarness: expected ≥2 text notes on page 8, got ${notes.length}`)
  }

  if (!notes.some((note) => note.contents.includes('106'))) {
    throw new Error('runPdfEmbeddedTextNotesHarness: missing "106 Window type" note')
  }
}
