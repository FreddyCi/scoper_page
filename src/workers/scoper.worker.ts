/// <reference lib="webworker" />

import { createEngine, WebGPUUnavailableError } from 'bitgpu'
import { createChat, type ChatMessage } from 'bitgpu/chat'

import { fetchArrayBufferCached, fetchJsonCached } from '@/lib/scoper-cache'
import {
  SCOPER_BONSAI_17B,
  SCOPER_ENGINE_DEFAULTS,
  SCOPER_SEND_DEFAULTS,
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

async function handleLoad() {
  if (chat) {
    postOutbound({ type: 'progress', phase: 'ready' })
    return
  }

  engine = await createEngine({
    manifestUrl: SCOPER_BONSAI_17B.manifestUrl,
    auxUrl: SCOPER_BONSAI_17B.auxUrl,
    dataUrl: SCOPER_BONSAI_17B.dataUrl,
    fetchJson: fetchJsonCached,
    fetchArrayBuffer: fetchArrayBufferCached,
    kvCache: SCOPER_ENGINE_DEFAULTS.kvCache,
    overflow: SCOPER_ENGINE_DEFAULTS.overflow,
    maxSeqLen: SCOPER_ENGINE_DEFAULTS.maxSeqLen,
    sinkTokens: SCOPER_ENGINE_DEFAULTS.sinkTokens,
    onProgress: (progress) => {
      postOutbound({
        type: 'progress',
        phase: progress.phase,
        loaded: progress.loaded,
        total: progress.total,
      })
    },
  })

  chat = await createChat(engine, {
    tokenizerJsonUrl: SCOPER_BONSAI_17B.tokenizerJsonUrl,
    tokenizerConfigUrl: SCOPER_BONSAI_17B.tokenizerConfigUrl,
    fetchJson: fetchJsonCached,
  })

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
