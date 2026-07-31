import { clearEcpAgentAuditLog, getEcpAgentAuditLog } from '@/ecp/agent-run'
import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import { ensureScoperEcpReadyBeforeAgentRun } from '@/ecp/environment'
import type { AgentActivityEntry } from '@/lib/agent-activity'
import type { ContextUsageResult } from '@/lib/context-usage'
import { getProposalSetupState } from '@/lib/proposal-readiness'
import {
  buildProposalHandoffBlock,
  createEmptyProposalHandoff,
} from '@/lib/proposal-context-roll'
import type { DocumentMeta, ProposalRequirementsProfile, ProposalVolume } from '@/lib/types'
import {
  classifyProposalPackage,
} from '@/lib/proposal-package-classifier'
import {
  buildProposalRfpProfile,
  deriveContractFrameworkVolumes,
} from '@/services/build-proposal-rfp-profile'
import { buildProposalVolumes } from '@/services/build-proposal-volumes'
import { CONTRACT_FRAMEWORK_SECTIONS_MIN } from '@/services/derive-proposal-sections'
import { ingestFile } from '@/services/ingest-router'
import { getScoperClient } from '@/services/scoper-client'
import { useSessionStore } from '@/store/session-store'

const HARNESS_COMPANY_CONTEXT =
  'Harness roofing subcontractor with twenty years of experience.'

const CONTRACT_MSA_HARNESS_VOLUME_SLICE = 2

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

function countProfileSections(profile: Pick<ProposalRequirementsProfile, 'volumes'>): number {
  return profile.volumes.reduce(
    (sum, volume) => sum + (volume.sections?.length ?? 1),
    0,
  )
}

function countSectionsAttempted(volumes: ProposalVolume[]): number {
  let attempted = 0
  for (const volume of volumes) {
    if (volume.sections?.length) {
      for (const section of volume.sections) {
        if (section.status !== 'pending') attempted += 1
      }
    } else if (volume.status !== 'pending') {
      attempted += 1
    }
  }
  return attempted
}

function assertFindClauseAllowsPerSection(
  allowCount: number,
  sectionCount: number,
  label: string,
): void {
  if (sectionCount <= 0) return
  if (allowCount < sectionCount) {
    throw new Error(
      `${label}: expected at least ${sectionCount} ECP find_clause allow entries, got ${allowCount}`,
    )
  }
}

/** Handoff / context blocks used between sectional rolls still render (BDA-179). */
export function assertProposalHandoffContextBlocks(): void {
  const handoff = createEmptyProposalHandoff({
    activeGoal: 'Draft contract-framework response volumes for the attached agreement.',
    packageKind: 'contract_framework',
    pendingSections: [
      { volumeId: 'vol-insurance', sectionId: 'sec-1', title: 'Insurance and bonding' },
    ],
  })
  const block = buildProposalHandoffBlock(handoff, 1, { estimatedTokensSoFar: 640 })
  const required = ['ACTIVE GOAL', 'PENDING SECTIONS', 'DO NOT REPEAT']
  for (const snippet of required) {
    if (!block.includes(snippet)) {
      throw new Error(
        `proposal generation harness: handoff context block missing "${snippet}"`,
      )
    }
  }
  if (block.trim().length < 80) {
    throw new Error('proposal generation harness: handoff context block too short')
  }
}

export function assertContextUsageWithinContextSize(
  usage: ContextUsageResult | null,
  label: string,
): void {
  if (!usage) {
    throw new Error(`${label}: expected contextUsageSnapshot after sectional generate`)
  }

  const accountableTokens = usage.segments
    .filter((segment) => segment.kind !== 'reserved')
    .reduce((sum, segment) => sum + segment.tokens, 0)

  if (accountableTokens !== usage.totalTokens) {
    throw new Error(`${label}: accountable segment tokens should match totalTokens`)
  }
  if (accountableTokens > usage.contextSize) {
    throw new Error(
      `${label}: accountable tokens (${accountableTokens}) exceed contextSize (${usage.contextSize})`,
    )
  }
}

export function assertSectionalAgentActivityLog(
  log: AgentActivityEntry[],
  sectionsAttempted: number,
  label: string,
): void {
  if (sectionsAttempted <= 0) return

  const compacting = log.filter((entry) => entry.kind === 'compacting').length
  const ecp = log.filter((entry) => entry.kind === 'ecp').length
  const writing = log.filter((entry) => entry.kind === 'section_write').length

  if (compacting < sectionsAttempted) {
    throw new Error(
      `${label}: expected ≥${sectionsAttempted} compacting (roll) entries, got ${compacting}`,
    )
  }
  if (ecp < sectionsAttempted) {
    throw new Error(`${label}: expected ≥${sectionsAttempted} ecp entries, got ${ecp}`)
  }
  if (writing < sectionsAttempted) {
    throw new Error(
      `${label}: expected ≥${sectionsAttempted} section_write entries, got ${writing}`,
    )
  }
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

function assertContractMsaProfileShape(): void {
  const themed = deriveContractFrameworkVolumes()
  if (themed.length < CONTRACT_FRAMEWORK_SECTIONS_MIN) {
    throw new Error(
      `proposal generation harness: MSA fixture expected ≥${CONTRACT_FRAMEWORK_SECTIONS_MIN} contract volumes, got ${themed.length}`,
    )
  }

  const contractLike = classifyProposalPackage({
    filename: 'master-services-agreement.pdf',
    documentText:
      'MASTER SERVICES AGREEMENT between Client and Vendor. Limitation of Liability and indemnification.',
  })
  if (contractLike.packageKind !== 'contract_framework') {
    throw new Error(
      `proposal generation harness: MSA classifier fixture expected contract_framework, got ${contractLike.packageKind}`,
    )
  }
}

async function runContractMsaGenerationSlice(
  document: DocumentMeta,
  companyContext: string,
): Promise<void> {
  const themed = deriveContractFrameworkVolumes()
  if (themed.length < CONTRACT_FRAMEWORK_SECTIONS_MIN) {
    throw new Error(
      'proposal generation harness: contract framework fixture should expose multiple volumes',
    )
  }

  const profile: ProposalRequirementsProfile = {
    profile_id: `proposal-harness-msa-${Date.now()}`,
    rfp_doc_id: document.doc_id,
    volumes: themed.slice(0, CONTRACT_MSA_HARNESS_VOLUME_SLICE),
    packageKind: 'contract_framework',
    packageWarnings: ['Harness contract_framework slice.'],
    summary: 'Two-volume contract-framework generation slice.',
    built_at: new Date().toISOString(),
  }

  useSessionStore.getState().clearAgentActivity()
  clearEcpAgentAuditLog()
  await ensureScoperEcpReadyBeforeAgentRun()

  const generated = await buildProposalVolumes({
    documents: [document],
    profile,
    companyContext,
    onProfileUpdate: () => {},
  })

  if (generated.volumes.length < CONTRACT_MSA_HARNESS_VOLUME_SLICE) {
    throw new Error('proposal generation harness: MSA slice expected multiple volumes')
  }

  const sectionCount = countProfileSections(generated)
  if (sectionCount < 2) {
    throw new Error(
      `proposal generation harness: MSA slice expected multiple sections, got ${sectionCount}`,
    )
  }

  const sectionsAttempted = countSectionsAttempted(generated.volumes)
  const allows = getEcpAgentAuditLog().filter(
    (entry) =>
      entry.capabilityId === DOCUMENT_CAPABILITIES.find_clause && entry.decision === 'allow',
  )
  assertFindClauseAllowsPerSection(
    allows.length,
    sectionsAttempted,
    'proposal generation harness: MSA slice',
  )

  assertSectionalAgentActivityLog(
    useSessionStore.getState().agentActivityLog,
    sectionsAttempted,
    'proposal generation harness: MSA slice',
  )
  assertContextUsageWithinContextSize(
    useSessionStore.getState().contextUsageSnapshot,
    'proposal generation harness: MSA slice',
  )

  assertVolumeOutcomes(generated.volumes, 'proposal generation harness: MSA slice')
}

/**
 * End-to-end proposal harness (BDA-119, BDA-179): ingest → profile → gated generate (ECP + Scoper/stub).
 */
export async function runProposalGenerationHarness(): Promise<void> {
  assertProposalHandoffContextBlocks()

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

  assertContractMsaProfileShape()

  const profile = await buildProposalRfpProfile([document], {
    rfpDocId: document.doc_id,
    companyContext: HARNESS_COMPANY_CONTEXT,
  })

  if (!profile?.volumes.length) {
    throw new Error('proposal generation harness: need profile volumes for service loop test')
  }

  clearEcpAgentAuditLog()
  await ensureScoperEcpReadyBeforeAgentRun()

  useSessionStore.getState().clearAgentActivity()
  useSessionStore.setState({ proposalGenerating: true })

  let profileUpdates = 0
  const generated = await buildProposalVolumes({
    documents: [document],
    profile,
    companyContext: HARNESS_COMPANY_CONTEXT,
    onProfileUpdate: () => {
      profileUpdates += 1
    },
  })

  useSessionStore.setState({ proposalGenerating: false })

  const sectionsAttempted = countSectionsAttempted(generated.volumes)

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
  assertFindClauseAllowsPerSection(
    findClauseAllows.length,
    sectionsAttempted,
    'proposal generation harness: service loop',
  )

  assertSectionalAgentActivityLog(
    useSessionStore.getState().agentActivityLog,
    sectionsAttempted,
    'proposal generation harness: service loop',
  )
  assertContextUsageWithinContextSize(
    useSessionStore.getState().contextUsageSnapshot,
    'proposal generation harness: service loop',
  )

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
  useSessionStore.getState().clearAgentActivity()

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

  const storeSectionCount = countProfileSections(
    afterGenerate.proposalRequirementsProfile ?? { volumes: [] },
  )
  const storeSectionsAttempted = countSectionsAttempted(
    afterGenerate.proposalRequirementsProfile?.volumes ?? [],
  )

  assertFindClauseAllowsPerSection(
    storeAllows.length,
    storeSectionsAttempted,
    'proposal generation harness: store path',
  )

  const volumes = afterGenerate.proposalRequirementsProfile?.volumes ?? []
  if (volumes.length === 0) {
    throw new Error('proposal generation harness: expected volumes after generate')
  }

  assertVolumeOutcomes(volumes, 'proposal generation harness: store path')

  assertSectionalAgentActivityLog(
    afterGenerate.agentActivityLog,
    storeSectionsAttempted,
    'proposal generation harness: store path',
  )
  assertContextUsageWithinContextSize(
    afterGenerate.contextUsageSnapshot,
    'proposal generation harness: store path',
  )

  await runContractMsaGenerationSlice(document, HARNESS_COMPANY_CONTEXT)

  if (import.meta.env.DEV) {
    console.debug('[proposal-generation-harness] ok', {
      webGpuAvailable,
      volumeCount: volumes.length,
      sectionCount: storeSectionCount,
      sectionsAttempted: storeSectionsAttempted,
      draftCount: volumes.filter((volume) => volume.status === 'draft').length,
      findClauseAllows: storeAllows.length,
    })
  }

  store.resetSession()
}
