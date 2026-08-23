import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib'

/** Window stamp size in PDF points when burned into a Scoper export (matches pdf-drawing-export). */
const SCOPER_EXPORT_STAMP_SIZE_PT = 24

export type ScoperExportWindowStamp = {
  page_num: number
  x: number
  y: number
}

function pageContentStreams(
  ctx: PDFDocument['context'],
  contents: unknown,
): PDFRawStream[] {
  if (contents instanceof PDFArray) {
    const streams: PDFRawStream[] = []
    for (let index = 0; index < contents.size(); index += 1) {
      const stream = ctx.lookup(contents.get(index))
      if (stream instanceof PDFRawStream) {
        streams.push(stream)
      }
    }
    return streams
  }

  if (contents instanceof PDFRawStream) {
    return [contents]
  }

  return []
}

/**
 * Parse burned-in window stamp centers from a Scoper `*-scoper-export.pdf`.
 * Stamps are drawn as 24×24 pt squares with a cross; centers are recovered from `cm` transforms.
 */
export async function extractScoperExportWindowStamps(
  bytes: Uint8Array,
): Promise<ScoperExportWindowStamp[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const ctx = doc.context
  const stamps: ScoperExportWindowStamp[] = []

  const stampPathPattern =
    /1 0 0 1 ([\d.]+) ([\d.]+) cm[\s\S]*?0 0 m\s*0 24 l\s*24 24 l\s*24 0 l\s*h\s*S/g

  for (let pageIndex = 0; pageIndex < doc.getPageCount(); pageIndex += 1) {
    const page = doc.getPage(pageIndex)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()
    const contentsRef = page.node.Contents()
    if (!contentsRef) continue

    const contents = ctx.lookup(contentsRef)
    const streams = pageContentStreams(ctx, contents)

    for (const stream of streams) {
      if (!stream.contents) continue

      let decoded: Uint8Array
      try {
        decoded = decodePDFRawStream(stream).decode()
      } catch {
        continue
      }

      const text = Buffer.from(decoded).toString('latin1')
      let match: RegExpExecArray | null
      while ((match = stampPathPattern.exec(text)) !== null) {
        const translateX = Number.parseFloat(match[1]!)
        const translateY = Number.parseFloat(match[2]!)
        const centerX = translateX + SCOPER_EXPORT_STAMP_SIZE_PT / 2
        const centerY = translateY + SCOPER_EXPORT_STAMP_SIZE_PT / 2

        stamps.push({
          page_num: pageIndex + 1,
          x: centerX / pageWidth,
          y: 1 - centerY / pageHeight,
        })
      }
    }
  }

  return stamps
}

/** Dev harness — Windows export fixture has 14 window stamps on page 8. */
export async function runScoperExportDrawingStampsHarness(): Promise<void> {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const fixturePath = join(process.cwd(), 'sample/windows-drawing.pdf')
  const bytes = readFileSync(fixturePath)
  const stamps = await extractScoperExportWindowStamps(bytes)

  const page8 = stamps.filter((stamp) => stamp.page_num === 8)
  if (page8.length < 1) {
    throw new Error(
      `runScoperExportDrawingStampsHarness: expected stamps on page 8, got ${page8.length}`,
    )
  }

  for (const stamp of stamps) {
    if (stamp.x < 0 || stamp.x > 1 || stamp.y < 0 || stamp.y > 1) {
      throw new Error('runScoperExportDrawingStampsHarness: stamp coordinates out of range')
    }
  }
}
