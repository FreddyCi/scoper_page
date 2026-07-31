import { WHISPER_ASR_SAMPLE_RATE_HZ } from '@/lib/whisper-model'

export type WhisperWorkerErrorCode =
  | 'WEBGPU_UNAVAILABLE'
  | 'MODEL_NOT_LOADED'
  | 'TRANSCRIBE_FAILED'
  | 'UNKNOWN'

export type WhisperLoadPhase = 'init' | 'download' | 'compile' | 'ready'

export type WhisperWorkerCommand =
  | { type: 'ping' }
  | { type: 'load'; modelId?: string }
  | {
      type: 'transcribe'
      /** Mono PCM at {@link WHISPER_ASR_SAMPLE_RATE_HZ} unless `sampleRateHz` overrides. */
      audio: Float32Array
      sampleRateHz?: number
    }
  | { type: 'reset' }
  | { type: 'dispose' }

export type WhisperWorkerRequest = { id: string } & WhisperWorkerCommand

export type WhisperTranscribeResult = {
  text: string
}

export type WhisperWorkerSuccess = {
  ok: true
  result?: unknown
}

export type WhisperWorkerFailure = {
  ok: false
  error: string
  code?: WhisperWorkerErrorCode
}

export type WhisperWorkerResponse = (WhisperWorkerSuccess | WhisperWorkerFailure) & {
  id: string
}

export type WhisperWorkerEvent =
  | { type: 'progress'; phase: WhisperLoadPhase; loaded?: number; total?: number }
  | { type: 'partial'; text: string }
  | { type: 'segment'; text: string }
  | { type: 'error'; message: string; code?: WhisperWorkerErrorCode }

export type WhisperWorkerOutbound = WhisperWorkerResponse | WhisperWorkerEvent

export type WhisperLoadProgress = {
  phase: WhisperLoadPhase
  loaded?: number
  total?: number
}

export class WhisperWebGpuUnavailableError extends Error {
  readonly name = 'WhisperWebGpuUnavailableError'

  constructor(message: string) {
    super(message)
  }
}

export class WhisperModelNotLoadedError extends Error {
  readonly name = 'WhisperModelNotLoadedError'

  constructor(message = 'Whisper model is not loaded.') {
    super(message)
  }
}

/** Default sample rate when a transcribe command omits `sampleRateHz`. */
export function resolveWhisperSampleRateHz(sampleRateHz?: number): number {
  return sampleRateHz ?? WHISPER_ASR_SAMPLE_RATE_HZ
}

/** Transfer list for `postMessage` when sending a transcribe command to the worker. */
export function whisperTranscribeTransferables(
  command: Extract<WhisperWorkerCommand, { type: 'transcribe' }>,
): Transferable[] {
  return [command.audio.buffer]
}

function assertNever(value: never): never {
  throw new Error(`Unexpected whisper protocol value: ${String(value)}`)
}

/** Dev harness — discriminated unions compile and exhaust (BDA-182). */
export function runWhisperProtocolHarness(): void {
  const commands: WhisperWorkerCommand[] = [
    { type: 'ping' },
    { type: 'load' },
    { type: 'load', modelId: 'Xenova/whisper-tiny.en' },
    { type: 'transcribe', audio: new Float32Array(1600), sampleRateHz: 16_000 },
    { type: 'reset' },
    { type: 'dispose' },
  ]

  for (const command of commands) {
    switch (command.type) {
      case 'ping':
      case 'load':
      case 'reset':
      case 'dispose':
        break
      case 'transcribe':
        if (whisperTranscribeTransferables(command).length !== 1) {
          throw new Error('runWhisperProtocolHarness: expected one transferable buffer')
        }
        if (resolveWhisperSampleRateHz(command.sampleRateHz) !== 16_000) {
          throw new Error('runWhisperProtocolHarness: sample rate resolution failed')
        }
        break
      default:
        assertNever(command)
    }
  }

  const events: WhisperWorkerEvent[] = [
    { type: 'progress', phase: 'download', loaded: 1, total: 10 },
    { type: 'partial', text: 'find the' },
    { type: 'segment', text: 'find the clause' },
    { type: 'error', message: 'load failed', code: 'UNKNOWN' },
  ]

  for (const event of events) {
    switch (event.type) {
      case 'progress':
      case 'partial':
      case 'segment':
      case 'error':
        break
      default:
        assertNever(event)
    }
  }

  const responseOk: WhisperWorkerResponse = { id: 'r1', ok: true, result: { text: 'hi' } }
  const responseErr: WhisperWorkerResponse = {
    id: 'r2',
    ok: false,
    error: 'fail',
    code: 'TRANSCRIBE_FAILED',
  }
  if (!responseOk.ok || responseErr.ok) {
    throw new Error('runWhisperProtocolHarness: response narrowing failed')
  }
}
