import { buildMockCreepProfiles } from '@/lib/creep-profile-stub'
import { flattenCreepHistory } from '@/lib/creep-history'
import type { DocumentMeta } from '@/lib/types'
import { focusCitation } from '@/services/citation-bridge'
import { useSessionStore } from '@/store/session-store'

/** Dev harness — creep flags render as history markers; click focuses citation (BDA-073) */
export function runChatHistoryMarkersHarness(): void {
  const store = useSessionStore.getState()
  store.resetSession()
  store.setMode('proposal')

  const baseline: DocumentMeta = {
    doc_id: 'history-baseline',
    filename: 'Baseline-SOW.pdf',
    mime: 'application/pdf',
    role: 'baseline',
    uploaded_at: new Date().toISOString(),
  }

  const changeRequest: DocumentMeta = {
    doc_id: 'history-change',
    filename: 'Change-Addendum.pdf',
    mime: 'application/pdf',
    role: 'change_request',
    uploaded_at: new Date().toISOString(),
  }

  store.setDocuments([baseline, changeRequest])

  const profiles = buildMockCreepProfiles([baseline, changeRequest])
  if (profiles.length === 0) {
    throw new Error('runChatHistoryMarkersHarness failed: expected mock creep profiles')
  }

  store.setCreepProfiles(profiles)

  const entries = flattenCreepHistory(profiles, [baseline, changeRequest])
  const flagEntries = entries.filter((entry) => entry.kind === 'flag')

  if (flagEntries.length === 0) {
    throw new Error('runChatHistoryMarkersHarness failed: expected flag history entries')
  }

  const anchored = flagEntries.find((entry) => entry.scrollAnchor)
  if (!anchored || anchored.kind !== 'flag') {
    throw new Error('runChatHistoryMarkersHarness failed: expected scroll anchor on first flag')
  }

  focusCitation(anchored.citation)

  const afterFocus = useSessionStore.getState()
  if (afterFocus.workspaceView !== 'split') {
    throw new Error('runChatHistoryMarkersHarness failed: marker click should open split view')
  }
  if (afterFocus.activeDocId !== anchored.citation.doc_id) {
    throw new Error('runChatHistoryMarkersHarness failed: active doc should match marker citation')
  }
  if (afterFocus.selectedCitation?.block_id !== anchored.citation.block_id) {
    throw new Error('runChatHistoryMarkersHarness failed: selected citation should match marker')
  }

  store.resetSession()
}
