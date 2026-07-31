/** Bonsai 1.7B model URLs — bitgpu v0.19.1 quickstart */
export const SCOPER_BITGPU_TAG = 'v0.19.1'

export const SCOPER_BONSAI_17B = {
  id: 'bonsai-1.7b' as const,
  label: 'Scoper 1.7 model',
  repoBase: `https://cdn.jsdelivr.net/gh/stfurkan/bitgpu@${SCOPER_BITGPU_TAG}/models/bonsai-1.7b-gguf`,
  tokenizerBase: 'https://huggingface.co/onnx-community/Bonsai-1.7B-ONNX/resolve/main',
  manifestUrl: `https://cdn.jsdelivr.net/gh/stfurkan/bitgpu@${SCOPER_BITGPU_TAG}/models/bonsai-1.7b-gguf/manifest.json`,
  auxUrl: `https://cdn.jsdelivr.net/gh/stfurkan/bitgpu@${SCOPER_BITGPU_TAG}/models/bonsai-1.7b-gguf/Bonsai-1.7B-Q1_0.aux.bin`,
  dataUrl:
    'https://huggingface.co/prism-ml/Bonsai-1.7B-gguf/resolve/main/Bonsai-1.7B-Q1_0.gguf',
  tokenizerJsonUrl:
    'https://huggingface.co/onnx-community/Bonsai-1.7B-ONNX/resolve/main/tokenizer.json',
  tokenizerConfigUrl:
    'https://huggingface.co/onnx-community/Bonsai-1.7B-ONNX/resolve/main/tokenizer_config.json',
}

export type ScoperMaxSeqLen = 4096 | 8192

export const SCOPER_MAX_SEQ_LEN_DEFAULT: ScoperMaxSeqLen = 8192
export const SCOPER_MAX_SEQ_LEN_FALLBACK: ScoperMaxSeqLen = 4096

const SCOPER_MAX_SEQ_LEN_ALLOWED = new Set<number>([4096, 8192])

/** Parsed `VITE_SCOPER_MAX_SEQ_LEN` (4096 | 8192); defaults to 8192. */
export function getScoperMaxSeqLenFromEnv(
  raw: string | undefined = import.meta.env.VITE_SCOPER_MAX_SEQ_LEN,
): ScoperMaxSeqLen {
  if (raw === undefined || raw === '') {
    return SCOPER_MAX_SEQ_LEN_DEFAULT
  }
  const parsed = Number.parseInt(String(raw).trim(), 10)
  if (!SCOPER_MAX_SEQ_LEN_ALLOWED.has(parsed)) {
    console.warn(
      `[scoper] Invalid VITE_SCOPER_MAX_SEQ_LEN="${raw}"; expected 4096 or 8192. Using ${SCOPER_MAX_SEQ_LEN_DEFAULT}.`,
    )
    return SCOPER_MAX_SEQ_LEN_DEFAULT
  }
  return parsed as ScoperMaxSeqLen
}

export function scoperMaxSeqLenFallbackNotice(fallbackFrom: ScoperMaxSeqLen): string {
  return `On-device model could not load a ${fallbackFrom / 1024}K context window; using ${SCOPER_MAX_SEQ_LEN_FALLBACK / 1024}K instead. Set VITE_SCOPER_MAX_SEQ_LEN=4096 to skip the 8K attempt.`
}

/** Default engine options for long chat / proposal sessions in the demo */
export function getScoperEngineOptions(maxSeqLen: ScoperMaxSeqLen = getScoperMaxSeqLenFromEnv()) {
  return {
    kvCache: 'q8' as const,
    overflow: 'sinks' as const,
    maxSeqLen,
    sinkTokens: 4,
  }
}

/** @deprecated Prefer `getScoperEngineOptions()` for explicit maxSeqLen */
export const SCOPER_ENGINE_DEFAULTS = {
  kvCache: 'q8' as const,
  overflow: 'sinks' as const,
  maxSeqLen: SCOPER_MAX_SEQ_LEN_DEFAULT,
  sinkTokens: 4,
}

export const SCOPER_SEND_DEFAULTS = {
  temperature: 0.7,
  topK: 20,
  maxTokens: 512,
}
