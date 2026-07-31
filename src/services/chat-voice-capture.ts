import { WHISPER_ASR_SAMPLE_RATE_HZ } from '@/lib/whisper-model'

export type ChatVoiceCaptureErrorCode =
  | 'permission_denied'
  | 'not_supported'
  | 'already_active'
  | 'not_active'

export type ChatVoiceCaptureStartResult =
  | { ok: true }
  | { ok: false; code: ChatVoiceCaptureErrorCode; message: string }

export type ChatVoiceCaptureChunk = {
  pcm: Float32Array
  sampleRateHz: number
  index: number
}

export type StartChatVoiceCaptureOptions = {
  onChunk: (chunk: ChatVoiceCaptureChunk) => void
  onError?: (error: Error) => void
  /** Seconds of 16 kHz PCM per emitted chunk (default 1.5). */
  chunkDurationSec?: number
  /** Overlap retained between chunks for streaming ASR (default 0.25 s). */
  overlapDurationSec?: number
}

const DEFAULT_CHUNK_DURATION_SEC = 1.5
const DEFAULT_OVERLAP_DURATION_SEC = 0.25

/** Linear resample mono PCM to Whisper's 16 kHz rate (BDA-185). */
export function resampleMonoPcmToWhisperRate(
  input: Float32Array,
  inputSampleRateHz: number,
  targetSampleRateHz: number = WHISPER_ASR_SAMPLE_RATE_HZ,
): Float32Array {
  if (input.length === 0) return new Float32Array(0)
  if (inputSampleRateHz === targetSampleRateHz) {
    return input.slice()
  }

  const ratio = inputSampleRateHz / targetSampleRateHz
  const outLength = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(outLength)

  for (let i = 0; i < outLength; i += 1) {
    const srcIndex = i * ratio
    const i0 = Math.floor(srcIndex)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const t = srcIndex - i0
    output[i] = input[i0]! * (1 - t) + input[i1]! * t
  }

  return output
}

function mixToMono(inputBuffer: AudioBuffer): Float32Array {
  const length = inputBuffer.length
  const mono = new Float32Array(length)
  const channels = inputBuffer.numberOfChannels

  if (channels === 1) {
    inputBuffer.copyFromChannel(mono, 0)
    return mono
  }

  for (let channel = 0; channel < channels; channel += 1) {
    const channelData = new Float32Array(length)
    inputBuffer.copyFromChannel(channelData, channel)
    for (let i = 0; i < length; i += 1) {
      mono[i]! += channelData[i]! / channels
    }
  }

  return mono
}

function permissionMessage(error: unknown): ChatVoiceCaptureStartResult {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      ok: false,
      code: 'permission_denied',
      message: 'Microphone access was denied. Allow the mic in browser settings and try again.',
    }
  }
  if (name === 'NotFoundError') {
    return {
      ok: false,
      code: 'not_supported',
      message: 'No microphone was found on this device.',
    }
  }
  const message = error instanceof Error ? error.message : 'Could not access the microphone.'
  return { ok: false, code: 'not_supported', message }
}

class ChatVoiceCaptureSession {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private pcmBuffer: Float32Array = new Float32Array(0)
  private chunkIndex = 0
  private chunkSampleCount = 0
  private overlapSampleCount = 0

  constructor(private readonly options: StartChatVoiceCaptureOptions) {
    const chunkDurationSec = options.chunkDurationSec ?? DEFAULT_CHUNK_DURATION_SEC
    const overlapDurationSec = options.overlapDurationSec ?? DEFAULT_OVERLAP_DURATION_SEC
    this.chunkSampleCount = Math.max(
      1,
      Math.floor(chunkDurationSec * WHISPER_ASR_SAMPLE_RATE_HZ),
    )
    this.overlapSampleCount = Math.min(
      this.chunkSampleCount - 1,
      Math.floor(overlapDurationSec * WHISPER_ASR_SAMPLE_RATE_HZ),
    )
  }

  async start(): Promise<ChatVoiceCaptureStartResult> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return {
        ok: false,
        code: 'not_supported',
        message: 'Microphone capture is not supported in this environment.',
      }
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })

      this.audioContext = new AudioContext()
      await this.audioContext.resume()

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      const silentGain = this.audioContext.createGain()
      silentGain.gain.value = 0

      this.processor.onaudioprocess = (event) => {
        try {
          this.handleAudioProcess(event.inputBuffer)
        } catch (error) {
          this.options.onError?.(
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      }

      this.source.connect(this.processor)
      this.processor.connect(silentGain)
      silentGain.connect(this.audioContext.destination)

      return { ok: true }
    } catch (error) {
      this.cleanupInternal()
      return permissionMessage(error)
    }
  }

  private handleAudioProcess(inputBuffer: AudioBuffer) {
    if (!this.audioContext) return

    const mono = mixToMono(inputBuffer)
    const resampled = resampleMonoPcmToWhisperRate(mono, this.audioContext.sampleRate)
    if (resampled.length === 0) return

    this.pcmBuffer = concatFloat32(this.pcmBuffer, resampled)

    while (this.pcmBuffer.length >= this.chunkSampleCount) {
      const chunk = this.pcmBuffer.slice(0, this.chunkSampleCount)
      this.options.onChunk({
        pcm: chunk,
        sampleRateHz: WHISPER_ASR_SAMPLE_RATE_HZ,
        index: this.chunkIndex,
      })
      this.chunkIndex += 1

      if (this.overlapSampleCount > 0) {
        this.pcmBuffer = this.pcmBuffer.slice(
          this.chunkSampleCount - this.overlapSampleCount,
        )
      } else {
        this.pcmBuffer = this.pcmBuffer.slice(this.chunkSampleCount)
      }
    }
  }

  stop(): void {
    this.cleanupInternal()
  }

  private cleanupInternal(): void {
    this.processor?.disconnect()
    this.source?.disconnect()
    this.processor = null
    this.source = null

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop()
      }
      this.mediaStream = null
    }

    if (this.audioContext) {
      void this.audioContext.close()
      this.audioContext = null
    }

    this.pcmBuffer = new Float32Array(0)
    this.chunkIndex = 0
  }
}

function concatFloat32(left: Float32Array, right: Float32Array): Float32Array {
  if (left.length === 0) return right.slice()
  if (right.length === 0) return left.slice()
  const merged = new Float32Array(left.length + right.length)
  merged.set(left, 0)
  merged.set(right, left.length)
  return merged
}

let activeSession: ChatVoiceCaptureSession | null = null

export function isChatVoiceCaptureActive(): boolean {
  return activeSession != null
}

export async function startChatVoiceCapture(
  options: StartChatVoiceCaptureOptions,
): Promise<ChatVoiceCaptureStartResult> {
  if (activeSession) {
    return {
      ok: false,
      code: 'already_active',
      message: 'Voice capture is already running.',
    }
  }

  const session = new ChatVoiceCaptureSession(options)
  const result = await session.start()
  if (result.ok) {
    activeSession = session
  }
  return result
}

export function stopChatVoiceCapture(): void {
  activeSession?.stop()
  activeSession = null
}

/** Dev harness — resample math + lifecycle guards (BDA-185). */
export function runChatVoiceCaptureHarness(): void {
  const inputRate = 48_000
  const input = new Float32Array(inputRate)
  for (let i = 0; i < input.length; i += 1) {
    input[i] = Math.sin((2 * Math.PI * 440 * i) / inputRate)
  }

  const resampled = resampleMonoPcmToWhisperRate(input, inputRate)
  const expectedLength = Math.floor(input.length / (inputRate / WHISPER_ASR_SAMPLE_RATE_HZ))
  if (Math.abs(resampled.length - expectedLength) > 1) {
    throw new Error(
      `runChatVoiceCaptureHarness: resample length expected ~${expectedLength}, got ${resampled.length}`,
    )
  }

  if (isChatVoiceCaptureActive()) {
    throw new Error('runChatVoiceCaptureHarness: harness expected inactive session')
  }

  stopChatVoiceCapture()

  const empty = resampleMonoPcmToWhisperRate(new Float32Array(0), 48_000)
  if (empty.length !== 0) {
    throw new Error('runChatVoiceCaptureHarness: empty input should yield empty output')
  }
}
