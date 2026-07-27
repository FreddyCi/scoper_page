import type { OcrRecognitionResult } from '@/lib/ocr-protocol'
import { recognizePngBytes } from '@/services/ocr-main'

/** LiteParse `ocrEngine` adapter — delegates raster OCR to main-thread Tesseract. */
export class OcrEngineBridge {
  async recognize(
    imageData: Uint8Array,
    _width: number,
    _height: number,
    language: string,
  ): Promise<OcrRecognitionResult[]> {
    return recognizePngBytes(imageData, language)
  }

  async terminate(): Promise<void> {
    // Shared singleton in ocr-main.ts; lifecycle owned by callers.
  }
}
