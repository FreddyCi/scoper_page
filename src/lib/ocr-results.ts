import type { OcrRecognitionResult } from '@/lib/ocr-protocol'

type TesseractBBox = {
  x0: number
  y0: number
  x1: number
  y1: number
}

type TesseractWord = {
  text: string
  confidence: number
  bbox: TesseractBBox
}

type TesseractLine = {
  words: TesseractWord[]
}

type TesseractParagraph = {
  lines: TesseractLine[]
}

type TesseractBlock = {
  paragraphs: TesseractParagraph[]
}

type TesseractPage = {
  blocks: TesseractBlock[] | null
}

/** Map tesseract.js page output to LiteParse `ocrEngine.recognize` results. */
export function mapTesseractPageToOcrResults(page: TesseractPage): OcrRecognitionResult[] {
  const results: OcrRecognitionResult[] = []

  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const words = (line.words ?? []).filter((word) => word.text.trim())
        if (words.length === 0) continue

        const x0 = Math.min(...words.map((word) => word.bbox.x0))
        const y0 = Math.min(...words.map((word) => word.bbox.y0))
        const x1 = Math.max(...words.map((word) => word.bbox.x1))
        const y1 = Math.max(...words.map((word) => word.bbox.y1))
        const confidence =
          words.reduce((sum, word) => sum + word.confidence, 0) / words.length

        results.push({
          text: words.map((word) => word.text.trim()).join(' '),
          bbox: [x0, y0, x1, y1],
          confidence: confidence / 100,
        })
      }
    }
  }

  return results
}
