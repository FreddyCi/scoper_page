import type { OcrRecognitionResult } from '@/lib/ocr-protocol'
import {
  pingOcrMain,
  recognizePngBytes,
  terminateOcrMain,
} from '@/services/ocr-main'

/** Dev harness — OCR recognizes PNG sample on the main thread (BDA-022) */
export async function runOcrHarness(): Promise<void> {
  try {
    const pong = await pingOcrMain()
    if (pong !== 'pong') {
      throw new Error('OCR ping failed')
    }

    const response = await fetch('/sample/ocr-test.png')
    if (!response.ok) {
      throw new Error(`Failed to load OCR sample PNG: ${response.status}`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    const results = await recognizePngBytes(bytes)

    if (results.length === 0) {
      throw new Error('OCR harness: expected recognition results')
    }

    const hasBbox = results.some(
      (item) =>
        item.bbox.length === 4 &&
        item.bbox.every((value) => Number.isFinite(value)),
    )
    if (!hasBbox) {
      throw new Error('OCR harness: expected bbox coordinates')
    }
  } finally {
    await terminateOcrMain()
  }
}

/** @deprecated Use recognizePngBytes from ocr-main.ts */
export class OcrClient {
  async init(): Promise<void> {
    await pingOcrMain()
  }

  async ping(): Promise<string> {
    return pingOcrMain()
  }

  async recognizePng(imageData: Uint8Array, language = 'eng'): Promise<OcrRecognitionResult[]> {
    return recognizePngBytes(imageData, language)
  }

  async terminate(): Promise<void> {
    await terminateOcrMain()
  }
}

export function createOcrClient(): OcrClient {
  return new OcrClient()
}
