import { applyPostIngestModeEffects } from '@/lib/post-ingest-mode-effects'
import {
  getProposalSetupState,
  PROPOSAL_CONTEXT_MIN_LENGTH,
} from '@/lib/proposal-readiness'
import { ingestFiles } from '@/services/ingest-router'
import { setDocumentRole } from '@/services/document-roles'
import {
  fetchSampleFile,
  SAMPLE_EVALUATION_MSA_FILENAME,
  SAMPLE_EVALUATION_MSA_URL,
} from '@/services/load-sample-documents'
import { useSessionStore } from '@/store/session-store'

export const SAMPLE_PROPOSAL_RUBRIC_URL = '/sample/files/buyer-rubric.md'
export const SAMPLE_PROPOSAL_RUBRIC_FILENAME = 'buyer-rubric.md'

/** Pre-filled responder context so proposal setup readiness passes hasContext (BDA-284). */
export const SAMPLE_PROPOSAL_COMPANY_CONTEXT =
  'Pro-Bel Enterprises Limited — fall protection and building envelope subcontractor serving GC partners on commercial projects.'

/**
 * Ingest solicitation PDF + buyer rubric markdown, switch to proposal mode, and open
 * profiles setup (BDA-284).
 */
export async function loadSampleProposalWorkspace(): Promise<void> {
  const store = useSessionStore.getState()
  store.setMode('proposal')

  const ocrEnabled = store.ocrEnabled
  const files = await Promise.all([
    fetchSampleFile(SAMPLE_EVALUATION_MSA_URL, SAMPLE_EVALUATION_MSA_FILENAME),
    fetchSampleFile(SAMPLE_PROPOSAL_RUBRIC_URL, SAMPLE_PROPOSAL_RUBRIC_FILENAME),
  ])

  const { results, errors } = await ingestFiles(files, { ocrEnabled })
  if (results.length === 0) {
    throw new Error(errors[0]?.error ?? 'Failed to ingest sample proposal workspace')
  }

  store.commitIngestResults(results)
  await applyPostIngestModeEffects(results)

  const rfpResult = results.find((result) => result.mime === 'application/pdf')
  const rubricResult = results.find((result) => result.mime === 'text/markdown')

  if (!rfpResult) {
    throw new Error('Sample proposal workspace: solicitation PDF was not ingested')
  }

  await setDocumentRole(rfpResult.doc_id, 'baseline')
  store.setEvaluationDocId(rfpResult.doc_id)

  if (rubricResult) {
    await setDocumentRole(rubricResult.doc_id, 'supporting')
  }

  store.setWorkspaceView('profiles')

  if (store.companyContext.trim().length < PROPOSAL_CONTEXT_MIN_LENGTH) {
    store.setCompanyContext(SAMPLE_PROPOSAL_COMPANY_CONTEXT)
  }
}

/** Dev harness — proposal sample loads with RFP + context; profile build is optional (BDA-284). */
export async function runLoadSampleProposalHarness(): Promise<void> {
  useSessionStore.getState().resetSession()

  await loadSampleProposalWorkspace()

  const after = useSessionStore.getState()
  const setup = getProposalSetupState({
    documents: after.documents,
    evaluationDocId: after.evaluationDocId,
    companyContext: after.companyContext,
    proposalRequirementsProfile: after.proposalRequirementsProfile,
  })

  if (after.mode !== 'proposal') {
    throw new Error('runLoadSampleProposalHarness: expected proposal mode')
  }
  if (after.workspaceView !== 'profiles') {
    throw new Error('runLoadSampleProposalHarness: expected profiles view')
  }
  if (after.documents.length < 2) {
    throw new Error('runLoadSampleProposalHarness: expected RFP + rubric documents')
  }
  if (!after.documents.some((doc) => doc.mime === 'application/pdf')) {
    throw new Error('runLoadSampleProposalHarness: missing solicitation PDF')
  }
  if (!after.documents.some((doc) => doc.mime === 'text/markdown')) {
    throw new Error('runLoadSampleProposalHarness: missing buyer rubric markdown')
  }
  if (!setup.hasRfp) {
    throw new Error('runLoadSampleProposalHarness: readiness hasRfp should be true')
  }
  if (!setup.hasContext) {
    throw new Error('runLoadSampleProposalHarness: readiness hasContext should be true')
  }
  if (setup.readyToGenerate) {
    throw new Error(
      'runLoadSampleProposalHarness: profile not built yet — readyToGenerate should be false',
    )
  }

  const rubric = after.documents.find((doc) => doc.mime === 'text/markdown')
  if (rubric?.role !== 'supporting') {
    throw new Error('runLoadSampleProposalHarness: rubric must be tagged supporting')
  }
}
