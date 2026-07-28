import type {
  ChatMessage,
  ScoperGenerateResult,
  ScoperLoadProgress,
  ScoperSendOptions,
  ScoperWorkerCommand,
  ScoperWorkerEvent,
  ScoperWorkerOutbound,
} from '@/lib/scoper-protocol'
import { ScoperWebGpuUnavailableError } from '@/lib/scoper-protocol'
import { getScoperModelCacheStatus } from '@/lib/scoper-cache'
import { probeWebGpu } from '@/lib/scoper-webgpu'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

export type ScoperClientStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error'

export type ScoperClientState = {
  status: ScoperClientStatus
  loadProgress: ScoperLoadProgress | null
  lastError: string | null
  webGpuAvailable: boolean | null
  webGpuError: string | null
  modelCached: boolean | null
}

type ScoperClientListeners = {
  onStateChange?: (state: ScoperClientState) => void
  onProgress?: (progress: ScoperLoadProgress) => void
  onDelta?: (delta: string) => void
  onError?: (error: Error) => void
}

export class ScoperClient {
  private worker: Worker | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private abortController: AbortController | null = null
  private listeners: ScoperClientListeners = {}
  private state: ScoperClientState = {
    status: 'idle',
    loadProgress: null,
    lastError: null,
    webGpuAvailable: null,
    webGpuError: null,
    modelCached: null,
  }

  private readonly handleMessage = (event: MessageEvent<ScoperWorkerOutbound>) => {
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
      this.handleEvent(message as ScoperWorkerEvent)
    }
  }

  private handleEvent(message: ScoperWorkerEvent) {
    switch (message.type) {
      case 'progress': {
        const loadProgress = {
          phase: message.phase,
          loaded: message.loaded,
          total: message.total,
        }
        this.setState({
          status: message.phase === 'ready' ? 'ready' : 'loading',
          loadProgress,
          lastError: null,
        })
        this.listeners.onProgress?.(loadProgress)
        return
      }
      case 'delta':
        this.listeners.onDelta?.(message.delta)
        return
      case 'complete':
        this.setState({ status: 'ready', lastError: null })
        this.finishPendingSend({
          text: message.text,
          tokensPerSecond: message.tokensPerSecond,
          finishReason: message.finishReason,
        })
        return
      case 'error': {
        const error = this.toError(message.message, message.code)
        this.setState({ status: 'error', lastError: error.message })
        this.listeners.onError?.(error)
        this.rejectPendingSend(error)
        return
      }
      default:
        return
    }
  }

  private sendRequest<T = unknown>(request: ScoperWorkerCommand): Promise<T> {
    const worker = this.ensureWorker()
    const id = crypto.randomUUID()

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })
      worker.postMessage({ id, ...request })
    })
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker

    this.worker = new Worker(new URL('../workers/scoper.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Scoper worker error')
      this.setState({ status: 'error', lastError: error.message })
      this.listeners.onError?.(error)
      for (const pending of this.pending.values()) {
        pending.reject(error)
      }
      this.pending.clear()
    })

    return this.worker
  }

  private setState(patch: Partial<ScoperClientState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.onStateChange?.(this.state)
  }

  private toError(message: string, code?: 'WEBGPU_UNAVAILABLE' | 'UNKNOWN'): Error {
    if (code === 'WEBGPU_UNAVAILABLE') {
      return new ScoperWebGpuUnavailableError(message)
    }
    return new Error(message)
  }

  private pendingSend:
    | {
        resolve: (value: ScoperGenerateResult) => void
        reject: (reason: Error) => void
      }
    | null = null

  private finishPendingSend(result: ScoperGenerateResult) {
    this.pendingSend?.resolve(result)
    this.pendingSend = null
    this.abortController = null
  }

  private rejectPendingSend(error: Error) {
    this.pendingSend?.reject(error)
    this.pendingSend = null
    this.abortController = null
  }

  setListeners(listeners: ScoperClientListeners) {
    this.listeners = listeners
  }

  getState(): ScoperClientState {
    return this.state
  }

  async probeEnvironment(): Promise<ScoperClientState> {
    const [webGpu, cacheStatus] = await Promise.all([probeWebGpu(), getScoperModelCacheStatus()])
    this.setState({
      webGpuAvailable: webGpu.available,
      webGpuError: webGpu.error ?? null,
      modelCached: cacheStatus.manifestCached && cacheStatus.weightsCached,
    })
    return this.state
  }

  async ping(): Promise<string> {
    const result = await this.sendRequest<string>({ type: 'ping' })
    return result
  }

  async load(): Promise<void> {
    const env = await this.probeEnvironment()
    if (!env.webGpuAvailable) {
      throw new ScoperWebGpuUnavailableError(
        env.webGpuError ?? 'WebGPU is required for on-device chat.',
      )
    }

    this.setState({ status: 'loading', lastError: null })
    await this.sendRequest<void>({ type: 'load' })
  }

  async send(messages: ChatMessage[], options: ScoperSendOptions = {}): Promise<ScoperGenerateResult> {
    if (this.pendingSend) {
      throw new Error('Scoper is already generating a response')
    }

    this.setState({ status: 'generating', lastError: null })
    this.abortController = options.signal ? null : new AbortController()
    const signal = options.signal ?? this.abortController?.signal

    if (options.onText) {
      const priorDelta = this.listeners.onDelta
      this.listeners.onDelta = (delta) => {
        priorDelta?.(delta)
        options.onText?.(delta)
      }
    }

    const resultPromise = new Promise<ScoperGenerateResult>((resolve, reject) => {
      this.pendingSend = { resolve, reject }
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            this.stop()
            reject(new DOMException('Scoper generation aborted', 'AbortError'))
          },
          { once: true },
        )
      }
    })

    void this.ensureWorker().postMessage({
      type: 'send',
      messages,
      temperature: options.temperature,
      topK: options.topK,
      maxTokens: options.maxTokens,
    })

    return resultPromise
  }

  stop() {
    this.ensureWorker().postMessage({ type: 'stop' })
  }

  resetConversation() {
    this.ensureWorker().postMessage({ type: 'reset' })
  }

  dispose() {
    if (!this.worker) return
    this.worker.removeEventListener('message', this.handleMessage)
    this.worker.terminate()
    this.worker = null
    this.pending.clear()
    this.pendingSend = null
    this.abortController = null
    this.setState({
      status: 'idle',
      loadProgress: null,
      lastError: null,
    })
  }
}

let singletonClient: ScoperClient | null = null

export function createScoperClient(): ScoperClient {
  return new ScoperClient()
}

export function getScoperClient(): ScoperClient {
  if (!singletonClient) {
    singletonClient = createScoperClient()
  }
  return singletonClient
}

/** Dev harness — WebGPU probe + worker ping (BDA-050) */
export async function runScoperHarness(): Promise<void> {
  const client = createScoperClient()

  try {
    const env = await client.probeEnvironment()
    if (!env.webGpuAvailable) {
      console.warn('[scoper-harness] WebGPU unavailable:', env.webGpuError)
      return
    }

    const pong = await client.ping()
    if (pong !== 'pong') {
      throw new Error('Scoper harness: worker ping failed')
    }
  } finally {
    client.dispose()
  }
}

/** Optional dev harness — downloads model and streams one reply */
export async function runScoperModelHarness(): Promise<void> {
  const client = createScoperClient()
  const deltas: string[] = []

  try {
    await client.probeEnvironment()
    await client.load()

    const result = await client.send(
      [{ role: 'user', content: 'Reply with exactly: harness ok' }],
      {
        maxTokens: 32,
        onText: (delta) => deltas.push(delta),
      },
    )

    if (!result.text.trim()) {
      throw new Error('Scoper model harness: empty response text')
    }
    if (deltas.length === 0) {
      throw new Error('Scoper model harness: expected streaming deltas')
    }
  } finally {
    client.dispose()
  }
}

export { probeWebGpu, ScoperWebGpuUnavailableError }
