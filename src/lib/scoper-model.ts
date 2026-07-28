/** Bonsai 1.7B model URLs — bitgpu v0.19.1 quickstart */
export const SCOPER_BITGPU_TAG = 'v0.19.1'

export const SCOPER_BONSAI_17B = {
  id: 'bonsai-1.7b' as const,
  label: 'Bonsai 1.7B',
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

/** Default engine options for long chat sessions in the demo */
export const SCOPER_ENGINE_DEFAULTS = {
  kvCache: 'q8' as const,
  overflow: 'sinks' as const,
  maxSeqLen: 4096,
  sinkTokens: 4,
}

export const SCOPER_SEND_DEFAULTS = {
  temperature: 0.7,
  topK: 20,
  maxTokens: 512,
}
