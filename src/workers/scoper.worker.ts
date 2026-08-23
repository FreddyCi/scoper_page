/// <reference lib="webworker" />

import { createEngine, WebGPUUnavailableError } from 'bitgpu'
import { createChat, type ChatMessage } from 'bitgpu/chat'

import { SCOPER_CHAT_SYSTEM_PROMPT } from '@/lib/scoper-chat-system'
import { fetchArrayBufferCached, fetchJsonCached } from '@/lib/scoper-cache'
import {
  SCOPER_BONSAI_17B,
  getScoperEngineOptions,
  getScoperMaxSeqLenFromEnv,
  SCOPER_MAX_SEQ_LEN_FALLBACK,
  scoperMaxSeqLenFallbackNotice,
  SCOPER_SEND_DEFAULTS,
  type ScoperMaxSeqLen,
} from '@/lib/scoper-model'
import type { ScoperWorkerCommand, ScoperWorkerOutbound } from '@/lib/scoper-protocol'

let engine: Awaited<ReturnType<typeof createEngine>> | null = null
let chat: Awaited<ReturnType<typeof createChat>> | null = null
let abortController: AbortController | null = null

function postOutbound(message: ScoperWorkerOutbound) {
  self.postMessage(message)
}

function postError(message: string, code: 'WEBGPU_UNAVAILABLE' | 'UNKNOWN' = 'UNKNOWN') {
  postOutbound({ type: 'error', message, code })
}

async function createScoperEngine(maxSeqLen: ScoperMaxSeqLen) {
  const engineOptions = getScoperEngineOptions(maxSeqLen)
  return createEngine({
    manifestUrl: SCOPER_BONSAI_17B.manifestUrl,
    auxUrl: SCOPER_BONSAI_17B.auxUrl,
    dataUrl: SCOPER_BONSAI_17B.dataUrl,
    fetchJson: fetchJsonCached,
    fetchArrayBuffer: fetchArrayBufferCached,
    kvCache: engineOptions.kvCache,
    overflow: engineOptions.overflow,
    maxSeqLen: engineOptions.maxSeqLen,
    sinkTokens: engineOptions.sinkTokens,
    onProgress: (progress) => {
      postOutbound({
        type: 'progress',
        phase: progress.phase,
        loaded: progress.loaded,
        total: progress.total,
      })
    },
  })
}

async function handleLoad() {
  if (chat) {
    postOutbound({ type: 'progress', phase: 'ready' })
    return
  }

  const preferred = getScoperMaxSeqLenFromEnv()
  let effective: ScoperMaxSeqLen = preferred
  let notice: string | undefined

  try {
    engine = await createScoperEngine(preferred)
  } catch (firstError) {
    if (preferred === SCOPER_MAX_SEQ_LEN_FALLBACK) {
      throw firstError
    }
    engine = null
    effective = SCOPER_MAX_SEQ_LEN_FALLBACK
    try {
      engine = await createScoperEngine(effective)
      notice = scoperMaxSeqLenFallbackNotice(preferred)
      console.warn('[scoper-worker] maxSeqLen fallback:', firstError)
    } catch {
      throw firstError
    }
  }

  chat = await createChat(engine, {
    tokenizerJsonUrl: SCOPER_BONSAI_17B.tokenizerJsonUrl,
    tokenizerConfigUrl: SCOPER_BONSAI_17B.tokenizerConfigUrl,
    fetchJson: fetchJsonCached,
  })

  await chat.prewarm([{ role: 'system', content: SCOPER_CHAT_SYSTEM_PROMPT }])

  postOutbound({ type: 'engine-config', maxSeqLen: effective, notice })
  postOutbound({ type: 'progress', phase: 'ready' })
}

async function handleSend(command: Extract<ScoperWorkerCommand, { type: 'send' }>) {
  if (!chat) {
    throw new Error('Scoper model is not loaded')
  }

  abortController = new AbortController()

  const result = await chat.send(command.messages as ChatMessage[], {
    temperature: command.temperature ?? SCOPER_SEND_DEFAULTS.temperature,
    topK: command.topK ?? SCOPER_SEND_DEFAULTS.topK,
    maxTokens: command.maxTokens ?? SCOPER_SEND_DEFAULTS.maxTokens,
    signal: abortController.signal,
    onText: (delta) => {
      postOutbound({ type: 'delta', delta })
    },
  })

  postOutbound({
    type: 'complete',
    text: result.text,
    tokensPerSecond: result.tokensPerSecond,
    finishReason: result.finishReason,
  })
}

async function handleCommand(command: ScoperWorkerCommand) {
  switch (command.type) {
    case 'load':
      await handleLoad()
      return
    case 'send':
      await handleSend(command)
      return
    case 'stop':
      abortController?.abort()
      return
    case 'reset':
      chat?.reset()
      return
    case 'ping':
      return
    default: {
      const exhaustive: never = command
      throw new Error(`Unknown scoper worker command: ${String(exhaustive)}`)
    }
  }
}

self.onmessage = async (event: MessageEvent<ScoperWorkerCommand & { id?: string }>) => {
  const { id, ...command } = event.data

  try {
    if (command.type === 'ping' && id) {
      postOutbound({ id, ok: true, result: 'pong' })
      return
    }

    await handleCommand(command)

    if (id) {
      postOutbound({ id, ok: true })
    }
  } catch (error) {
    if (error instanceof WebGPUUnavailableError) {
      if (id) {
        postOutbound({
          id,
          ok: false,
          error: error.message,
          code: 'WEBGPU_UNAVAILABLE',
        })
      } else {
        postError(error.message, 'WEBGPU_UNAVAILABLE')
      }
      return
    }

    const message = error instanceof Error ? error.message : String(error)
    if (id) {
      postOutbound({ id, ok: false, error: message, code: 'UNKNOWN' })
    } else {
      postError(message)
    }
  }
}

export {}
