/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** On-device KV context window: 4096 or 8192 (default 8192). */
  readonly VITE_SCOPER_MAX_SEQ_LEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
