import { mimeFromFilename } from '@/lib/upload-accept'
import { ingestFiles } from '@/services/ingest-router'
import { setDocumentRole } from '@/services/document-roles'
import { useSessionStore } from '@/store/session-store'

/** Legacy IT-services demo — kept for “Load demo response” on empty qualification grid. */
export const SAMPLE_BIDDER_RESPONSE_URL = '/sample/demo-bidder-response.pdf'
export const SAMPLE_BIDDER_RESPONSE_FILENAME = 'demo-bidder-response.pdf'

/** Construction MSA + keyword checklist — Scout evaluate journey (BDA-283). */
export const SAMPLE_EVALUATION_MSA_URL = '/sample/dpr-msa-pro-bel-2025.pdf'
export const SAMPLE_EVALUATION_MSA_FILENAME =
  'DPR CONSTRUCTION - Fully Executed MSA - Pro-Bel Enterprises - 2025.pdf'

export const SAMPLE_CONTRACT_CHECKLIST_URL = '/sample/contract-keyword-check.docx'
export const SAMPLE_CONTRACT_CHECKLIST_FILENAME = 'Contract Key Word Check.docx'

/** Plan drawing for mark/takeoff journey (BDA-285). */
export const SAMPLE_WINDOWS_DRAWING_URL = '/sample/windows-drawing.pdf'
export const SAMPLE_WINDOWS_DRAWING_FILENAME = 'Windows_Drawing-scoper-export.pdf'

/** Fetch a bundled sample from `/public/sample/` as a browser File. */
export async function fetchSampleFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Sample file could not be loaded: ${filename}`)
  }

  const blob = await response.blob()
  return new File([blob], filename, {
    type: blob.type && blob.type !== 'application/octet-stream'
      ? blob.type
      : mimeFromFilename(filename),
  })
}

/** Fetch and ingest the bundled demo bidder PDF (triggers qualification when baseline is set). */
export async function loadSampleBidderResponse(): Promise<void> {
  const file = await fetchSampleFile(SAMPLE_BIDDER_RESPONSE_URL, SAMPLE_BIDDER_RESPONSE_FILENAME)
  const ocrEnabled = useSessionStore.getState().ocrEnabled
  const { results, errors } = await ingestFiles([file], { ocrEnabled })

  if (results.length === 0) {
    throw new Error(errors[0]?.error ?? 'Failed to ingest demo bidder response')
  }

  useSessionStore.getState().commitIngestResults(results)

  const { mode, evaluationDocId } = useSessionStore.getState()
  if (mode === 'rfp' && evaluationDocId) {
    await useSessionStore.getState().runRfpQualification()
  }
}

/**
 * Ingest the DPR MSA + contract keyword checklist, set evaluation baseline, and run
 * compliance matrix + keyword review (BDA-283).
 */
export async function loadSampleEvaluationWorkspace(): Promise<void> {
  const store = useSessionStore.getState()
  store.setMode('rfp')

  const ocrEnabled = store.ocrEnabled
  const files = await Promise.all([
    fetchSampleFile(SAMPLE_EVALUATION_MSA_URL, SAMPLE_EVALUATION_MSA_FILENAME),
    fetchSampleFile(SAMPLE_CONTRACT_CHECKLIST_URL, SAMPLE_CONTRACT_CHECKLIST_FILENAME),
  ])

  const { results, errors } = await ingestFiles(files, { ocrEnabled })
  if (results.length === 0) {
    throw new Error(errors[0]?.error ?? 'Failed to ingest sample evaluation workspace')
  }

  store.commitIngestResults(results)

  const msaResult = results.find((result) => result.mime === 'application/pdf')
  const checklistResult = results.find(
    (result) =>
      result.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )

  if (!msaResult) {
    throw new Error('Sample evaluation workspace: MSA PDF was not ingested')
  }

  await setDocumentRole(msaResult.doc_id, 'baseline')
  store.setEvaluationDocId(msaResult.doc_id)

  if (checklistResult) {
    await setDocumentRole(checklistResult.doc_id, 'supporting')
    store.setContractChecklistDocId(checklistResult.doc_id)
  }

  store.setWorkspaceView('profiles')

  await store.runRfpQualification()
  await store.runContractKeywordReview()
}

/** Dev harness — construction evaluation sample loads without throw (BDA-283). */
export async function runLoadSampleEvaluationHarness(): Promise<void> {
  useSessionStore.getState().resetSession()

  await loadSampleEvaluationWorkspace()

  const after = useSessionStore.getState()

  if (after.documents.length < 2) {
    throw new Error('runLoadSampleEvaluationHarness: expected at least 2 documents')
  }
  if (after.evaluationDocId == null) {
    throw new Error('runLoadSampleEvaluationHarness: evaluationDocId not set')
  }
  if (after.contractChecklistDocId == null) {
    throw new Error('runLoadSampleEvaluationHarness: contractChecklistDocId not set')
  }
  if (after.mode !== 'rfp') {
    throw new Error('runLoadSampleEvaluationHarness: expected rfp mode')
  }
  if (after.workspaceView !== 'profiles') {
    throw new Error('runLoadSampleEvaluationHarness: expected profiles view')
  }

  const baseline = after.documents.find((doc) => doc.doc_id === after.evaluationDocId)
  if (baseline?.role !== 'baseline') {
    throw new Error('runLoadSampleEvaluationHarness: MSA must be tagged baseline')
  }

  if (after.contractReviewProfile == null && after.profiles.length === 0) {
    console.warn(
      '[runLoadSampleEvaluationHarness] no profiles yet — WebGPU/LiteParse may be unavailable',
    )
  }
}
