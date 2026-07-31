/**
 * On-device speech-to-text (Whisper via Transformers.js).
 * Weights download on first mic use (~40 MB quantized for tiny.en).
 * Import only from the whisper worker — not from the main bundle (BDA-181).
 */
export const WHISPER_ASR_MODEL_ID = 'Xenova/whisper-tiny.en' as const

export const WHISPER_ASR_SAMPLE_RATE_HZ = 16_000
