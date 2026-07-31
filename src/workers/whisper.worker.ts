/// <reference lib="webworker" />

import { env, pipeline } from '@huggingface/transformers'

import { WHISPER_ASR_MODEL_ID } from '@/lib/whisper-model'
import {
  resolveWhisperSampleRateHz,
  type WhisperTranscribeResult,
  type WhisperWorkerCommand,
  type WhisperWorkerErrorCode,
  type WhisperWorkerOutbound,
  WhisperModelNotLoadedError,
  WhisperWebGpuUnavailableError,
} from '@/lib/whisper-protocol'

type AutomaticSpeechRecognitionPipeline = (
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text: string }>

let asrPipeline: AutomaticSpeechRecognitionPipeline | null = null
let loadedModelId: string | null = null

function postOutbound(message: WhisperWorkerOutbound) {
  self.postMessage(message)
}

function postError(message: string, code: WhisperWorkerErrorCode = 'UNKNOWN') {
  postOutbound({ type: 'error', message, code })
}

function configureTransformersEnv(): void {
  env.allowRemoteModels = true
  env.useBrowserCache = true
}

function mapProgressCallback(data: Record<string, unknown>): void {
  if (data.status !== 'progress') return
  const loaded = typeof data.loaded === 'number' ? data.loaded : undefined
  const total = typeof data.total === 'number' ? data.total : undefined
  postOutbound({ type: 'progress', phase: 'download', loaded, total })
}

async function createAsrPipeline(modelId: string): Promise<AutomaticSpeechRecognitionPipeline> {
  configureTransformersEnv()
  postOutbound({ type: 'progress', phase: 'init' })

  let lastError: unknown

  for (const device of ['webgpu', 'wasm'] as const) {
    try {
      postOutbound({ type: 'progress', phase: 'compile' })
      const pipe = (await pipeline('automatic-speech-recognition', modelId, {
        device,
        progress_callback: mapProgressCallback,
      })) as AutomaticSpeechRecognitionPipeline

      if (device === 'wasm') {
        console.warn('[whisper-worker] WebGPU unavailable or failed; using WASM for Whisper ASR')
      }

      return pipe
    } catch (error) {
      lastError = error
      if (device === 'webgpu') {
        console.warn('[whisper-worker] WebGPU ASR load failed; falling back to WASM', error)
      }
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : 'Whisper ASR pipeline could not be created.'
  throw new WhisperWebGpuUnavailableError(message)
}

async function handleLoad(command: Extract<WhisperWorkerCommand, { type: 'load' }>) {
  const modelId = command.modelId?.trim() || WHISPER_ASR_MODEL_ID
  if (asrPipeline && loadedModelId === modelId) {
    postOutbound({ type: 'progress', phase: 'ready' })
    return
  }

  if (asrPipeline) {
    asrPipeline = null
    loadedModelId = null
  }

  asrPipeline = await createAsrPipeline(modelId)
  loadedModelId = modelId
  postOutbound({ type: 'progress', phase: 'ready' })
}

async function handleTranscribe(
  command: Extract<WhisperWorkerCommand, { type: 'transcribe' }>,
): Promise<WhisperTranscribeResult> {
  if (!asrPipeline) {
    throw new WhisperModelNotLoadedError()
  }

  const sampleRateHz = resolveWhisperSampleRateHz(command.sampleRateHz)
  const audio = command.audio

  if (audio.length === 0) {
    return { text: '' }
  }

  postOutbound({ type: 'partial', text: '' })

  const result = await asrPipeline(audio, {
    sampling_rate: sampleRateHz,
    return_timestamps: false,
  })

  const text = (result?.text ?? '').trim()
  if (text.length > 0) {
    postOutbound({ type: 'partial', text })
    postOutbound({ type: 'segment', text })
  }

  return { text }
}

function handleReset(): void {
  // Model stays loaded; streaming state is owned by the main-thread session (BDA-187).
}

function handleDispose(): void {
  asrPipeline = null
  loadedModelId = null
}

async function handleCommand(command: WhisperWorkerCommand): Promise<unknown> {
  switch (command.type) {
    case 'load':
      await handleLoad(command)
      return true
    case 'transcribe':
      return await handleTranscribe(command)
    case 'reset':
      handleReset()
      return true
    case 'dispose':
      handleDispose()
      return true
    case 'ping':
      return 'pong'
    default: {
      const exhaustive: never = command
      throw new Error(`Unknown whisper worker command: ${String(exhaustive)}`)
    }
  }
}

function errorCodeFor(error: unknown): WhisperWorkerErrorCode {
  if (error instanceof WhisperWebGpuUnavailableError) return 'WEBGPU_UNAVAILABLE'
  if (error instanceof WhisperModelNotLoadedError) return 'MODEL_NOT_LOADED'
  return 'UNKNOWN'
}

self.onmessage = async (event: MessageEvent<WhisperWorkerCommand & { id?: string }>) => {
  const { id, ...command } = event.data

  try {
    const result = await handleCommand(command)

    if (id) {
      postOutbound({ id, ok: true, result })
    }
  } catch (error) {
    const code =
      command.type === 'transcribe' && !(error instanceof WhisperModelNotLoadedError)
        ? 'TRANSCRIBE_FAILED'
        : errorCodeFor(error)

    const message = error instanceof Error ? error.message : String(error)

    if (id) {
      postOutbound({ id, ok: false, error: message, code })
    } else {
      postError(message, code)
    }
  }
}

export {}
