/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** On-device KV context window: 4096 or 8192 (default 8192). */
  readonly VITE_SCOPER_MAX_SEQ_LEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Development-only console helpers (see `src/lib/scoper-dev-tools.ts`). */
interface ScoperDevGlobals {
  getEcpAgentAuditLog: () => readonly import('@/ecp/agent-run').EcpAgentAuditEntry[]
  clearEcpAgentAuditLog: () => void
  printEcpAgentAuditLog: () => readonly import('@/ecp/agent-run').EcpAgentAuditEntry[]
  setPdfMarkDrawingMode: (enabled: boolean) => void
}

interface Window {
  Scoper?: ScoperDevGlobals
}
