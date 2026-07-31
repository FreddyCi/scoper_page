import { listProposalVolumeHistory } from '@/lib/proposal-history'
import type { DocumentMeta } from '@/lib/types'
import { useSessionStore } from '@/store/session-store'

/** Dev harness — proposal volume markers in history tab (BDA-125) */
export function runChatHistoryMarkersHarness(): void {
  const store = useSessionStore.getState()
  store.resetSession()
  store.setMode('proposal')

  const rfpDoc: DocumentMeta = {
    doc_id: 'history-rfp',
    filename: 'City-RFP-2026.pdf',
    mime: 'application/pdf',
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  }

  store.setDocuments([rfpDoc])
  store.setEvaluationDocId(rfpDoc.doc_id)
  store.setProposalRequirementsProfile({
    profile_id: 'history-proposal',
    rfp_doc_id: rfpDoc.doc_id,
    summary: 'Two volumes for harness.',
    built_at: new Date().toISOString(),
    volumes: [
      {
        id: 'vol-tech',
        title: 'Technical approach',
        requirementSummary: 'Methodology and schedule.',
        status: 'draft',
        bodyMarkdown: '# Technical approach\n\nDraft body.',
      },
      {
        id: 'vol-mgmt',
        title: 'Management plan',
        requirementSummary: 'Staffing and QA.',
        status: 'pending',
      },
    ],
  })

  const entries = listProposalVolumeHistory(useSessionStore.getState().proposalRequirementsProfile)
  if (entries.length !== 2) {
    throw new Error('runChatHistoryMarkersHarness failed: expected two proposal volume entries')
  }

  const anchored = entries.find((entry) => entry.scrollAnchor)
  if (!anchored || anchored.id !== 'vol-mgmt') {
    throw new Error('runChatHistoryMarkersHarness failed: last volume should anchor scroll')
  }

  store.setWorkspaceView('profiles')
  if (useSessionStore.getState().workspaceView !== 'profiles') {
    throw new Error('runChatHistoryMarkersHarness failed: volume marker should open profiles view')
  }

  store.resetSession()
}
