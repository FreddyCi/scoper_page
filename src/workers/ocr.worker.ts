/// <reference lib="webworker" />

import { mapTesseractPageToOcrResults } from '@/lib/ocr-results'
import type {
  OcrRecognitionResult,
  OcrWorkerMessage,
  OcrWorkerResponse,
} from '@/lib/ocr-protocol'
import { createWorker, type TesseractWorker } from '@/lib/tesseract'
import {
  TESSERACT_CORE_PATH,
  TESSERACT_WORKER_PATH,
} from '@/lib/tesseract-config'

let worker: TesseractWorker | null = null
let currentLanguage: string | null = null
let initPromise: Promise<void> | null = null

function postResponse(response: OcrWorkerResponse) {
  self.postMessage(response)
}

async function ensureTesseract(language: string) {
  if (!worker) {
    worker = await createWorker(language, 1, {
      workerPath: new URL(TESSERACT_WORKER_PATH, self.location.origin).href,
      corePath: TESSERACT_CORE_PATH,
    })
    currentLanguage = language
    return
  }

  if (currentLanguage !== language) {
    await worker.reinitialize(language)
    currentLanguage = language
  }
}

async function ensureInitialized() {
  if (worker) return
  if (initPromise) return initPromise

  initPromise = ensureTesseract('eng').then(() => undefined)
  return initPromise
}

async function recognizeImage(
  imageData: Uint8Array,
  language: string,
): Promise<OcrRecognitionResult[]> {
  await ensureTesseract(language)
  if (!worker) throw new Error('OCR worker unavailable')

  const blob = new Blob([imageData.slice()], { type: 'image/png' })
  const { data } = await worker.recognize(blob, {}, { blocks: true })
  return mapTesseractPageToOcrResults(data)
}

self.onmessage = async (event: MessageEvent<OcrWorkerMessage>) => {
  const { id, type } = event.data

  try {
    switch (type) {
      case 'ping':
        postResponse({ id, ok: true, result: 'pong' })
        return

      case 'init':
        await ensureInitialized()
        postResponse({ id, ok: true })
        return

      case 'recognize': {
        const results = await recognizeImage(
          event.data.imageData,
          event.data.language || 'eng',
        )
        postResponse({ id, ok: true, result: results })
        return
      }

      default: {
        const exhaustive: never = type
        throw new Error(`Unknown OCR worker request: ${String(exhaustive)}`)
      }
    }
  } catch (error) {
    postResponse({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export {}
