import type { OcrRecognitionResult } from '@/lib/ocr-protocol'
import type {
  OcrWorkerMessage,
  OcrWorkerRequest,
  OcrWorkerResponse,
} from '@/lib/ocr-protocol'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

/** LiteParse `ocrEngine` adapter — delegates PNG raster OCR to `ocr.worker.ts`. */
export class OcrEngineBridge {
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

  async recognize(
    imageData: Uint8Array,
    width: number,
    height: number,
    language: string,
  ): Promise<OcrRecognitionResult[]> {
    await this.init()
    return this.send<OcrRecognitionResult[]>({
      type: 'recognize',
      imageData,
      width,
      height,
      language,
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
