import { getProposalPostIngestPatch, pickProposalEvaluationDocId } from '@/lib/proposal-post-ingest'
import type { IngestResult } from '@/lib/types'
import { setDocumentRole } from '@/services/document-roles'
import { useSessionStore } from '@/store/session-store'

/**
 * Mode-specific routing after ingest commits — shared by upload popup and command card (BDA-140 / BDA-141).
 */
export async function applyPostIngestModeEffects(results: IngestResult[]): Promise<void> {
  if (results.length === 0) return

  const store = useSessionStore.getState()
  const { mode } = store

  if (mode === 'rfp' && store.documents.length > 0) {
    if (store.evaluationDocId == null) {
      const docId = pickProposalEvaluationDocId(store.documents, results)
      if (docId) {
        store.setEvaluationDocId(docId)
        try {
          await setDocumentRole(docId, 'baseline')
        } catch (error) {
          console.error('[post-ingest] set baseline role failed', error)
        }
      }
    }

    if (useSessionStore.getState().evaluationDocId) {
      await store.runRfpQualification()
    }
  }

  if (mode === 'proposal') {
    const patch = getProposalPostIngestPatch(
      {
        evaluationDocId: store.evaluationDocId,
        documents: store.documents,
      },
      results,
    )
    if (patch.evaluationDocId != null) {
      store.setEvaluationDocId(patch.evaluationDocId)
    }
    store.setWorkspaceView(patch.workspaceView)
  }
}

/** Dev harness — command + popup paths share post-ingest effects (BDA-141) */
export async function runCommandIngestProposalLandingHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()
  store.setMode('proposal')
  store.setWorkspaceView('landing')

  const ingested: IngestResult = {
    doc_id: 'cmd-rfp',
    filename: 'Command-RFP.pdf',
    mime: 'application/pdf',
    block_count: 2,
    ocr_used: false,
  }

  store.commitIngestResults([ingested])
  await applyPostIngestModeEffects([ingested])

  const after = useSessionStore.getState()
  if (after.workspaceView !== 'profiles') {
    throw new Error('runCommandIngestProposalLandingHarness: expected profiles view')
  }
  if (after.evaluationDocId !== 'cmd-rfp') {
    throw new Error('runCommandIngestProposalLandingHarness: expected evaluationDocId from ingest batch')
  }
  if (after.mode !== 'proposal') {
    throw new Error('runCommandIngestProposalLandingHarness: mode must stay proposal')
  }
}
