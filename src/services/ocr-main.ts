/**
 * Main-thread Tesseract OCR — tesseract.js must be spawned from the main thread;
 * nesting it inside a dedicated module worker fails under Vite.
 */
import { mapTesseractPageToOcrResults } from '@/lib/ocr-results'
import type { OcrRecognitionResult } from '@/lib/ocr-protocol'
import { createWorker, type TesseractWorker } from '@/lib/tesseract'
import {
  TESSERACT_CORE_PATH,
  TESSERACT_WORKER_PATH,
} from '@/lib/tesseract-config'

let worker: TesseractWorker | null = null
let currentLanguage: string | null = null
let initPromise: Promise<void> | null = null

function tesseractWorkerPath(): string {
  return new URL(TESSERACT_WORKER_PATH, window.location.origin).href
}

async function ensureWorker(language: string): Promise<TesseractWorker> {
  if (worker && currentLanguage === language) {
    return worker
  }

  if (!worker) {
    if (!initPromise) {
      initPromise = (async () => {
        worker = await createWorker(language, 1, {
          workerPath: tesseractWorkerPath(),
          corePath: TESSERACT_CORE_PATH,
        })
        currentLanguage = language
      })()
    }
    await initPromise
  }

  if (!worker) {
    throw new Error('OCR worker unavailable')
  }

  if (currentLanguage !== language) {
    await worker.reinitialize(language)
    currentLanguage = language
  }

  return worker
}

export async function recognizeImageSource(
  source: Blob | HTMLCanvasElement,
  language = 'eng',
): Promise<OcrRecognitionResult[]> {
  const ocrWorker = await ensureWorker(language)
  const { data } = await ocrWorker.recognize(source, {}, { blocks: true })
  return mapTesseractPageToOcrResults(data)
}

export async function recognizePngBytes(
  imageData: Uint8Array,
  language = 'eng',
): Promise<OcrRecognitionResult[]> {
  const blob = new Blob([imageData.slice()], { type: 'image/png' })
  return recognizeImageSource(blob, language)
}

export async function pingOcrMain(): Promise<string> {
  await ensureWorker('eng')
  return 'pong'
}

export async function terminateOcrMain(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
  }
  currentLanguage = null
  initPromise = null
}
