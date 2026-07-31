import { useSessionStore } from '@/store/session-store'
import {
  resolveAgentActivityTranscriptEntries,
  shouldShowAgentActivityStrip,
} from '@/lib/agent-activity'

/** Dev harness — transcript visibility rules (BDA-173) */
export function runAgentActivityMarkersHarness(): void {
  const store = useSessionStore.getState()
  store.resetSession()

  if (
    shouldShowAgentActivityStrip({
      chatGenerating: false,
      proposalGenerating: true,
      contextPhase: 'generating',
    })
  ) {
    // proposalGenerating alone shows strip via task spec
  } else {
    throw new Error('runAgentActivityMarkersHarness: proposalGenerating should show strip')
  }

  store.pushAgentActivity({
    kind: 'ecp',
    label: 'find_clause',
    detail: 'Section L',
  })
  store.setContextPhase('find_clause')

  const entries = resolveAgentActivityTranscriptEntries(
    useSessionStore.getState().agentActivityLog,
    {
      chatGenerating: false,
      proposalGenerating: true,
      contextPhase: 'find_clause',
    },
  )
  if (entries.length !== 1 || entries[0]?.kind !== 'ecp') {
    throw new Error('runAgentActivityMarkersHarness: expected logged ecp entry')
  }

  store.resetSession()
}
