import type { ProposalRequirementsProfile } from '@/lib/types'
import { useSessionStore } from '@/store/session-store'

const HARNESS_PROFILE: ProposalRequirementsProfile = {
  profile_id: 'prof-store-h',
  rfp_doc_id: 'rfp-1',
  summary: 'Harness proposal profile.',
  built_at: new Date().toISOString(),
  packageKind: 'solicitation',
  packageWarnings: [],
  volumes: [
    {
      id: 'vol-1',
      title: 'Technical approach',
      requirementSummary: 'Address Section L methodology.',
      status: 'pending',
    },
  ],
}

/** Store preflight gates for proposal generate (BDA-165). */
export async function runProposalStoreGeneratePreflightHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()

  useSessionStore.setState({
    mode: 'proposal',
    evaluationDocId: 'rfp-1',
    documents: [
      {
        doc_id: 'rfp-1',
        filename: 'RFP.pdf',
        mime: 'application/pdf',
        role: 'unknown',
        uploaded_at: new Date().toISOString(),
      },
    ],
    companyContext: 'TBD — company info pending review soon.',
    proposalRequirementsProfile: HARNESS_PROFILE,
    proposalHandoffState: {
      activeGoal: 'stale',
      completedSections: [],
      topicMemory: [],
      pendingSections: [],
      packageKind: 'solicitation',
      doNotRepeat: [],
    },
  })

  await useSessionStore.getState().runGenerateProposalVolumes()

  const blocked = useSessionStore.getState()
  if (blocked.proposalGenerating) {
    throw new Error('runProposalStoreGeneratePreflightHarness: context gate should not set proposalGenerating')
  }
  if (!blocked.proposalGenerationError?.includes('TBD')) {
    throw new Error('runProposalStoreGeneratePreflightHarness: expected context quality error')
  }
  if (blocked.proposalHandoffState != null) {
    throw new Error('runProposalStoreGeneratePreflightHarness: handoff should clear when generate is blocked')
  }

  useSessionStore.setState({
    companyContext:
      'Acme Systems is a CMMI Level 3 integrator specializing in cloud migration since 2004.',
    proposalGenerationError: null,
    chatGenerating: true,
    chatMessages: [
      {
        id: 'user-1',
        role: 'user',
        text: 'Harness chat should stay untouched.',
        created_at: new Date().toISOString(),
      },
    ],
  })

  await useSessionStore.getState().runGenerateProposalVolumes()

  const chatBusy = useSessionStore.getState()
  if (chatBusy.proposalGenerating) {
    throw new Error('runProposalStoreGeneratePreflightHarness: chatGenerating should block generate')
  }
  if (chatBusy.chatMessages.length !== 1 || chatBusy.chatMessages[0]?.text !== 'Harness chat should stay untouched.') {
    throw new Error('runProposalStoreGeneratePreflightHarness: chat thread mutated while blocked')
  }

  useSessionStore.getState().resetSession()
}

/** Store gates for single-volume generate (BDA-199). */
export async function runProposalStoreGenerateSingleVolumeHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()

  useSessionStore.setState({
    mode: 'proposal',
    evaluationDocId: 'rfp-1',
    documents: [
      {
        doc_id: 'rfp-1',
        filename: 'RFP.pdf',
        mime: 'application/pdf',
        role: 'unknown',
        uploaded_at: new Date().toISOString(),
      },
    ],
    companyContext:
      'Acme Systems is a CMMI Level 3 integrator specializing in cloud migration since 2004.',
    proposalRequirementsProfile: HARNESS_PROFILE,
  })

  await useSessionStore.getState().runGenerateProposalVolume('vol-missing')

  const unknownVol = useSessionStore.getState()
  if (unknownVol.proposalGenerating) {
    throw new Error(
      'runProposalStoreGenerateSingleVolumeHarness: unknown volume should not set proposalGenerating',
    )
  }
  if (!unknownVol.proposalGenerationError?.includes('Unknown proposal volume')) {
    throw new Error(
      'runProposalStoreGenerateSingleVolumeHarness: expected unknown volume error',
    )
  }

  useSessionStore.setState({ chatGenerating: true, proposalGenerationError: null })

  await useSessionStore.getState().runGenerateProposalVolume('vol-1')

  const chatBusy = useSessionStore.getState()
  if (chatBusy.proposalGenerating) {
    throw new Error(
      'runProposalStoreGenerateSingleVolumeHarness: chatGenerating should block single-volume generate',
    )
  }

  useSessionStore.getState().resetSession()
}
