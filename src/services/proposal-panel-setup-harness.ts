import { PROPOSAL_CONTEXT_MIN_LENGTH } from '@/lib/proposal-readiness'
import type { DocumentMeta } from '@/lib/types'
import { selectProposalSetupState, useSessionStore } from '@/store/session-store'

/** Dev harness — setup fields drive readiness flags (BDA-130) */
export function runProposalPanelSetupHarness(): void {
  const store = useSessionStore.getState()
  store.resetSession()

  let setup = selectProposalSetupState(useSessionStore.getState())
  if (setup.hasRfp || setup.hasContext || setup.hasProfile) {
    throw new Error('runProposalPanelSetupHarness: empty session should not be ready')
  }

  const rfpDoc: DocumentMeta = {
    doc_id: 'panel-setup-rfp',
    filename: 'Panel-RFP.pdf',
    mime: 'application/pdf',
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  }

  store.addDocument(rfpDoc)
  store.setEvaluationDocId(rfpDoc.doc_id)

  setup = selectProposalSetupState(useSessionStore.getState())
  if (!setup.hasRfp || setup.hasContext || setup.readyToGenerate) {
    throw new Error('runProposalPanelSetupHarness: RFP selection should set hasRfp only')
  }

  store.setCompanyContext('A'.repeat(PROPOSAL_CONTEXT_MIN_LENGTH))

  setup = selectProposalSetupState(useSessionStore.getState())
  if (!setup.hasRfp || !setup.hasContext || setup.hasProfile || setup.readyToGenerate) {
    throw new Error('runProposalPanelSetupHarness: context should set hasContext without profile')
  }

  store.resetSession()
}
