import { getProposalSetupState } from '@/lib/proposal-readiness'
import type { DocumentMeta } from '@/lib/types'
import { buildProposalRfpProfile } from '@/services/build-proposal-rfp-profile'
import { buildProposalVolumes } from '@/services/build-proposal-volumes'
import { ingestFile } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

const HARNESS_COMPANY_CONTEXT =
  'Harness roofing subcontractor with twenty years of experience.'

async function ingestSamplePdf(url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`proposal generation harness: failed to load ${url} (${response.status})`)
  }

  const blob = await response.blob()
  const file = new File([blob], filename, { type: 'application/pdf' })
  return ingestFile(file, { ocrEnabled: false })
}

/** Dev harness — gating, store mutex, per-volume draft bodies (BDA-118 / BDA-119 MVP) */
export async function runProposalGenerationHarness(): Promise<void> {
  let ingested
  try {
    ingested = await ingestSamplePdf('/sample/rfp-it-services.pdf', 'rfp-it-services.pdf')
  } catch {
    ingested = await ingestSamplePdf('/sample/minimal.pdf', 'minimal.pdf')
  }

  const document: DocumentMeta = {
    doc_id: ingested.doc_id,
    filename: ingested.filename,
    mime: ingested.mime,
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  }

  const profile = await buildProposalRfpProfile([document], {
    rfpDocId: document.doc_id,
    companyContext: HARNESS_COMPANY_CONTEXT,
  })

  if (!profile?.volumes.length) {
    throw new Error('proposal generation harness: need profile volumes for service loop test')
  }

  let profileUpdates = 0
  const generated = await buildProposalVolumes({
    documents: [document],
    profile,
    companyContext: HARNESS_COMPANY_CONTEXT,
    onProfileUpdate: () => {
      profileUpdates += 1
    },
  })

  const expectedUpdates = profile.volumes.length * 2
  if (profileUpdates !== expectedUpdates) {
    throw new Error(
      `proposal generation harness: expected ${expectedUpdates} onProfileUpdate calls, got ${profileUpdates}`,
    )
  }

  for (const volume of generated.volumes) {
    if (volume.status !== 'draft' && volume.status !== 'error') {
      throw new Error(`proposal generation harness: service loop left status ${volume.status}`)
    }
    if (volume.status === 'draft' && !volume.bodyMarkdown?.trim()) {
      throw new Error('proposal generation harness: draft volume missing bodyMarkdown')
    }
  }

  const store = useSessionStore.getState()
  store.resetSession()
  store.setMode('proposal')
  store.addDocument(document)
  store.setEvaluationDocId(document.doc_id)
  store.setCompanyContext(HARNESS_COMPANY_CONTEXT)

  await store.runGenerateProposalVolumes()
  if (useSessionStore.getState().proposalRequirementsProfile != null) {
    throw new Error('proposal generation harness: generate should no-op before profile build')
  }

  await store.runProposalRequirementsProfile()

  const afterProfile = useSessionStore.getState()
  if (!afterProfile.proposalRequirementsProfile?.volumes.length) {
    throw new Error('proposal generation harness: profile build did not populate volumes')
  }

  if (!getProposalSetupState(afterProfile).readyToGenerate) {
    throw new Error('proposal generation harness: expected readyToGenerate after profile build')
  }

  useSessionStore.setState({ proposalGenerating: true })
  await store.runGenerateProposalVolumes()
  const whileBusy = useSessionStore.getState()
  const blockedWhileBusy = whileBusy.proposalRequirementsProfile?.volumes.every(
    (volume) => volume.status === 'pending',
  )
  if (!blockedWhileBusy) {
    throw new Error('proposal generation harness: mutex should block generate while proposalGenerating')
  }
  useSessionStore.setState({ proposalGenerating: false })

  await store.runGenerateProposalVolumes()

  const afterGenerate = useSessionStore.getState()
  if (afterGenerate.proposalGenerating) {
    throw new Error('proposal generation harness: proposalGenerating should be false after run')
  }

  const volumes = afterGenerate.proposalRequirementsProfile?.volumes ?? []
  if (volumes.length === 0) {
    throw new Error('proposal generation harness: expected volumes after generate')
  }

  for (const volume of volumes) {
    if (volume.status !== 'draft' && volume.status !== 'error') {
      throw new Error(`proposal generation harness: unexpected volume status ${volume.status}`)
    }
    if (volume.status === 'draft' && !volume.bodyMarkdown?.trim()) {
      throw new Error('proposal generation harness: store draft volume missing bodyMarkdown')
    }
  }

  store.resetSession()
}
