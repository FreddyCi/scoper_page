import { cleanSpeechTranscript } from '@/lib/speech-transcript-cleanup'
import {
  isSilentSpeechChunk,
  isWhisperNoiseTranscript,
} from '@/lib/speech-chunk-vad'
import type { ChatVoiceCaptureStartResult } from '@/services/chat-voice-capture'
import {
  isChatVoiceCaptureActive,
  startChatVoiceCapture,
  stopChatVoiceCapture,
  type ChatVoiceCaptureChunk,
} from '@/services/chat-voice-capture'
import { getWhisperClient } from '@/services/whisper-client'
import { useSessionStore } from '@/store/session-store'

export type ChatVoiceSessionState = 'idle' | 'starting' | 'listening' | 'stopping' | 'error'

export type ChatVoiceSessionListeners = {
  onPartial: (text: string) => void
  onError?: (error: Error) => void
  onStateChange?: (state: ChatVoiceSessionState) => void
}

export type StopChatVoiceSessionOptions = {
  /** Release Whisper worker GPU memory after stop (default false). */
  disposeWhisper?: boolean
}

let sessionState: ChatVoiceSessionState = 'idle'
let listenActive = false
let mergedTranscript = ''
const chunkQueue: ChatVoiceCaptureChunk[] = []
let drainPromise: Promise<void> | null = null
let listeners: ChatVoiceSessionListeners | null = null
const sessionStateListeners = new Set<(state: ChatVoiceSessionState) => void>()

export function subscribeChatVoiceSessionState(
  listener: (state: ChatVoiceSessionState) => void,
): () => void {
  sessionStateListeners.add(listener)
  listener(sessionState)
  return () => {
    sessionStateListeners.delete(listener)
  }
}

function isAgentBusy(): boolean {
  const state = useSessionStore.getState()
  return state.chatGenerating || state.proposalGenerating
}

function setSessionState(next: ChatVoiceSessionState) {
  sessionState = next
  listeners?.onStateChange?.(next)
  for (const listener of sessionStateListeners) {
    listener(next)
  }
}

/** Merge overlapping ASR segment text into a running transcript (BDA-187). */
export function mergeSegmentIntoTranscript(existing: string, segment: string): string {
  const seg = segment.trim()
  if (!seg) return existing.trim()
  const base = existing.trim()
  if (!base) return cleanSpeechTranscript(seg)

  const maxOverlap = Math.min(base.length, seg.length, 120)
  for (let len = maxOverlap; len > 0; len -= 1) {
    if (base.slice(-len).toLowerCase() === seg.slice(0, len).toLowerCase()) {
      return cleanSpeechTranscript(`${base}${seg.slice(len)}`)
    }
  }

  return cleanSpeechTranscript(`${base} ${seg}`)
}

function emitPartial(text: string) {
  mergedTranscript = cleanSpeechTranscript(text)
  listeners?.onPartial(mergedTranscript)
}

async function drainTranscribeQueue(): Promise<void> {
  if (drainPromise) {
    await drainPromise
    return
  }

  drainPromise = (async () => {
    const client = getWhisperClient()

    while (listenActive && chunkQueue.length > 0 && !isAgentBusy()) {
      const chunk = chunkQueue.shift()
      if (!chunk) break

      try {
        if (isSilentSpeechChunk(chunk.pcm)) {
          continue
        }

        const result = await client.transcribeChunk(chunk.pcm, {
          copyAudio: true,
          sampleRateHz: chunk.sampleRateHz,
        })

        const segment = result.text.trim()
        if (!segment || isWhisperNoiseTranscript(segment)) {
          continue
        }

        emitPartial(mergeSegmentIntoTranscript(mergedTranscript, segment))
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        setSessionState('error')
        listeners?.onError?.(err)
        listenActive = false
        stopChatVoiceCapture()
        break
      }
    }
  })().finally(() => {
    drainPromise = null
  })

  await drainPromise
}

function enqueueCaptureChunk(chunk: ChatVoiceCaptureChunk) {
  if (!listenActive || isAgentBusy()) {
    return
  }
  chunkQueue.push(chunk)
  void drainTranscribeQueue()
}

export function getChatVoiceSessionState(): ChatVoiceSessionState {
  return sessionState
}

export function isChatVoiceSessionActive(): boolean {
  return listenActive
}

export function getChatVoiceSessionTranscript(): string {
  return mergedTranscript
}

export async function startChatVoiceSession(
  sessionListeners: ChatVoiceSessionListeners,
): Promise<ChatVoiceCaptureStartResult> {
  if (listenActive || isChatVoiceCaptureActive()) {
    return {
      ok: false,
      code: 'already_active',
      message: 'Voice session is already active.',
    }
  }

  if (isAgentBusy()) {
    return {
      ok: false,
      code: 'not_supported',
      message: 'Stop the agent or proposal generation before using voice input.',
    }
  }

  listeners = sessionListeners
  mergedTranscript = ''
  chunkQueue.length = 0
  setSessionState('starting')

  const client = getWhisperClient()
  client.setListeners({
    onPartial: (text) => {
      if (!listenActive || !text.trim() || isWhisperNoiseTranscript(text)) return
      emitPartial(mergeSegmentIntoTranscript(mergedTranscript, text))
    },
    onSegment: (text) => {
      if (!listenActive || !text.trim() || isWhisperNoiseTranscript(text)) return
      emitPartial(mergeSegmentIntoTranscript(mergedTranscript, text))
    },
    onError: (error) => {
      listeners?.onError?.(error)
    },
  })

  try {
    await client.ensureLoaded()
    await client.reset()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setSessionState('error')
    listeners?.onError?.(error instanceof Error ? error : new Error(message))
    listeners = null
    return { ok: false, code: 'not_supported', message }
  }

  listenActive = true
  setSessionState('listening')

  const captureResult = await startChatVoiceCapture({
    onChunk: enqueueCaptureChunk,
    onError: (error) => {
      listeners?.onError?.(error)
      setSessionState('error')
    },
  })

  if (!captureResult.ok) {
    listenActive = false
    setSessionState('idle')
    listeners = null
    return captureResult
  }

  return { ok: true }
}

export async function stopChatVoiceSession(
  options: StopChatVoiceSessionOptions = {},
): Promise<string> {
  if (!listenActive && sessionState === 'idle') {
    return mergedTranscript
  }

  setSessionState('stopping')
  listenActive = false
  stopChatVoiceCapture()

  await drainTranscribeQueue()

  const finalText = mergedTranscript
  chunkQueue.length = 0

  if (options.disposeWhisper) {
    await getWhisperClient().dispose()
  }

  setSessionState('idle')
  listeners = null

  return finalText
}

let lastAgentBusy = false
useSessionStore.subscribe((state) => {
  const agentBusy = state.chatGenerating || state.proposalGenerating
  if (listenActive && agentBusy && !lastAgentBusy) {
    void stopChatVoiceSession({ disposeWhisper: true })
  }
  lastAgentBusy = agentBusy
})

/** Dev harness — merge helper + queue guard (BDA-187). */
export function runChatVoiceSessionMergeHarness(): void {
  const merged = mergeSegmentIntoTranscript('find the indemn', 'indemnity clause')
  if (merged !== 'find the indemnity clause') {
    throw new Error(`runChatVoiceSessionMergeHarness: overlap merge failed: ${merged}`)
  }

  const appended = mergeSegmentIntoTranscript('hello world', 'again')
  if (appended !== 'hello world again') {
    throw new Error(`runChatVoiceSessionMergeHarness: append failed: ${appended}`)
  }

  const cleaned = mergeSegmentIntoTranscript('', 'um find clause')
  if (cleaned !== 'find clause') {
    throw new Error(`runChatVoiceSessionMergeHarness: cleanup in merge failed: ${cleaned}`)
  }
}

/** Dev harness — serial queue with Whisper (WebGPU); no microphone (BDA-187). */
export async function runChatVoiceSessionHarness(): Promise<void> {
  runChatVoiceSessionMergeHarness()

  const client = getWhisperClient()
  const env = await client.probeEnvironment()
  if (!env.webGpuAvailable) {
    if (import.meta.env.DEV) {
      console.warn('[chat-voice-session-harness] skip whisper queue — WebGPU unavailable')
    }
    return
  }

  const partials: string[] = []

  try {
    listenActive = true
    mergedTranscript = ''
    chunkQueue.length = 0
    listeners = {
      onPartial: (text) => partials.push(text),
    }
    setSessionState('listening')

    await client.ensureLoaded()
    await client.reset()

    const chunkA = new Float32Array(16_000)
    const chunkB = new Float32Array(16_000)
    enqueueCaptureChunk({ pcm: chunkA, sampleRateHz: 16_000, index: 0 })
    enqueueCaptureChunk({ pcm: chunkB, sampleRateHz: 16_000, index: 1 })

    await drainTranscribeQueue()

    listenActive = false
    setSessionState('idle')
    listeners = null

    if (import.meta.env.DEV) {
      console.debug('[chat-voice-session-harness] ok', {
        partialUpdates: partials.length,
        transcriptLength: mergedTranscript.length,
      })
    }
  } finally {
    listenActive = false
    chunkQueue.length = 0
    await client.dispose()
    setSessionState('idle')
    listeners = null
  }
}
