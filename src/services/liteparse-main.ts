/**
 * Main-thread LiteParse with OCR — WASM OCR merge needs the browser main-thread
 * async runtime; running ocrEngine inside a dedicated worker panics (Tokio reactor).
 */
import init, { LiteParse } from '@llamaindex/liteparse-wasm'

import { OcrEngineBridge } from '@/lib/ocr-engine-bridge'
import { normalizeLiteParseResult } from '@/lib/liteparse-normalize'
import type { LiteParseParseResult } from '@/lib/liteparse-protocol'

const WASM_URL = '/liteparse/liteparse_wasm_bg.wasm'

let parser: LiteParse | null = null
let initPromise: Promise<void> | null = null
let ocrBridge: OcrEngineBridge | null = null

function getOcrBridge(): OcrEngineBridge {
  if (!ocrBridge) {
    ocrBridge = new OcrEngineBridge()
  }
  return ocrBridge
}

async function ensureOcrParser(): Promise<void> {
  if (parser) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    await init(WASM_URL)
    parser = new LiteParse({
      ocrEnabled: true,
      outputFormat: 'json',
      ocrEngine: {
        recognize: (
          imageData: Uint8Array,
          width: number,
          height: number,
          language: string,
        ) => getOcrBridge().recognize(imageData, width, height, language),
      },
    })
  })()

  return initPromise
}

export async function parsePdfOnMainThread(
  docId: string,
  bytes: Uint8Array,
): Promise<LiteParseParseResult> {
  await ensureOcrParser()
  if (!parser) throw new Error('LiteParse main-thread parser unavailable')

  const result = await parser.parse(bytes)
  return normalizeLiteParseResult(docId, result.pages, result.text)
}

export async function terminateLiteParseMain(): Promise<void> {
  if (parser) {
    parser.free()
    parser = null
  }
  initPromise = null

  if (ocrBridge) {
    await ocrBridge.terminate()
    ocrBridge = null
  }
}
