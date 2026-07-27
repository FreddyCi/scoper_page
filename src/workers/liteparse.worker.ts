/// <reference lib="webworker" />

import init, { LiteParse } from '@llamaindex/liteparse-wasm'

import { OcrEngineBridge } from '@/lib/ocr-engine-bridge'
import { normalizeLiteParseResult } from '@/lib/liteparse-normalize'
import type {
  LiteParseParseResult,
  LiteParseWorkerMessage,
  LiteParseWorkerResponse,
} from '@/lib/liteparse-protocol'

const WASM_URL = '/liteparse/liteparse_wasm_bg.wasm'

let parser: LiteParse | null = null
let parserOcrEnabled: boolean | null = null
let initPromise: Promise<void> | null = null
let ocrBridge: OcrEngineBridge | null = null

function postResponse(response: LiteParseWorkerResponse) {
  self.postMessage(response)
}

function getOcrBridge(): OcrEngineBridge {
  if (!ocrBridge) {
    ocrBridge = new OcrEngineBridge()
  }
  return ocrBridge
}

async function ensureParser(ocrEnabled: boolean) {
  if (parser && parserOcrEnabled === ocrEnabled) return
  if (initPromise && parserOcrEnabled === ocrEnabled) return initPromise

  if (parser) {
    parser.free()
    parser = null
    parserOcrEnabled = null
  }

  initPromise = (async () => {
    await init(WASM_URL)

    const config = {
      ocrEnabled,
      outputFormat: 'json' as const,
      ...(ocrEnabled
        ? {
            ocrEngine: {
              recognize: (
                imageData: Uint8Array,
                width: number,
                height: number,
                language: string,
              ) => getOcrBridge().recognize(imageData, width, height, language),
            },
          }
        : {}),
    }

    parser = new LiteParse(config)
    parserOcrEnabled = ocrEnabled
  })()

  await initPromise
  initPromise = null
}

async function parsePdf(
  docId: string,
  bytes: Uint8Array,
  ocrEnabled: boolean,
): Promise<LiteParseParseResult> {
  await ensureParser(ocrEnabled)
  if (!parser) throw new Error('LiteParse worker unavailable')

  const result = await parser.parse(bytes)
  return normalizeLiteParseResult(docId, result.pages, result.text)
}

self.onmessage = async (event: MessageEvent<LiteParseWorkerMessage>) => {
  const { id, type } = event.data

  try {
    switch (type) {
      case 'ping':
        postResponse({ id, ok: true, result: 'pong' })
        return

      case 'init':
        await ensureParser(false)
        postResponse({ id, ok: true })
        return

      case 'parse': {
        const parsed = await parsePdf(
          event.data.doc_id,
          event.data.bytes,
          event.data.ocrEnabled ?? false,
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
