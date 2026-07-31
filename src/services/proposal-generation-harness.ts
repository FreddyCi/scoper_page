import { clearEcpAgentAuditLog, getEcpAgentAuditLog } from '@/ecp/agent-run'
import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import { ensureScoperEcpReadyBeforeAgentRun } from '@/ecp/environment'
import { getProposalSetupState } from '@/lib/proposal-readiness'
import type { DocumentMeta } from '@/lib/types'
import { buildProposalRfpProfile } from '@/services/build-proposal-rfp-profile'
import { buildProposalVolumes } from '@/services/build-proposal-volumes'
import { ingestFile } from '@/services/ingest-router'
import { getScoperClient } from '@/services/scoper-client'
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

async function logProposalHarnessRuntimeMode(): Promise<boolean> {
  const env = await getScoperClient().probeEnvironment()
  if (!env.webGpuAvailable) {
    console.warn(
      '[proposal-generation-harness] WebGPU unavailable — volume bodies may use find_clause summary or stub markdown',
    )
    return false
  }
  return true
}

function assertVolumeOutcomes(
  volumes: Array<{ status: string; bodyMarkdown?: string }>,
  label: string,
): void {
  for (const volume of volumes) {
    if (volume.status !== 'draft' && volume.status !== 'error') {
      throw new Error(`${label}: unexpected volume status ${volume.status}`)
    }
    if (volume.status === 'draft' && !volume.bodyMarkdown?.trim()) {
      throw new Error(`${label}: draft volume missing bodyMarkdown`)
    }
  }
}

/**
 * End-to-end proposal harness (BDA-119): ingest → profile → gated generate (ECP + Scoper/stub).
 */
export async function runProposalGenerationHarness(): Promise<void> {
  const webGpuAvailable = await logProposalHarnessRuntimeMode()

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

  clearEcpAgentAuditLog()
  await ensureScoperEcpReadyBeforeAgentRun()

  let profileUpdates = 0
  const generated = await buildProposalVolumes({
    documents: [document],
    profile,
    companyContext: HARNESS_COMPANY_CONTEXT,
    onProfileUpdate: () => {
      profileUpdates += 1
    },
  })

  const sectionCount = generated.volumes.reduce(
    (sum, volume) => sum + (volume.sections?.length ?? 1),
    0,
  )

  const minProfileUpdates = profile.volumes.length * 2
  if (profileUpdates < minProfileUpdates) {
    throw new Error(
      `proposal generation harness: expected at least ${minProfileUpdates} onProfileUpdate calls, got ${profileUpdates}`,
    )
  }

  assertVolumeOutcomes(generated.volumes, 'proposal generation harness: service loop')

  const findClauseAllows = getEcpAgentAuditLog().filter(
    (entry) =>
      entry.capabilityId === DOCUMENT_CAPABILITIES.find_clause && entry.decision === 'allow',
  )
  if (findClauseAllows.length < sectionCount) {
    throw new Error(
      `proposal generation harness: expected at least ${sectionCount} ECP find_clause allow entries, got ${findClauseAllows.length}`,
    )
  }

  const store = useSessionStore.getState()
  store.resetSession()
  store.setMode('proposal')
  store.addDocument(document)
  store.setEvaluationDocId(document.doc_id)
  store.setCompanyContext(HARNESS_COMPANY_CONTEXT)

  const beforeProfile = getProposalSetupState(useSessionStore.getState())
  if (beforeProfile.readyToGenerate || beforeProfile.hasProfile) {
    throw new Error(
      'proposal generation harness: readyToGenerate must be false before profile build',
    )
  }

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
  const blockedWhileBusy = useSessionStore.getState()
  if (blockedWhileBusy.proposalGenerating) {
    throw new Error('proposal generation harness: mutex should block generate while proposalGenerating')
  }
  useSessionStore.setState({ proposalGenerating: false })

  if (!getProposalSetupState(useSessionStore.getState()).readyToGenerate) {
    throw new Error('proposal generation harness: readyToGenerate required before store generate')
  }

  const chatBeforeStoreGenerate = useSessionStore.getState().chatMessages.length
  const chatGeneratingBefore = useSessionStore.getState().chatGenerating

  clearEcpAgentAuditLog()
  await store.runGenerateProposalVolumes()

  const afterGenerate = useSessionStore.getState()
  if (afterGenerate.chatGenerating) {
    throw new Error('proposal generation harness: proposal batch must not set chatGenerating')
  }
  if (afterGenerate.chatMessages.length !== chatBeforeStoreGenerate) {
    throw new Error('proposal generation harness: chat thread should be unchanged during generate')
  }
  if (chatGeneratingBefore !== afterGenerate.chatGenerating) {
    throw new Error('proposal generation harness: chatGenerating flag should not flip during proposal batch')
  }
  if (afterGenerate.proposalGenerating) {
    throw new Error('proposal generation harness: proposalGenerating should be false after run')
  }

  const storeAllows = getEcpAgentAuditLog().filter(
    (entry) =>
      entry.capabilityId === DOCUMENT_CAPABILITIES.find_clause && entry.decision === 'allow',
  )
  if (storeAllows.length < 1) {
    throw new Error('proposal generation harness: store generate should audit find_clause allow')
  }

  const storeSectionCount =
    afterGenerate.proposalRequirementsProfile?.volumes.reduce(
      (sum, volume) => sum + (volume.sections?.length ?? 1),
      0,
    ) ?? 0
  if (storeAllows.length < storeSectionCount && storeSectionCount > 1) {
    throw new Error(
      `proposal generation harness: store path expected ≥${storeSectionCount} find_clause allows, got ${storeAllows.length}`,
    )
  }

  const volumes = afterGenerate.proposalRequirementsProfile?.volumes ?? []
  if (volumes.length === 0) {
    throw new Error('proposal generation harness: expected volumes after generate')
  }

  assertVolumeOutcomes(volumes, 'proposal generation harness: store path')

  if (import.meta.env.DEV) {
    console.debug('[proposal-generation-harness] ok', {
      webGpuAvailable,
      volumeCount: volumes.length,
      draftCount: volumes.filter((volume) => volume.status === 'draft').length,
    })
  }

  store.resetSession()
}
