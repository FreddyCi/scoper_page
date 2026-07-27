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
        for (const word of line.words ?? []) {
          const text = word.text.trim()
          if (!text) continue

          results.push({
            text,
            bbox: [word.bbox.x0, word.bbox.y0, word.bbox.x1, word.bbox.y1],
            confidence: word.confidence / 100,
          })
        }
      }
    }
  }

  return results
}
