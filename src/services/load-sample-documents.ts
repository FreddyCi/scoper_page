import { ingestFiles } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

export const SAMPLE_BIDDER_RESPONSE_URL = '/sample/demo-bidder-response.pdf'
export const SAMPLE_BIDDER_RESPONSE_FILENAME = 'demo-bidder-response.pdf'

/** Fetch and ingest the bundled demo bidder PDF (triggers qualification when baseline is set). */
export async function loadSampleBidderResponse(): Promise<void> {
  const response = await fetch(SAMPLE_BIDDER_RESPONSE_URL)
  if (!response.ok) {
    throw new Error('Demo bidder response could not be loaded')
  }

  const blob = await response.blob()
  const file = new File([blob], SAMPLE_BIDDER_RESPONSE_FILENAME, {
    type: blob.type || 'application/pdf',
  })

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
