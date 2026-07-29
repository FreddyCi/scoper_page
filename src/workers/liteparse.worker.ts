/// <reference lib="webworker" />

import init, { LiteParse } from '@llamaindex/liteparse-wasm'

import { normalizeLiteParseResult } from '@/lib/liteparse-normalize'
import type {
  LiteParseParseResult,
  LiteParseWorkerMessage,
  LiteParseWorkerResponse,
} from '@/lib/liteparse-protocol'

const WASM_URL = '/liteparse/liteparse_wasm_bg.wasm'

let parser: LiteParse | null = null
let initPromise: Promise<void> | null = null

function postResponse(response: LiteParseWorkerResponse) {
  self.postMessage(response)
}

async function ensureParser() {
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

async function parsePdf(
  docId: string,
  bytes: Uint8Array,
  targetPages?: string,
): Promise<LiteParseParseResult> {
  await ensureParser()

  const scopedParser =
    targetPages !== undefined
      ? new LiteParse({
          ocrEnabled: false,
          outputFormat: 'json',
          targetPages,
        })
      : parser

  if (!scopedParser) throw new Error('LiteParse worker unavailable')

  try {
    const result = await scopedParser.parse(bytes)
    return normalizeLiteParseResult(docId, result.pages, result.text)
  } finally {
    if (scopedParser !== parser) {
      scopedParser.free()
    }
  }
}

self.onmessage = async (event: MessageEvent<LiteParseWorkerMessage>) => {
  const { id, type } = event.data

  try {
    switch (type) {
      case 'ping':
        postResponse({ id, ok: true, result: 'pong' })
        return

      case 'init':
        await ensureParser()
        postResponse({ id, ok: true })
        return

      case 'parse': {
        if (event.data.ocrEnabled) {
          throw new Error('OCR parsing must run on the main thread')
        }

        const parsed = await parsePdf(
          event.data.doc_id,
          event.data.bytes,
          event.data.targetPages,
        )
        postResponse({ id, ok: true, result: parsed })
        return
      }

      default: {
        const exhaustive: never = type
        throw new Error(`Unknown worker request: ${String(exhaustive)}`)
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
