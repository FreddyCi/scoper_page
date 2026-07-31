import type {
  WhisperLoadProgress,
  WhisperTranscribeResult,
  WhisperWorkerCommand,
  WhisperWorkerErrorCode,
  WhisperWorkerEvent,
  WhisperWorkerOutbound,
} from '@/lib/whisper-protocol'
import {
  WhisperModelNotLoadedError,
  WhisperWebGpuUnavailableError,
  whisperTranscribeTransferables,
} from '@/lib/whisper-protocol'
import { WHISPER_ASR_MODEL_ID } from '@/lib/whisper-model'
import { cleanSpeechTranscript } from '@/lib/speech-transcript-cleanup'
import { probeWebGpu } from '@/lib/scoper-webgpu'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

export type WhisperClientStatus = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error'

export type WhisperClientState = {
  status: WhisperClientStatus
  loadProgress: WhisperLoadProgress | null
  lastError: string | null
  webGpuAvailable: boolean | null
  webGpuError: string | null
  modelId: string
}

export type WhisperClientListeners = {
  onStateChange?: (state: WhisperClientState) => void
  onProgress?: (progress: WhisperLoadProgress) => void
  onPartial?: (text: string) => void
  onSegment?: (text: string) => void
  onError?: (error: Error) => void
}

export type WhisperTranscribeChunkOptions = {
  sampleRateHz?: number
  /** Copy audio before transfer so the caller retains its buffer. Default false. */
  copyAudio?: boolean
}

export type WhisperClientOptions = {
  /** Apply speech filler cleanup before partial/segment callbacks and transcribe results (default true). */
  cleanTranscript?: boolean
}

/** Text passed to whisper client listeners / transcribe results (BDA-188). */
export function whisperEmitText(text: string, cleanTranscript: boolean): string {
  if (!cleanTranscript) return text
  return cleanSpeechTranscript(text)
}

export class WhisperClient {
  private worker: Worker | null = null
  private workerInitPromise: Promise<Worker> | null = null
  private loadPromise: Promise<void> | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private listeners: WhisperClientListeners = {}
  private cleanTranscript: boolean
  private state: WhisperClientState = {
    status: 'idle',
    loadProgress: null,
    lastError: null,
    webGpuAvailable: null,
    webGpuError: null,
    modelId: WHISPER_ASR_MODEL_ID,
  }

  constructor(options: WhisperClientOptions = {}) {
    this.cleanTranscript = options.cleanTranscript !== false
  }

  private formatEmitText(text: string): string {
    return whisperEmitText(text, this.cleanTranscript)
  }

  getCleanTranscript(): boolean {
    return this.cleanTranscript
  }

  setCleanTranscript(cleanTranscript: boolean): void {
    this.cleanTranscript = cleanTranscript
  }

  private readonly handleMessage = (event: MessageEvent<WhisperWorkerOutbound>) => {
    const message = event.data

    if ('id' in message && message.id) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)

      if ('ok' in message && message.ok) {
        pending.resolve(message.result ?? true)
        return
      }

      if ('ok' in message && !message.ok) {
        const error = this.toError(message.error, message.code)
        this.setState({ status: 'error', lastError: error.message })
        this.listeners.onError?.(error)
        pending.reject(error)
      }
      return
    }

    if ('type' in message) {
      this.handleEvent(message as WhisperWorkerEvent)
    }
  }

  private handleEvent(message: WhisperWorkerEvent) {
    switch (message.type) {
      case 'progress': {
        const loadProgress: WhisperLoadProgress = {
          phase: message.phase,
          loaded: message.loaded,
          total: message.total,
        }
        const nextStatus =
          message.phase === 'ready'
            ? 'ready'
            : this.state.status === 'transcribing'
              ? 'transcribing'
              : 'loading'
        this.setState({
          status: nextStatus,
          loadProgress,
          lastError: null,
        })
        this.listeners.onProgress?.(loadProgress)
        return
      }
      case 'partial':
        this.listeners.onPartial?.(this.formatEmitText(message.text))
        return
      case 'segment':
        this.listeners.onSegment?.(this.formatEmitText(message.text))
        return
      case 'error': {
        const error = this.toError(message.message, message.code)
        this.setState({ status: 'error', lastError: error.message })
        this.listeners.onError?.(error)
        return
      }
      default:
        return
    }
  }

  private async ensureWorker(): Promise<Worker> {
    if (this.worker) return this.worker
    if (!this.workerInitPromise) {
      this.workerInitPromise = this.createWorker()
    }
    return this.workerInitPromise
  }

  private async createWorker(): Promise<Worker> {
    const WorkerModule = await import('../workers/whisper.worker.ts?worker')
    const worker = new WorkerModule.default()
    worker.addEventListener('message', this.handleMessage)
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Whisper worker error')
      this.setState({ status: 'error', lastError: error.message })
      this.listeners.onError?.(error)
      for (const pending of this.pending.values()) {
        pending.reject(error)
      }
      this.pending.clear()
    })
    this.worker = worker
    return worker
  }

  private async sendRequest<T = unknown>(
    request: WhisperWorkerCommand,
    transfer: Transferable[] = [],
  ): Promise<T> {
    const worker = await this.ensureWorker()
    const id = crypto.randomUUID()

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })
      worker.postMessage({ id, ...request }, transfer)
    })
  }

  setListeners(listeners: WhisperClientListeners) {
    this.listeners = listeners
  }

  private setState(patch: Partial<WhisperClientState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.onStateChange?.(this.state)
  }

  private toError(message: string, code?: WhisperWorkerErrorCode): Error {
    if (code === 'WEBGPU_UNAVAILABLE') {
      return new WhisperWebGpuUnavailableError(message)
    }
    if (code === 'MODEL_NOT_LOADED') {
      return new WhisperModelNotLoadedError(message)
    }
    return new Error(message)
  }

  getState(): WhisperClientState {
    return this.state
  }

  async probeEnvironment(): Promise<WhisperClientState> {
    const webGpu = await probeWebGpu()
    this.setState({
      webGpuAvailable: webGpu.available,
      webGpuError: webGpu.error ?? null,
    })
    return this.state
  }

  async ping(): Promise<string> {
    return this.sendRequest<string>({ type: 'ping' })
  }

  async ensureLoaded(modelId?: string): Promise<void> {
    if (this.state.status === 'ready') return
    if (this.loadPromise) {
      await this.loadPromise
      return
    }

    this.loadPromise = this.load(modelId).finally(() => {
      this.loadPromise = null
    })
    await this.loadPromise
  }

  async load(modelId: string = WHISPER_ASR_MODEL_ID): Promise<void> {
    await this.probeEnvironment()
    this.setState({ status: 'loading', lastError: null, modelId })
    await this.sendRequest<void>({ type: 'load', modelId })
    this.setState({ status: 'ready', lastError: null })
  }

  async transcribeChunk(
    audio: Float32Array,
    options: WhisperTranscribeChunkOptions = {},
  ): Promise<WhisperTranscribeResult> {
    if (this.state.status !== 'ready' && this.state.status !== 'transcribing') {
      throw new WhisperModelNotLoadedError('Call ensureLoaded() before transcribeChunk().')
    }

    const pcm = options.copyAudio ? audio.slice() : audio
    const command: Extract<WhisperWorkerCommand, { type: 'transcribe' }> = {
      type: 'transcribe',
      audio: pcm,
      sampleRateHz: options.sampleRateHz,
    }

    this.setState({ status: 'transcribing', lastError: null })

    try {
      const result = await this.sendRequest<WhisperTranscribeResult>(
        command,
        whisperTranscribeTransferables(command),
      )
      this.setState({ status: 'ready', lastError: null })
      return {
        ...result,
        text: this.formatEmitText(result.text),
      }
    } catch (error) {
      this.setState({
        status: 'error',
        lastError: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async reset(): Promise<void> {
    if (!this.worker) return
    await this.sendRequest<void>({ type: 'reset' })
  }

  async dispose(): Promise<void> {
    if (this.worker) {
      try {
        await this.sendRequest<void>({ type: 'dispose' })
      } catch {
        // Worker may already be torn down.
      }
      this.worker.removeEventListener('message', this.handleMessage)
      this.worker.terminate()
    }

    this.worker = null
    this.workerInitPromise = null
    this.loadPromise = null
    this.pending.clear()
    this.setState({
      status: 'idle',
      loadProgress: null,
      lastError: null,
    })
  }
}

let singletonClient: WhisperClient | null = null

export function createWhisperClient(options: WhisperClientOptions = {}): WhisperClient {
  return new WhisperClient(options)
}

export function getWhisperClient(options?: WhisperClientOptions): WhisperClient {
  if (!singletonClient) {
    singletonClient = createWhisperClient(options)
  }
  return singletonClient
}

/** Dev harness — cleanup on client emit path (BDA-188). */
export function runWhisperClientCleanupHarness(): void {
  const cases: { input: string; expected: string }[] = [
    { input: 'um find the clause', expected: 'find the clause' },
    { input: 'uh, find the', expected: 'find the' },
  ]

  for (const { input, expected } of cases) {
    const cleaned = whisperEmitText(input, true)
    if (cleaned !== expected) {
      throw new Error(
        `runWhisperClientCleanupHarness: expected ${JSON.stringify(expected)}, got ${JSON.stringify(cleaned)}`,
      )
    }
    if (whisperEmitText(input, false) !== input) {
      throw new Error('runWhisperClientCleanupHarness: cleanTranscript false should pass through')
    }
  }
}

/** Dev harness — client load + silence transcribe (BDA-184). */
export async function runWhisperClientHarness(): Promise<void> {
  const client = createWhisperClient()

  try {
    const env = await client.probeEnvironment()
    if (!env.webGpuAvailable) {
      if (import.meta.env.DEV) {
        console.warn('[whisper-client-harness] skip — WebGPU unavailable')
      }
      return
    }

    const pong = await client.ping()
    if (pong !== 'pong') {
      throw new Error(`runWhisperClientHarness: expected pong, got ${String(pong)}`)
    }

    await client.ensureLoaded()

    const partials: string[] = []
    client.setListeners({
      onPartial: (text) => partials.push(text),
    })

    const silence = new Float32Array(16_000)
    const result = await client.transcribeChunk(silence, { copyAudio: true })

    if (typeof result.text !== 'string') {
      throw new Error('runWhisperClientHarness: transcribe result missing text')
    }

    if (import.meta.env.DEV) {
      console.debug('[whisper-client-harness] ok', {
        textLength: result.text.length,
        partialEvents: partials.length,
        status: client.getState().status,
      })
    }
  } finally {
    await client.dispose()
  }
}

export { WhisperWebGpuUnavailableError, WhisperModelNotLoadedError }
