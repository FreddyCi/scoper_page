import type { DocumentMeta } from '@/lib/types'
import {
  buildProposalRfpProfile,
  PROPOSAL_SUMMARY_MAX,
} from '@/services/build-proposal-rfp-profile'
import { ingestFile } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

async function ingestSamplePdf(url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`proposal RFP profile harness: failed to load ${url} (${response.status})`)
  }

  const blob = await response.blob()
  const file = new File([blob], filename, { type: 'application/pdf' })
  return ingestFile(file, { ocrEnabled: false })
}

function documentFromIngest(ingested: Awaited<ReturnType<typeof ingestFile>>): DocumentMeta {
  return {
    doc_id: ingested.doc_id,
    filename: ingested.filename,
    mime: ingested.mime,
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  }
}

const HARNESS_COMPANY_CONTEXT =
  'Harness responder with twenty years of experience in IT services.'

/**
 * Dev harness — service build + session store `runProposalRequirementsProfile` (BDA-117).
 */
export async function runProposalRfpProfileHarness(): Promise<void> {
  let ingested
  try {
    ingested = await ingestSamplePdf('/sample/rfp-it-services.pdf', 'rfp-it-services.pdf')
  } catch {
    ingested = await ingestSamplePdf('/sample/minimal.pdf', 'minimal.pdf')
  }

  const document = documentFromIngest(ingested)

  const profile = await buildProposalRfpProfile([document], {
    rfpDocId: document.doc_id,
    companyContext: HARNESS_COMPANY_CONTEXT,
  })

  if (!profile || profile.volumes.length === 0) {
    throw new Error('proposal RFP profile harness: expected at least one volume')
  }

  if (profile.rfp_doc_id !== document.doc_id) {
    throw new Error('proposal RFP profile harness: rfp_doc_id mismatch')
  }

  if (profile.summary.length > PROPOSAL_SUMMARY_MAX) {
    throw new Error('proposal RFP profile harness: summary exceeds max length')
  }

  for (const volume of profile.volumes) {
    if (!volume.title.trim()) {
      throw new Error('proposal RFP profile harness: volume title must be non-empty')
    }
    if (volume.status !== 'pending') {
      throw new Error('proposal RFP profile harness: new volumes should be pending')
    }
  }

  const missingDoc = await buildProposalRfpProfile([document], {
    rfpDocId: 'missing-doc-id',
  })
  if (missingDoc != null) {
    throw new Error('proposal RFP profile harness: unknown rfpDocId should return null')
  }

  const store = useSessionStore.getState()
  store.resetSession()
  store.setMode('proposal')

  if (useSessionStore.getState().mode !== 'proposal') {
    throw new Error('proposal RFP profile harness: setMode(proposal) failed')
  }

  store.addDocument(document)
  store.setEvaluationDocId(document.doc_id)
  store.setCompanyContext(HARNESS_COMPANY_CONTEXT)

  await store.runProposalRequirementsProfile()

  const afterStore = useSessionStore.getState()
  const storedProfile = afterStore.proposalRequirementsProfile

  if (!storedProfile || storedProfile.volumes.length === 0) {
    throw new Error('proposal RFP profile harness: store profile missing volumes after build')
  }

  if (storedProfile.rfp_doc_id !== document.doc_id) {
    throw new Error('proposal RFP profile harness: store rfp_doc_id mismatch')
  }

  if (afterStore.workspaceView !== 'profiles') {
    throw new Error('proposal RFP profile harness: expected workspaceView profiles after build')
  }

  if (afterStore.proposalGenerationError) {
    throw new Error(
      `proposal RFP profile harness: unexpected store error: ${afterStore.proposalGenerationError}`,
    )
  }

  store.resetSession()
}
