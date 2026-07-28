import type { ChatMessage } from 'bitgpu/chat'

export type ScoperLoadPhase = string

export type ScoperWorkerCommand =
  | { type: 'ping' }
  | { type: 'load' }
  | {
      type: 'send'
      messages: ChatMessage[]
      temperature?: number
      topK?: number
      maxTokens?: number
    }
  | { type: 'stop' }
  | { type: 'reset' }

export type ScoperWorkerRequest = { id: string } & ScoperWorkerCommand

export type ScoperWorkerSuccess = {
  ok: true
  result?: unknown
}

export type ScoperWorkerFailure = {
  ok: false
  error: string
  code?: 'WEBGPU_UNAVAILABLE' | 'UNKNOWN'
}

export type ScoperWorkerResponse = (ScoperWorkerSuccess | ScoperWorkerFailure) & {
  id: string
}

export type ScoperWorkerEvent =
  | { type: 'progress'; phase: ScoperLoadPhase; loaded?: number; total?: number }
  | { type: 'delta'; delta: string }
  | {
      type: 'complete'
      text: string
      tokensPerSecond: number
      finishReason: string
    }
  | { type: 'error'; message: string; code?: 'WEBGPU_UNAVAILABLE' | 'UNKNOWN' }

export type ScoperWorkerOutbound = ScoperWorkerResponse | ScoperWorkerEvent

export type ScoperGenerateResult = {
  text: string
  tokensPerSecond: number
  finishReason: string
}

export type ScoperLoadProgress = {
  phase: ScoperLoadPhase
  loaded?: number
  total?: number
}

export type ScoperSendOptions = {
  temperature?: number
  topK?: number
  maxTokens?: number
  onText?: (delta: string) => void
  signal?: AbortSignal
}

export type WebGpuProbeResult = {
  available: boolean
  error?: string
}

export class ScoperWebGpuUnavailableError extends Error {
  readonly name = 'ScoperWebGpuUnavailableError'

  constructor(message: string) {
    super(message)
  }
}

export type { ChatMessage }
