import {
  clearEcpAgentAuditLog,
  getEcpAgentAuditLog,
  type EcpAgentAuditEntry,
} from '@/ecp/agent-run'
import { useSessionStore } from '@/store/session-store'

export type ScoperDevGlobals = {
  /** ECP agent tool allow/deny entries (append-only; newest last). */
  getEcpAgentAuditLog: () => readonly EcpAgentAuditEntry[]
  clearEcpAgentAuditLog: () => void
  /** Pretty-print the audit log in DevTools (returns the same array). */
  printEcpAgentAuditLog: () => readonly EcpAgentAuditEntry[]
  /** Toggle PDF mark-drawing mode until toolbar ships (BDA-225). */
  setPdfMarkDrawingMode: (enabled: boolean) => void
}

let devGlobalsAnnounced = false

/** Expose `window.Scoper` helpers in development (no-op in production builds). */
export function exposeScoperDevGlobals(): void {
  if (!import.meta.env.DEV) return
  if (typeof window === 'undefined') return

  const api: ScoperDevGlobals = {
    getEcpAgentAuditLog,
    clearEcpAgentAuditLog,
    printEcpAgentAuditLog() {
      const entries = getEcpAgentAuditLog()
      if (entries.length === 0) {
        console.info('[Scoper] ECP agent audit log is empty')
      } else {
        console.table(entries)
      }
      return entries
    },
    setPdfMarkDrawingMode(enabled: boolean) {
      useSessionStore.getState().setPdfMarkDrawingMode(enabled)
    },
  }

  window.Scoper = { ...window.Scoper, ...api }

  if (!devGlobalsAnnounced) {
    devGlobalsAnnounced = true
    console.debug(
      '[Scoper dev] ECP audit: Scoper.getEcpAgentAuditLog() · Scoper.printEcpAgentAuditLog() · Scoper.clearEcpAgentAuditLog() · Scoper.setPdfMarkDrawingMode(true|false)',
    )
  }
}

/** Dev harness — window.Scoper ECP audit helpers mounted (development only). */
export function runScoperDevToolsHarness(): void {
  exposeScoperDevGlobals()
  if (typeof window === 'undefined') return
  if (!window.Scoper?.getEcpAgentAuditLog || !window.Scoper.printEcpAgentAuditLog) {
    throw new Error('runScoperDevToolsHarness: window.Scoper ECP audit API missing')
  }
}
