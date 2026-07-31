import { useSessionStore } from '@/store/session-store'

let devBootstrapPromise: Promise<void> | null = null

/** Run the dev harness chain once per page load (Strict Mode safe). */
export function runDevBootstrapOnce(onBootstrap: () => Promise<void>): Promise<void> {
  if (!devBootstrapPromise) {
    devBootstrapPromise = (async () => {
      await onBootstrap()
      useSessionStore.getState().resetSession()
    })()
  }
  return devBootstrapPromise
}

/** Test-only reset so harness tests can re-run bootstrap. */
export function resetDevBootstrapForTests(): void {
  devBootstrapPromise = null
}
