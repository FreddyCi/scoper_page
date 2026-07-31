import { useSessionStore } from '@/store/session-store'

/** Dev harness — session store activity slice (BDA-170) */
export function runAgentActivityStoreHarness(): void {
  const store = useSessionStore.getState()
  store.resetSession()

  const initial = useSessionStore.getState()
  if (initial.agentActivityLog.length !== 0 || initial.contextPhase !== 'idle') {
    throw new Error('runAgentActivityStoreHarness: session should start cleared')
  }

  store.pushAgentActivity({
    kind: 'ecp',
    label: 'find_clause',
    detail: 'Section L methodology',
  })
  store.setContextPhase('find_clause')
  store.setContextUsageSnapshot({
    percentFull: 42.5,
    totalTokens: 3480,
    totalChars: 13920,
    contextSize: 8192,
    tier: 'none',
    segments: [],
  })

  const afterPush = useSessionStore.getState()
  if (afterPush.agentActivityLog.length !== 1) {
    throw new Error('runAgentActivityStoreHarness: expected one log entry')
  }
  if (afterPush.contextPhase !== 'find_clause') {
    throw new Error('runAgentActivityStoreHarness: context phase not updated')
  }
  if (afterPush.contextUsageSnapshot?.totalTokens !== 3480) {
    throw new Error('runAgentActivityStoreHarness: usage snapshot not stored')
  }

  store.clearAgentActivity()
  const afterClear = useSessionStore.getState()
  if (afterClear.agentActivityLog.length !== 0 || afterClear.contextUsageSnapshot != null) {
    throw new Error('runAgentActivityStoreHarness: clearAgentActivity failed')
  }
  if (afterClear.contextPhase !== 'idle') {
    throw new Error('runAgentActivityStoreHarness: phase should reset to idle')
  }

  store.pushAgentActivity({ kind: 'status', label: 'Before new chat' })
  store.startNewChat()
  if (useSessionStore.getState().agentActivityLog.length !== 0) {
    throw new Error('runAgentActivityStoreHarness: startNewChat should clear activity log')
  }

  store.resetSession()
}
