import type {
  LiteParseParseResult,
  LiteParseWorkerMessage,
  LiteParseWorkerRequest,
  LiteParseWorkerResponse,
} from '@/lib/liteparse-protocol'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

export class LiteParseClient {
  private worker: Worker | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private initPromise: Promise<void> | null = null
  private readonly handleMessage: (event: MessageEvent<LiteParseWorkerResponse>) => void

  constructor() {
    this.handleMessage = (event) => {
      const response = event.data
      const pending = this.pending.get(response.id)
      if (!pending) return

      this.pending.delete(response.id)
      if (response.ok) {
        pending.resolve(response.result)
      } else {
        pending.reject(new Error(response.error))
      }
    }
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker

    this.worker = new Worker(new URL('../workers/liteparse.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'LiteParse worker error')
      for (const pending of this.pending.values()) {
        pending.reject(error)
      }
      this.pending.clear()
    })

    return this.worker
  }

  private send<T = unknown>(request: LiteParseWorkerRequest): Promise<T> {
    const worker = this.ensureWorker()
    const id = crypto.randomUUID()

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })

      const message: LiteParseWorkerMessage = { id, ...request }
      worker.postMessage(message)
    })
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.send<void>({ type: 'init' }).then(() => undefined)
    }
    await this.initPromise
  }

  async ping(): Promise<string> {
    await this.init()
    return this.send<string>({ type: 'ping' })
  }

  async parsePdf(
    docId: string,
    bytes: Uint8Array,
    options?: { ocrEnabled?: boolean },
  ): Promise<LiteParseParseResult> {
    await this.init()
    return this.send<LiteParseParseResult>({
      type: 'parse',
      doc_id: docId,
      bytes,
      ocrEnabled: options?.ocrEnabled,
    })
  }

  async terminate(): Promise<void> {
    if (!this.worker) return

    this.worker.removeEventListener('message', this.handleMessage)
    this.worker.terminate()
    this.worker = null
    this.initPromise = null
    this.pending.clear()
  }
}

let singletonClient: LiteParseClient | null = null

export function createLiteParseClient(): LiteParseClient {
  return new LiteParseClient()
}

export async function getLiteParseClient(): Promise<LiteParseClient> {
  if (!singletonClient) {
    singletonClient = createLiteParseClient()
    await singletonClient.init()
  }
  return singletonClient
}

/** Dev harness — parse sample PDF; verify pages and textItems with bbox (BDA-021) */
export async function runLiteParseHarness(): Promise<void> {
  const client = createLiteParseClient()

  try {
    await client.init()
    const pong = await client.ping()
    if (pong !== 'pong') {
      throw new Error('LiteParse worker ping failed')
    }

    const response = await fetch('/sample/minimal.pdf')
    if (!response.ok) {
      throw new Error(`Failed to load sample PDF: ${response.status}`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    const parsed = await client.parsePdf('harness-doc', bytes)

    if (parsed.pages.length === 0) {
      throw new Error('LiteParse harness: expected pages.length > 0')
    }

    const hasCoordinates = parsed.pages.some((page) =>
      page.textItems.some(
        (item) =>
          Number.isFinite(item.x) &&
          Number.isFinite(item.y) &&
          Number.isFinite(item.width) &&
          Number.isFinite(item.height),
      ),
    )
    if (!hasCoordinates) {
      throw new Error('LiteParse harness: expected textItems with coordinates')
    }

    if (parsed.blocks.length === 0) {
      throw new Error('LiteParse harness: expected normalized blocks')
    }
  } finally {
    await client.terminate()
  }
}

/** Dev harness — parse scanned PDF with OCR enabled (BDA-022) */
export async function runLiteParseOcrHarness(): Promise<void> {
  const client = createLiteParseClient()

  try {
    await client.init()

    const withoutOcr = await fetch('/sample/scanned.pdf')
    if (!withoutOcr.ok) {
      throw new Error(`Failed to load scanned PDF: ${withoutOcr.status}`)
    }

    const scannedBytes = new Uint8Array(await withoutOcr.arrayBuffer())
    const noOcrResult = await client.parsePdf('harness-scanned-off', scannedBytes, {
      ocrEnabled: false,
    })

    if (noOcrResult.blocks.length > 0) {
      throw new Error('LiteParse OCR harness: scanned PDF should have no blocks without OCR')
    }

    const withOcrResult = await client.parsePdf('harness-scanned-on', scannedBytes, {
      ocrEnabled: true,
    })

    if (withOcrResult.pages.length === 0) {
      throw new Error('LiteParse OCR harness: expected pages.length > 0')
    }

    if (withOcrResult.blocks.length === 0) {
      throw new Error('LiteParse OCR harness: expected blocks with OCR enabled')
    }

    const hasCoordinates = withOcrResult.pages.some((page) =>
      page.textItems.some(
        (item) =>
          Number.isFinite(item.x) &&
          Number.isFinite(item.y) &&
          Number.isFinite(item.width) &&
          Number.isFinite(item.height),
      ),
    )
    if (!hasCoordinates) {
      throw new Error('LiteParse OCR harness: expected textItems with coordinates')
    }
  } finally {
    await client.terminate()
  }
}
