import type {
  OcrWorkerMessage,
  OcrWorkerRequest,
  OcrWorkerResponse,
} from '@/lib/ocr-protocol'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

export class OcrClient {
  private worker: Worker | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private initPromise: Promise<void> | null = null
  private readonly handleMessage: (event: MessageEvent<OcrWorkerResponse>) => void

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

    this.worker = new Worker(new URL('../workers/ocr.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'OCR worker error')
      for (const pending of this.pending.values()) {
        pending.reject(error)
      }
      this.pending.clear()
    })

    return this.worker
  }

  private send<T = unknown>(request: OcrWorkerRequest): Promise<T> {
    const worker = this.ensureWorker()
    const id = crypto.randomUUID()

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })

      const message: OcrWorkerMessage = { id, ...request }
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

  async recognizePng(imageData: Uint8Array, language = 'eng') {
    await this.init()
    return this.send<{ text: string; bbox: [number, number, number, number]; confidence: number }[]>(
      {
        type: 'recognize',
        imageData,
        width: 0,
        height: 0,
        language,
      },
    )
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

export function createOcrClient(): OcrClient {
  return new OcrClient()
}

/** Dev harness — OCR worker recognizes PNG sample (BDA-022) */
export async function runOcrHarness(): Promise<void> {
  const client = createOcrClient()

  try {
    await client.init()
    const pong = await client.ping()
    if (pong !== 'pong') {
      throw new Error('OCR worker ping failed')
    }

    const response = await fetch('/sample/ocr-test.png')
    if (!response.ok) {
      throw new Error(`Failed to load OCR sample PNG: ${response.status}`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    const results = await client.recognizePng(bytes)

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
    await client.terminate()
  }
}
