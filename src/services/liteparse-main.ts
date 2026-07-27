/**
 * Main-thread LiteParse helpers — WASM OCR merge needs Tokio and panics in the
 * browser; use `liteparse-ocr-fallback.ts` for scanned PDFs instead.
 */
import init, { LiteParse } from '@llamaindex/liteparse-wasm'

import type { LiteParseParseResult } from '@/lib/liteparse-protocol'

const WASM_URL = '/liteparse/liteparse_wasm_bg.wasm'

let parser: LiteParse | null = null
let initPromise: Promise<void> | null = null

async function ensureParser(): Promise<void> {
  if (parser) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    await init({ module_or_path: WASM_URL })
    parser = new LiteParse({
      ocrEnabled: false,
      outputFormat: 'json',
    })
  })()

  return initPromise
}

export async function isComplexPdf(bytes: Uint8Array) {
  await ensureParser()
  if (!parser) throw new Error('LiteParse main-thread parser unavailable')
  return parser.isComplex(bytes)
}

export async function pageNumbersNeedingOcr(bytes: Uint8Array): Promise<number[]> {
  const pages = await isComplexPdf(bytes)
  return pages.filter((page) => page.needsOcr).map((page) => page.pageNumber)
}

export async function terminateLiteParseMain(): Promise<void> {
  if (parser) {
    parser.free()
    parser = null
  }
  initPromise = null
}

/** @deprecated LiteParse OCR merge panics in WASM — kept for type re-exports only */
export async function parsePdfOnMainThread(
  _docId: string,
  _bytes: Uint8Array,
): Promise<LiteParseParseResult> {
  throw new Error('LiteParse OCR is unavailable in the browser; use parsePdfWithOcrFallback')
}
