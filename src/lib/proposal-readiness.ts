import type { DocumentMeta, ProposalRequirementsProfile } from '@/lib/types'

/** Minimum trimmed responder context length before proposal profile build / generate. */
export const PROPOSAL_CONTEXT_MIN_LENGTH = 20

export type ProposalSetupSlice = {
  documents: DocumentMeta[]
  evaluationDocId: string | null
  companyContext: string
  proposalRequirementsProfile: ProposalRequirementsProfile | null
}

export type ProposalSetupState = {
  hasRfp: boolean
  hasContext: boolean
  hasProfile: boolean
  readyToGenerate: boolean
}

export function getProposalSetupState(slice: ProposalSetupSlice): ProposalSetupState {
  const hasRfp =
    slice.evaluationDocId != null &&
    slice.documents.some((doc) => doc.doc_id === slice.evaluationDocId)

  const hasContext = slice.companyContext.trim().length >= PROPOSAL_CONTEXT_MIN_LENGTH

  const hasProfile =
    slice.proposalRequirementsProfile != null &&
    slice.proposalRequirementsProfile.volumes.length > 0

  return {
    hasRfp,
    hasContext,
    hasProfile,
    readyToGenerate: hasRfp && hasContext && hasProfile,
  }
}

/** Dev harness — gating flags for proposal setup (BDA-112) */
export function runProposalReadinessHarness(): void {
  const empty = getProposalSetupState({
    documents: [],
    evaluationDocId: null,
    companyContext: '',
    proposalRequirementsProfile: null,
  })

  if (empty.hasRfp || empty.hasContext || empty.hasProfile || empty.readyToGenerate) {
    throw new Error('runProposalReadinessHarness: empty slice should not be ready')
  }

  const partial = getProposalSetupState({
    documents: [
      {
        doc_id: 'rfp-1',
        filename: 'RFP.pdf',
        mime: 'application/pdf',
        role: 'unknown',
        uploaded_at: new Date().toISOString(),
      },
    ],
    evaluationDocId: 'rfp-1',
    companyContext: 'We are a certified roofing subcontractor with 20 years experience.',
    proposalRequirementsProfile: null,
  })

  if (!partial.hasRfp || !partial.hasContext || partial.hasProfile || partial.readyToGenerate) {
    throw new Error('runProposalReadinessHarness: partial slice mismatch')
  }

  const profile: ProposalRequirementsProfile = {
    profile_id: 'prof-1',
    rfp_doc_id: 'rfp-1',
    summary: 'Three volumes extracted from Section L/M.',
    built_at: new Date().toISOString(),
    volumes: [
      {
        id: 'vol-1',
        title: 'Technical approach',
        requirementSummary: 'Describe installation methodology.',
        status: 'pending',
      },
    ],
  }

  const ready = getProposalSetupState({
    documents: [
      {
        doc_id: 'rfp-1',
        filename: 'RFP.pdf',
        mime: 'application/pdf',
        role: 'unknown',
        uploaded_at: new Date().toISOString(),
      },
    ],
    evaluationDocId: 'rfp-1',
    companyContext: 'We are a certified roofing subcontractor with 20 years experience.',
    proposalRequirementsProfile: profile,
  })

  if (!ready.hasRfp || !ready.hasContext || !ready.hasProfile || !ready.readyToGenerate) {
    throw new Error('runProposalReadinessHarness: ready slice should allow generate')
  }

  const staleDocId = getProposalSetupState({
    documents: [],
    evaluationDocId: 'missing-doc',
    companyContext: 'x'.repeat(PROPOSAL_CONTEXT_MIN_LENGTH),
    proposalRequirementsProfile: profile,
  })

  if (staleDocId.hasRfp || staleDocId.readyToGenerate) {
    throw new Error('runProposalReadinessHarness: evaluationDocId must match a session document')
  }
}
