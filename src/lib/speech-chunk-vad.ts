/** RMS level for mono PCM in [-1, 1]. */
export function computeMonoPcmRms(pcm: Float32Array): number {
  if (pcm.length === 0) return 0
  let sumSquares = 0
  for (let i = 0; i < pcm.length; i += 1) {
    const sample = pcm[i]!
    sumSquares += sample * sample
  }
  return Math.sqrt(sumSquares / pcm.length)
}

/** Skip transcribe when room/mic level is near silence (reduces Whisper hallucinations). */
export const DEFAULT_SILENCE_RMS_THRESHOLD = 0.012

export function isSilentSpeechChunk(
  pcm: Float32Array,
  threshold = DEFAULT_SILENCE_RMS_THRESHOLD,
): boolean {
  return computeMonoPcmRms(pcm) < threshold
}

const WHISPER_NOISE_WORDS = new Set([
  'you',
  'okay',
  'ok',
  'the',
  'a',
  'for',
  'her',
  'him',
  'it',
  'thank',
  'thanks',
  'bye',
  'so',
  'and',
  'um',
  'uh',
])

/**
 * Whisper tiny often emits short phantom phrases on silent chunks ("you", "okay", "for her").
 * Treat segments composed only of these tokens as non-speech.
 */
export function isWhisperNoiseTranscript(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:—–-]+/g, ' ')
  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  return words.every((word) => WHISPER_NOISE_WORDS.has(word))
}

/** Dev harness — silence gate + noise transcript filter. */
export function runSpeechChunkVadHarness(): void {
  const silent = new Float32Array(16_000)
  if (!isSilentSpeechChunk(silent)) {
    throw new Error('runSpeechChunkVadHarness: zero PCM should be silent')
  }

  const loud = new Float32Array(16_000)
  for (let i = 0; i < loud.length; i += 1) {
    loud[i] = 0.2 * Math.sin((2 * Math.PI * 440 * i) / 16_000)
  }
  if (isSilentSpeechChunk(loud)) {
    throw new Error('runSpeechChunkVadHarness: tone PCM should not be silent')
  }

  if (!isWhisperNoiseTranscript('you for her. you Okay. you')) {
    throw new Error('runSpeechChunkVadHarness: expected noise phrase filter')
  }
  if (isWhisperNoiseTranscript('Well, I asked you how you were.')) {
    throw new Error('runSpeechChunkVadHarness: real sentence should not be noise')
  }
}
