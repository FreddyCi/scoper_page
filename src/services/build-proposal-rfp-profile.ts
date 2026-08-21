import type {
  BlockRecord,
  DocumentMeta,
  ProposalAnalysisRef,
  ProposalRequirementsProfile,
  ProposalVolume,
  RfpResultsProfile,
} from '@/lib/types'
import {
  classifyProposalPackage,
  type ProposalPackageKind,
} from '@/lib/proposal-package-classifier'
import {
  commonSectionPathPrefix,
  compactSectionPathLabel,
  fetchDocumentBlocks,
  groupBlocksBySection,
} from '@/services/document-blocks'

export type BuildProposalRfpProfileOptions = {
  rfpDocId: string
  companyContext?: string
  /** RFP Analysis baseline — criteria mapped onto volumes as `analysisRefs` (BDA-208). */
  baselineProfile?: RfpResultsProfile | null
}

const PROPOSAL_SUMMARY_MAX = 480
const MAX_VOLUMES = 12
const MIN_SECTION_CHARS = 120

const PROPOSAL_SECTION_HINT =
  /section\s*[lm]\b|instructions\s*to\s*offerors|evaluation\s*factors|proposal\s*requirements|submission\s*requirements|volume\s*\d|technical\s*approach|management\s*approach|past\s*performance|cost\s*proposal|price\s*proposal/i

export { PROPOSAL_SUMMARY_MAX, PROPOSAL_SECTION_HINT }

const CONTRACT_FRAMEWORK_MIN_VOLUMES = 6
const CONTRACT_FRAMEWORK_MAX_VOLUMES = 12

const CONTRACT_FRAMEWORK_THEMES: { title: string; requirementSummary: string }[] = [
  {
    title: 'Scope and statements of work',
    requirementSummary:
      'Address how services, deliverables, and change control align to the agreement and any SOW templates.',
  },
  {
    title: 'Insurance and bonding',
    requirementSummary:
      'Respond to required coverage types, limits, additional insured endorsements, and bonding if applicable.',
  },
  {
    title: 'Indemnification and liability',
    requirementSummary:
      'Explain acceptance or proposed modifications to indemnity, caps, and carve-outs for IP and third-party claims.',
  },
  {
    title: 'Intellectual property',
    requirementSummary:
      'Clarify ownership of work product, licenses, background IP, and open-source obligations.',
  },
  {
    title: 'Confidentiality and data protection',
    requirementSummary:
      'Cover handling of confidential information, security controls, breach notice, and privacy compliance.',
  },
  {
    title: 'Payment and invoicing',
    requirementSummary:
      'Describe rates, milestones, invoicing cadence, taxes, and audit rights tied to the contract framework.',
  },
  {
    title: 'Term and termination',
    requirementSummary:
      'Address term length, renewal, termination for convenience/cause, and transition assistance.',
  },
  {
    title: 'Warranties and representations',
    requirementSummary:
      'Respond to performance warranties, authority to contract, and compliance representations.',
  },
  {
    title: 'Dispute resolution and governing law',
    requirementSummary:
      'Note venue, governing law, escalation, and alternative dispute resolution clauses.',
  },
  {
    title: 'General terms and order of precedence',
    requirementSummary:
      'Summarize flow-down requirements, precedence among MSA/SOW/exhibits, and subcontractor obligations.',
  },
]

function volumeIdFromTitle(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `vol-${index}-${slug || 'section'}`
}

function requirementSummaryForSection(blocks: BlockRecord[], title: string): string {
  const text = blocks
    .map((block) => block.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length === 0) {
    return `Respond to ${title} requirements in the solicitation.`
  }
  return text.length > 240 ? `${text.slice(0, 237)}…` : text
}

function deriveVolumesFromBlocks(blocks: BlockRecord[]): ProposalVolume[] {
  const sectionGroups = groupBlocksBySection(blocks)
  const paths = blocks
    .map((block) => block.section_path?.trim())
    .filter((path): path is string => Boolean(path))
  const prefix = commonSectionPathPrefix(paths)

  const candidates = sectionGroups
    .map((group) => {
      const label =
        group.label === 'Document' && paths.length > 0
          ? compactSectionPathLabel(paths[0] ?? group.label, prefix)
          : compactSectionPathLabel(group.label, prefix)
      const charCount = group.blocks.reduce((total, block) => total + block.text.length, 0)
      const hintScore =
        (PROPOSAL_SECTION_HINT.test(label) ? 2 : 0) +
        (PROPOSAL_SECTION_HINT.test(group.blocks.map((b) => b.text).join(' ')) ? 1 : 0)
      return { label, blocks: group.blocks, charCount, hintScore }
    })
    .filter((item) => item.charCount >= MIN_SECTION_CHARS || item.hintScore > 0)

  const ranked =
    candidates.length > 0
      ? [...candidates].sort((left, right) => {
          if (right.hintScore !== left.hintScore) return right.hintScore - left.hintScore
          return right.charCount - left.charCount
        })
      : sectionGroups.map((group) => ({
          label: compactSectionPathLabel(group.label, prefix),
          blocks: group.blocks,
          charCount: group.blocks.reduce((total, block) => total + block.text.length, 0),
          hintScore: 0,
        }))

  const selected = ranked.slice(0, MAX_VOLUMES)

  return selected.map((item, index) => ({
    id: volumeIdFromTitle(item.label, index),
    title: item.label,
    requirementSummary: requirementSummaryForSection(item.blocks, item.label),
    solicitationRefs: item.label.match(/section\s*[a-z0-9.]+/gi) ?? undefined,
    status: 'pending' as const,
  }))
}

/** Contract/MSA-style volume themes (6–12 sections) when the package is not a solicitation RFP. */
export function deriveContractFrameworkVolumes(): ProposalVolume[] {
  const selected = CONTRACT_FRAMEWORK_THEMES.slice(0, CONTRACT_FRAMEWORK_MAX_VOLUMES)
  return selected.map((theme, index) => ({
    id: volumeIdFromTitle(theme.title, index),
    title: theme.title,
    requirementSummary: theme.requirementSummary,
    status: 'pending' as const,
  }))
}

function deriveVolumesForPackage(
  blocks: BlockRecord[],
  packageKind: ProposalPackageKind,
): ProposalVolume[] {
  const fromBlocks = deriveVolumesFromBlocks(blocks)

  if (packageKind === 'contract_framework') {
    const themed = deriveContractFrameworkVolumes()
    if (themed.length >= CONTRACT_FRAMEWORK_MIN_VOLUMES) {
      return themed.slice(0, CONTRACT_FRAMEWORK_MAX_VOLUMES)
    }
  }

  if (fromBlocks.length > 0) {
    return fromBlocks
  }

  return [
    {
      id: 'vol-complete-proposal',
      title: 'Complete proposal response',
      requirementSummary:
        packageKind === 'contract_framework'
          ? 'Address each contract theme with specific acceptance, exceptions, or redlines.'
          : 'Address all instructions and evaluation factors in the solicitation using the attached RFP.',
      status: 'pending',
    },
  ]
}

const MATCH_TOKEN_MIN_LENGTH = 3

function tokenizeForVolumeMatch(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= MATCH_TOKEN_MIN_LENGTH),
  )
}

function keywordOverlapScore(left: Set<string>, right: Set<string>): number {
  let score = 0
  for (const token of left) {
    if (right.has(token)) {
      score += 1
    }
  }
  return score
}

function volumeMatchCorpus(volume: ProposalVolume): string {
  return `${volume.title} ${volume.requirementSummary}`
}

function criterionMatchCorpus(criterion: RfpResultsProfile['criteria'][number]): string {
  return `${criterion.label} ${criterion.detail ?? ''}`
}

/** Assign each baseline criterion to the best-matching proposal volume (BDA-208). */
export function mapBaselineCriteriaToProposalVolumes(
  volumes: ProposalVolume[],
  baseline: RfpResultsProfile,
): ProposalVolume[] {
  if (volumes.length === 0 || baseline.criteria.length === 0) {
    return volumes
  }

  const refsByVolumeId = new Map<string, ProposalAnalysisRef[]>()
  for (const volume of volumes) {
    refsByVolumeId.set(volume.id, [])
  }

  const catchAllVolume = volumes.find((volume) => volume.id === 'vol-complete-proposal')
  const fallbackVolume = catchAllVolume ?? volumes[0]!

  for (const criterion of baseline.criteria) {
    const criterionTokens = tokenizeForVolumeMatch(criterionMatchCorpus(criterion))
    let bestVolume = fallbackVolume
    let bestScore = -1

    for (const volume of volumes) {
      const score = keywordOverlapScore(
        criterionTokens,
        tokenizeForVolumeMatch(volumeMatchCorpus(volume)),
      )
      if (score > bestScore) {
        bestScore = score
        bestVolume = volume
      }
    }

    if (bestScore === 0 && catchAllVolume) {
      bestVolume = catchAllVolume
    }

    const ref: ProposalAnalysisRef = {
      criterionId: criterion.id,
      label: criterion.label,
      status: criterion.status,
      citation: criterion.citation,
    }
    refsByVolumeId.get(bestVolume.id)!.push(ref)
  }

  return volumes.map((volume) => {
    const analysisRefs = refsByVolumeId.get(volume.id)
    if (!analysisRefs?.length) {
      return volume
    }
    return { ...volume, analysisRefs }
  })
}

function buildProfileSummary(
  filename: string,
  volumes: ProposalVolume[],
  companyContext: string,
  packageKind: ProposalPackageKind,
  baselineProfile?: RfpResultsProfile | null,
): string {
  const titles = volumes.map((volume) => volume.title).join('; ')
  const kindNote =
    packageKind === 'contract_framework'
      ? ' Contract-style package detected.'
      : packageKind === 'unknown'
        ? ' Package classification uncertain.'
        : ''
  const contextNote =
    companyContext.trim().length > 0
      ? ` Responder context provided (${companyContext.trim().length} chars).`
      : ''
  let baselineNote = ''
  if (baselineProfile && baselineProfile.criteria.length > 0) {
    const failCount = baselineProfile.criteria.filter((criterion) => criterion.status === 'fail').length
    const warnCount = baselineProfile.criteria.filter((criterion) => criterion.status === 'warn').length
    if (failCount > 0 || warnCount > 0) {
      baselineNote = ` RFP Analysis: ${failCount} fail, ${warnCount} warn.`
    } else {
      baselineNote = ` RFP Analysis: ${baselineProfile.criteria.length} criteria linked.`
    }
  }
  const summary = `${volumes.length} proposal volume(s) derived from ${filename}: ${titles}.${kindNote}${contextNote}${baselineNote}`
  return summary.length > PROPOSAL_SUMMARY_MAX
    ? `${summary.slice(0, PROPOSAL_SUMMARY_MAX - 1)}…`
    : summary
}

/** Extract solicitation-aligned volumes from ingested RFP blocks (in-memory; no DuckDB profile table). */
export async function buildProposalRfpProfile(
  documents: DocumentMeta[],
  options: BuildProposalRfpProfileOptions,
): Promise<ProposalRequirementsProfile | null> {
  const rfpDoc = documents.find((doc) => doc.doc_id === options.rfpDocId)
  if (!rfpDoc) return null

  const blocks = await fetchDocumentBlocks(options.rfpDocId)
  if (blocks.length === 0) return null

  const classification = classifyProposalPackage({
    filename: rfpDoc.filename,
    blocks,
  })

  const volumes = deriveVolumesForPackage(blocks, classification.packageKind)
  const volumesWithAnalysis = options.baselineProfile?.criteria.length
    ? mapBaselineCriteriaToProposalVolumes(volumes, options.baselineProfile)
    : volumes

  return {
    profile_id: `proposal-req-${options.rfpDocId}-${Date.now()}`,
    rfp_doc_id: options.rfpDocId,
    volumes: volumesWithAnalysis,
    packageKind: classification.packageKind,
    packageWarnings: [...classification.packageWarnings],
    summary: buildProfileSummary(
      rfpDoc.filename,
      volumesWithAnalysis,
      options.companyContext ?? '',
      classification.packageKind,
      options.baselineProfile,
    ),
    built_at: new Date().toISOString(),
  }
}

/** Dev harness — package kind on profile + contract volume themes (BDA-159) */
export function runBuildProposalRfpProfilePackageHarness(): void {
  const themed = deriveContractFrameworkVolumes()
  if (
    themed.length < CONTRACT_FRAMEWORK_MIN_VOLUMES ||
    themed.length > CONTRACT_FRAMEWORK_MAX_VOLUMES
  ) {
    throw new Error(
      `runBuildProposalRfpProfilePackageHarness: expected ${CONTRACT_FRAMEWORK_MIN_VOLUMES}-${CONTRACT_FRAMEWORK_MAX_VOLUMES} contract themes`,
    )
  }

  const rfpLike = classifyProposalPackage({
    filename: 'rfp-it-services.pdf',
    documentText: 'REQUEST FOR PROPOSAL — Bidder must submit pricing by the due date.',
  })
  if (rfpLike.packageKind !== 'solicitation') {
    throw new Error('runBuildProposalRfpProfilePackageHarness: sample RFP should classify as solicitation')
  }

  const contractLike = classifyProposalPackage({
    filename: 'master-services-agreement.pdf',
    documentText: 'MASTER SERVICES AGREEMENT between Client and Vendor. Limitation of Liability.',
  })
  if (contractLike.packageKind !== 'contract_framework') {
    throw new Error(
      'runBuildProposalRfpProfilePackageHarness: MSA sample should classify as contract_framework',
    )
  }

  const contractVolumes = deriveVolumesForPackage([], 'contract_framework')
  if (contractVolumes.length < CONTRACT_FRAMEWORK_MIN_VOLUMES) {
    throw new Error('runBuildProposalRfpProfilePackageHarness: contract package should use theme volumes')
  }
}

/** Dev harness — baseline criteria map to contract volumes (BDA-208). */
export function runBuildProposalRfpProfileBaselineMappingHarness(): void {
  const volumes = deriveContractFrameworkVolumes()
  const baseline: RfpResultsProfile = {
    profile_id: 'baseline-harness-insurance',
    source_doc_id: 'msa-harness',
    verdict: 'unlikely',
    subject: { name: 'Harness bidder' },
    summary: 'Insurance limits below required minimum.',
    criteria: [
      {
        id: 'crit-insurance-limits',
        label: 'General liability insurance limits',
        status: 'fail',
        detail: 'Additional insured and bonding endorsements required under Section 12.',
      },
    ],
  }

  const mapped = mapBaselineCriteriaToProposalVolumes(volumes, baseline)
  const insuranceVolume = mapped.find((volume) => volume.title === 'Insurance and bonding')
  if (!insuranceVolume) {
    throw new Error(
      'runBuildProposalRfpProfileBaselineMappingHarness: expected Insurance and bonding volume',
    )
  }

  const insuranceRef = insuranceVolume.analysisRefs?.find(
    (ref) => ref.criterionId === 'crit-insurance-limits',
  )
  if (!insuranceRef || insuranceRef.status !== 'fail') {
    throw new Error(
      'runBuildProposalRfpProfileBaselineMappingHarness: insurance criterion should map to insurance volume',
    )
  }

  const summary = buildProfileSummary(
    'master-services-agreement.pdf',
    mapped,
    'Harness responder context.',
    'contract_framework',
    baseline,
  )
  if (!summary.includes('RFP Analysis: 1 fail')) {
    throw new Error(
      'runBuildProposalRfpProfileBaselineMappingHarness: summary should include baseline fail count',
    )
  }

  const catchAllVolumes = mapBaselineCriteriaToProposalVolumes(
    [
      {
        id: 'vol-complete-proposal',
        title: 'Complete proposal response',
        requirementSummary: 'Address all contract themes.',
        status: 'pending',
      },
    ],
    {
      ...baseline,
      criteria: [
        {
          id: 'crit-unrelated',
          label: 'ZZZ unique token alpha',
          status: 'warn',
        },
      ],
    },
  )
  const catchAllRef = catchAllVolumes[0]?.analysisRefs?.[0]
  if (catchAllRef?.criterionId !== 'crit-unrelated') {
    throw new Error(
      'runBuildProposalRfpProfileBaselineMappingHarness: zero-overlap criterion should use catch-all volume',
    )
  }
}
