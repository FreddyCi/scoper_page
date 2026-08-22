import { runEcpAgentTool, EcpAgentRunDeniedError } from '@/ecp/agent-run'
import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import { createProposalContextTracker } from '@/lib/proposal-context-tracker'
import {
  applySectionCompletion,
  buildProposalHandoffBlock,
  createEmptyProposalHandoff,
  recordProposalHandoffFailure,
  truncateTopicMemory,
  type ProposalCompletedSection,
  type ProposalHandoffSectionRef,
  type ProposalHandoffState,
} from '@/lib/proposal-context-roll'
import type { ProposalSectionActivityEvent } from '@/lib/agent-activity'
import {
  notifyProposalSectionActivity,
  notifyProposalSectionRoll,
  syncContextUsageFromTracker,
} from '@/services/agent-activity-bridge'
import {
  PROPOSAL_DRAFT_MIN_CHARS,
  isLikelyPdfFilenameLine,
  sanitizeProposalDraftMarkdown,
  validateProposalVolumeDraft,
} from '@/lib/proposal-export-quality'
import { computeVolumeGenerationProgress } from '@/lib/proposal-volume-section'
import type {
  BlockRecord,
  CitationRef,
  DocumentMeta,
  FindClauseResult,
  ProposalRequirementsProfile,
  ProposalVolume,
  ProposalVolumeSection,
} from '@/lib/types'
import { fetchDocumentBlocks, groupBlocksBySection } from '@/services/document-blocks'
import { buildSectionReviewFindClauseQuery } from '@/lib/proposal-section-find-clause'
import { deriveProposalSectionsForVolume } from '@/services/derive-proposal-sections'
import {
  generateProposalSectionMarkdownViaEcp,
  citationsFromFindClauseResult,
  excerptsFromFindClauseResult,
  ProposalContextOverflowError,
} from '@/services/proposal-volume-ecp'
import { getScoperClient, ScoperWebGpuUnavailableError } from '@/services/scoper-client'

export type { ProposalSectionActivityEvent } from '@/lib/agent-activity'

export type BuildProposalVolumeCallbacks = {
  companyContext: string
  onProfileUpdate: (profile: ProposalRequirementsProfile) => void
  onSectionActivity?: (event: ProposalSectionActivityEvent) => void
  onHandoffUpdate?: (handoff: ProposalHandoffState | null) => void
}

export type BuildProposalVolumesOptions = BuildProposalVolumeCallbacks & {
  documents: DocumentMeta[]
  profile: ProposalRequirementsProfile
}

/** Inputs for one volume run (batch or single-volume entry via BDA-196). */
export type BuildProposalVolumeOptions = BuildProposalVolumeCallbacks & {
  blocks: BlockRecord[]
  rfpDoc: DocumentMeta
}

/** Mutable batch state shared across sequential volume runs (BDA-164 handoff roll). */
export type BuildProposalVolumeBatchState = {
  handoff: ProposalHandoffState
  handoffChunkIndex: number
  contextTracker: ReturnType<typeof createProposalContextTracker>
  /** Reset handoff to one volume + sibling draft summaries before generating (BDA-198). */
  isolatedVolumeRun?: boolean
}

const PROPOSAL_SECTION_DRAFT_MIN_CHARS = Math.max(120, Math.floor(PROPOSAL_DRAFT_MIN_CHARS / 2))

export function patchProposalVolume(
  profile: ProposalRequirementsProfile,
  volumeId: string,
  patch: Partial<ProposalVolume>,
): ProposalRequirementsProfile {
  return {
    ...profile,
    volumes: profile.volumes.map((volume) =>
      volume.id === volumeId ? { ...volume, ...patch } : volume,
    ),
  }
}

function patchProposalVolumeSection(
  profile: ProposalRequirementsProfile,
  volumeId: string,
  sectionId: string,
  patch: Partial<ProposalVolumeSection>,
): ProposalRequirementsProfile {
  return {
    ...profile,
    volumes: profile.volumes.map((volume) => {
      if (volume.id !== volumeId) return volume
      return {
        ...volume,
        sections: volume.sections?.map((section) =>
          section.id === sectionId ? { ...section, ...patch } : section,
        ),
      }
    }),
  }
}

function collectPendingSectionRefs(volumes: ProposalVolume[]): ProposalHandoffSectionRef[] {
  const refs: ProposalHandoffSectionRef[] = []
  for (const volume of volumes) {
    for (const section of volume.sections ?? []) {
      refs.push({
        volumeId: volume.id,
        sectionId: section.id,
        title: section.title,
      })
    }
  }
  return refs
}

/** Short summary for handoff topic memory (BDA-154 / BDA-198). */
export function summarizeSectionMarkdown(markdown: string): string {
  const plain = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, 220)
}

/** Completed-section snapshots from other volumes already in `draft` (section bodies only). */
export function collectSiblingDraftCompletedSections(
  profile: ProposalRequirementsProfile,
  excludeVolumeId: string,
): ProposalCompletedSection[] {
  const completed: ProposalCompletedSection[] = []

  for (const volume of profile.volumes) {
    if (volume.id === excludeVolumeId || volume.status !== 'draft') {
      continue
    }

    const sections = volume.sections ?? []
    let seededFromSections = false

    for (const section of sections) {
      const body = section.bodyMarkdown?.trim()
      if (!body) continue
      seededFromSections = true
      completed.push({
        volumeId: volume.id,
        sectionId: section.id,
        title: section.title,
        summary: summarizeSectionMarkdown(body),
      })
    }

    if (!seededFromSections && volume.bodyMarkdown?.trim()) {
      completed.push({
        volumeId: volume.id,
        sectionId: sections[0]?.id ?? `${volume.id}-body`,
        title: volume.title,
        summary: summarizeSectionMarkdown(volume.bodyMarkdown),
      })
    }
  }

  return completed
}

export function seedHandoffWithSiblingDrafts(
  handoff: ProposalHandoffState,
  profile: ProposalRequirementsProfile,
  excludeVolumeId: string,
): ProposalHandoffState {
  const siblingSections = collectSiblingDraftCompletedSections(profile, excludeVolumeId)
  if (siblingSections.length === 0) {
    return handoff
  }

  let next = handoff
  for (const completed of siblingSections) {
    const topicLine = `${completed.title}: ${completed.summary}`.trim()
    next = {
      ...next,
      completedSections: [...next.completedSections, completed],
      topicMemory: truncateTopicMemory([
        ...next.topicMemory,
        ...(topicLine ? [topicLine] : []),
      ]),
    }
  }
  return next
}

/** Isolated handoff for single-volume generate: pending refs for target + sibling draft context (BDA-198). */
export function createIsolatedVolumeProposalHandoff(
  profile: ProposalRequirementsProfile,
  volumeId: string,
): ProposalHandoffState {
  const volume = profile.volumes.find((entry) => entry.id === volumeId)
  if (!volume) {
    throw new Error(`createIsolatedVolumeProposalHandoff: volume not found (${volumeId})`)
  }

  const base = createEmptyProposalHandoff({
    activeGoal:
      profile.summary.trim() ||
      'Draft complete proposal volumes for the attached RFP',
    packageKind: profile.packageKind,
    pendingSections: collectPendingSectionRefs([volume]),
  })

  return seedHandoffWithSiblingDrafts(base, profile, volumeId)
}

function excerptsForVolume(blocks: BlockRecord[], volume: ProposalVolume): string[] {
  const groups = groupBlocksBySection(blocks)
  const titleNeedle = volume.title.toLowerCase()
  const matched =
    groups.find((group) => group.label.toLowerCase() === titleNeedle) ??
    groups.find((group) => group.label.toLowerCase().includes(titleNeedle.slice(0, 24)))

  const sourceBlocks = matched?.blocks ?? blocks
  const lines: string[] = []

  for (const block of sourceBlocks) {
    const line = block.text.replace(/\s+/g, ' ').trim()
    if (line.length < 40) continue
    if (isLikelyPdfFilenameLine(line)) continue
    lines.push(line.slice(0, 320))
    if (lines.length >= 4) break
  }

  return lines
}

function scoutDegradedSectionStub(
  section: ProposalVolumeSection,
  volume: ProposalVolume,
  companyContext: string,
): string {
  const responder = companyContext.trim().slice(0, 240)
  const requirements = volume.requirementSummary.trim().slice(0, 320)

  return [
    `## ${section.title}`,
    '',
    `${responder} responds to the solicitation requirements for ${section.title} under the attached master services agreement.`,
    '',
    '### Compliance approach',
    requirements ||
      'Our team aligns staffing, schedule, quality control, and subcontract coordination to the agreement terms cited in the solicitation.',
    '',
    '### Execution',
    'Field supervision documents daily sign-offs, coordinates with the construction manager, and maintains the close-out records required before final acceptance. Change orders, insurance certificates, and indemnity limits follow the contract framework without exceptions unless noted in writing.',
    '',
    'Regenerate this section after WebGPU is available for citation-backed prose tied to retrieved RFP clauses.',
  ].join('\n')
}

function stubSectionMarkdown(
  section: ProposalVolumeSection,
  volume: ProposalVolume,
  excerpts: string[],
  companyContext: string,
): string {
  const usableExcerpts = excerpts.filter((line) => !isLikelyPdfFilenameLine(line))

  if (usableExcerpts.length === 0) {
    return scoutDegradedSectionStub(section, volume, companyContext)
  }

  const excerptBlock = usableExcerpts.map((line) => `- ${line}`).join('\n')

  return [
    `## ${section.title}`,
    '',
    '### Responder context',
    companyContext.trim().slice(0, 400),
    '',
    '### Solicitation alignment',
    volume.requirementSummary,
    '',
    '### Draft response',
    excerptBlock,
  ].join('\n')
}

function appendVolumeSectionBody(existing: string | undefined, sectionMarkdown: string): string {
  const chunk = sectionMarkdown.trim()
  if (!chunk) return existing?.trim() ?? ''
  if (!existing?.trim()) return chunk
  return `${existing.trim()}\n\n${chunk}`
}

function mergeSectionCitations(...lists: CitationRef[][]): CitationRef[] {
  const seen = new Set<string>()
  const merged: CitationRef[] = []
  for (const list of lists) {
    for (const citation of list) {
      if (seen.has(citation.block_id)) continue
      seen.add(citation.block_id)
      merged.push(citation)
    }
  }
  return merged
}

async function runReviewFindClause(
  section: ProposalVolumeSection,
  volume: ProposalVolume,
  rfpDoc: DocumentMeta,
  packageKind: ProposalRequirementsProfile['packageKind'],
  contextTracker: ReturnType<typeof createProposalContextTracker>,
): Promise<{ excerpts: string[]; citations: CitationRef[] }> {
  const query = buildSectionReviewFindClauseQuery(volume, section.title, packageKind)
  contextTracker.recordSegment('ecp_tool', query)

  const findResult = (await runEcpAgentTool({
    capabilityId: DOCUMENT_CAPABILITIES.find_clause,
    input: { query, docIds: [rfpDoc.doc_id], limit: 6 },
    ecpReady: true,
  })) as FindClauseResult

  return {
    excerpts: excerptsFromFindClauseResult(findResult),
    citations: citationsFromFindClauseResult(findResult),
  }
}

async function generateSectionBody(
  input: {
    section: ProposalVolumeSection
    volume: ProposalVolume
    rfpDoc: DocumentMeta
    blockExcerpts: string[]
    companyContext: string
    packageKind: ProposalRequirementsProfile['packageKind']
    handoff: ProposalHandoffState
    handoffChunkIndex: number
    contextTracker: ReturnType<typeof createProposalContextTracker>
    excerpts?: string[]
  },
  options: BuildProposalVolumeCallbacks,
): Promise<{ markdown: string; ecpFindCount: number; citations: CitationRef[] }> {
  let ecpFindCount = input.excerpts?.length ? 0 : 1
  let markdown = ''
  let citations: CitationRef[] = []

  try {
    const generated = await generateProposalSectionMarkdownViaEcp({
      section: input.section,
      volume: input.volume,
      packageKind: input.packageKind,
      handoff: input.handoff,
      companyContext: input.companyContext,
      rfpDoc: input.rfpDoc,
      excerpts: input.excerpts,
      blockExcerptsFallback: input.blockExcerpts,
      contextTracker: input.contextTracker,
      handoffChunkIndex: input.handoffChunkIndex,
    })
    markdown = generated.markdown
    citations = generated.citations
  } catch (error) {
    if (
      error instanceof ProposalContextOverflowError ||
      error instanceof EcpAgentRunDeniedError
    ) {
      throw error
    }
    if (!(error instanceof ScoperWebGpuUnavailableError) && import.meta.env.DEV) {
      console.warn('[build-proposal-volumes] sectional Scoper generation failed', error)
    }
  }

  if (markdown.trim().length === 0) {
    markdown = stubSectionMarkdown(
      input.section,
      input.volume,
      input.blockExcerpts,
      input.companyContext,
    )
  }

  markdown = sanitizeProposalDraftMarkdown(markdown, {
    knownFilenames: [input.rfpDoc.filename],
  })

  let validation = validateProposalVolumeDraft(markdown, {
    label: input.section.title,
    minChars: PROPOSAL_SECTION_DRAFT_MIN_CHARS,
  })

  if (
    !validation.ok &&
    ecpFindCount < 2 &&
    (input.excerpts?.length ?? 0) === 0
  ) {
    notifyProposalSectionActivity(
      {
        kind: 'find_clause',
        volumeId: input.volume.id,
        sectionId: input.section.id,
        sectionTitle: input.section.title,
        message: 'Review retrieve after validation failure',
      },
      input.contextTracker,
      options.onSectionActivity,
    )

    const reviewRetrieve = await runReviewFindClause(
      input.section,
      input.volume,
      input.rfpDoc,
      input.packageKind,
      input.contextTracker,
    )
    ecpFindCount += 1

    if (reviewRetrieve.excerpts.length > 0) {
      notifyProposalSectionRoll(
        {
          volumeId: input.volume.id,
          sectionId: input.section.id,
          sectionTitle: input.section.title,
          message: 'Roll before review retrieve rewrite',
        },
        input.contextTracker,
        options.onSectionActivity,
      )

      const regenerated = await generateProposalSectionMarkdownViaEcp({
        section: input.section,
        volume: input.volume,
        packageKind: input.packageKind,
        handoff: input.handoff,
        companyContext: input.companyContext,
        rfpDoc: input.rfpDoc,
        excerpts: reviewRetrieve.excerpts,
        citations: reviewRetrieve.citations,
        blockExcerptsFallback: input.blockExcerpts,
        contextTracker: input.contextTracker,
        handoffChunkIndex: input.handoffChunkIndex,
      })
      markdown = regenerated.markdown
      citations = mergeSectionCitations(citations, regenerated.citations)

      markdown = sanitizeProposalDraftMarkdown(markdown, {
        knownFilenames: [input.rfpDoc.filename],
      })

      validation = validateProposalVolumeDraft(markdown, {
        label: input.section.title,
        minChars: PROPOSAL_SECTION_DRAFT_MIN_CHARS,
      })
    }
  }

  if (!validation.ok && markdown.trim().length === 0) {
    markdown = stubSectionMarkdown(
      input.section,
      input.volume,
      input.blockExcerpts,
      input.companyContext,
    )
  }

  syncContextUsageFromTracker(input.contextTracker)

  return { markdown, ecpFindCount, citations }
}

function ensureVolumeSections(
  profile: ProposalRequirementsProfile,
  volumeId: string,
  blocks: BlockRecord[],
): ProposalRequirementsProfile {
  const volume = profile.volumes.find((entry) => entry.id === volumeId)
  if (!volume) return profile

  if (volume.sections && volume.sections.length > 0) {
    return profile
  }

  const sections = deriveProposalSectionsForVolume({
    volume,
    blocks,
    packageKind: profile.packageKind,
  })

  return patchProposalVolume(profile, volumeId, { sections })
}

/**
 * Generate markdown for one proposal volume via sectional ECP + Scoper (BDA-196).
 * Mutates `batchState` handoff and chunk index for sequential full-profile runs.
 */
export async function buildProposalVolume(
  profile: ProposalRequirementsProfile,
  volumeId: string,
  options: BuildProposalVolumeOptions,
  batchState: BuildProposalVolumeBatchState,
): Promise<ProposalRequirementsProfile> {
  let nextProfile = ensureVolumeSections(profile, volumeId, options.blocks)

  const volume = nextProfile.volumes.find((entry) => entry.id === volumeId)
  if (!volume) {
    throw new Error(`buildProposalVolume: volume not found (${volumeId})`)
  }

  if (batchState.isolatedVolumeRun) {
    batchState.handoff = createIsolatedVolumeProposalHandoff(nextProfile, volumeId)
    batchState.handoffChunkIndex = 0
    options.onHandoffUpdate?.(batchState.handoff)
  }

  batchState.contextTracker.reset()

  const sections = volume.sections ?? []

  nextProfile = patchProposalVolume(nextProfile, volume.id, {
    status: 'generating',
    errorMessage: undefined,
    bodyMarkdown: undefined,
    sections: sections.map((section) => ({
      ...section,
      status: 'pending',
      bodyMarkdown: undefined,
      errorMessage: undefined,
    })),
    generationProgress: computeVolumeGenerationProgress(sections),
  })
  options.onProfileUpdate(nextProfile)

  const blockExcerpts = excerptsForVolume(options.blocks, volume)
  let bodyMarkdown = ''
  let volumeHadError = false
  let volumeErrorMessage: string | undefined

  try {
    for (const sectionSeed of sections) {
      const section =
        nextProfile.volumes
          .find((entry) => entry.id === volume.id)
          ?.sections?.find((entry) => entry.id === sectionSeed.id) ?? sectionSeed

      batchState.handoffChunkIndex += 1
      notifyProposalSectionRoll(
        {
          volumeId: volume.id,
          sectionId: section.id,
          sectionTitle: section.title,
        },
        batchState.contextTracker,
        options.onSectionActivity,
      )

      nextProfile = patchProposalVolumeSection(nextProfile, volume.id, section.id, {
        status: 'generating',
        errorMessage: undefined,
      })
      nextProfile = patchProposalVolume(nextProfile, volume.id, {
        generationProgress: computeVolumeGenerationProgress(
          nextProfile.volumes.find((entry) => entry.id === volume.id)?.sections,
        ),
      })
      options.onProfileUpdate(nextProfile)

      notifyProposalSectionActivity(
        {
          kind: 'find_clause',
          volumeId: volume.id,
          sectionId: section.id,
          sectionTitle: section.title,
        },
        batchState.contextTracker,
        options.onSectionActivity,
      )

      notifyProposalSectionActivity(
        {
          kind: 'writing',
          volumeId: volume.id,
          sectionId: section.id,
          sectionTitle: section.title,
        },
        batchState.contextTracker,
        options.onSectionActivity,
      )

      const { markdown: sectionMarkdown, citations: sectionCitations } = await generateSectionBody(
        {
          section,
          volume,
          rfpDoc: options.rfpDoc,
          blockExcerpts,
          companyContext: options.companyContext,
          packageKind: nextProfile.packageKind,
          handoff: batchState.handoff,
          handoffChunkIndex: batchState.handoffChunkIndex,
          contextTracker: batchState.contextTracker,
        },
        options,
      )

      const validation = validateProposalVolumeDraft(sectionMarkdown, {
        label: section.title,
        minChars: PROPOSAL_SECTION_DRAFT_MIN_CHARS,
      })

      if (!validation.ok) {
        const reason = validation.reasons.join('; ')
        batchState.handoff = recordProposalHandoffFailure(batchState.handoff, reason)
        options.onHandoffUpdate?.(batchState.handoff)
        volumeHadError = true
        volumeErrorMessage = reason

        nextProfile = patchProposalVolumeSection(nextProfile, volume.id, section.id, {
          status: 'error',
          errorMessage: reason,
          bodyMarkdown: sectionMarkdown.trim() || undefined,
          citations: sectionCitations.length > 0 ? sectionCitations : undefined,
        })
        notifyProposalSectionActivity(
          {
            kind: 'section_error',
            volumeId: volume.id,
            sectionId: section.id,
            sectionTitle: section.title,
            message: reason,
          },
          batchState.contextTracker,
          options.onSectionActivity,
        )
        options.onProfileUpdate(nextProfile)
        break
      }

      batchState.handoff = applySectionCompletion(batchState.handoff, {
        volumeId: volume.id,
        sectionId: section.id,
        title: section.title,
        summary: summarizeSectionMarkdown(sectionMarkdown),
      })
      options.onHandoffUpdate?.(batchState.handoff)

      bodyMarkdown = appendVolumeSectionBody(bodyMarkdown, sectionMarkdown)

      nextProfile = patchProposalVolumeSection(nextProfile, volume.id, section.id, {
        status: 'draft',
        bodyMarkdown: sectionMarkdown,
        errorMessage: undefined,
        citations: sectionCitations.length > 0 ? sectionCitations : undefined,
      })
      nextProfile = patchProposalVolume(nextProfile, volume.id, {
        bodyMarkdown,
        generationProgress: computeVolumeGenerationProgress(
          nextProfile.volumes.find((entry) => entry.id === volume.id)?.sections,
        ),
      })
      notifyProposalSectionActivity(
        {
          kind: 'validated',
          volumeId: volume.id,
          sectionId: section.id,
          sectionTitle: section.title,
        },
        batchState.contextTracker,
        options.onSectionActivity,
      )
      options.onProfileUpdate(nextProfile)
    }

    if (!volumeHadError) {
      const withTitle =
        bodyMarkdown.length > 0 && !bodyMarkdown.startsWith('#')
          ? [`# ${volume.title}`, '', bodyMarkdown].join('\n')
          : bodyMarkdown

      nextProfile = patchProposalVolume(nextProfile, volume.id, {
        status: 'draft',
        bodyMarkdown: withTitle,
        errorMessage: undefined,
      })
    } else {
      nextProfile = patchProposalVolume(nextProfile, volume.id, {
        status: 'error',
        errorMessage: volumeErrorMessage,
        bodyMarkdown: bodyMarkdown || undefined,
      })
    }
  } catch (error) {
    const message =
      error instanceof ProposalContextOverflowError
        ? error.message
        : error instanceof EcpAgentRunDeniedError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Volume generation failed'
    nextProfile = patchProposalVolume(nextProfile, volume.id, {
      status: 'error',
      errorMessage: message,
    })
  }

  options.onProfileUpdate(nextProfile)
  return nextProfile
}

function enrichProfileVolumeSections(
  profile: ProposalRequirementsProfile,
  blocks: BlockRecord[],
): ProposalRequirementsProfile {
  return {
    ...profile,
    volumes: profile.volumes.map((volume) => {
      const sections =
        volume.sections && volume.sections.length > 0
          ? volume.sections
          : deriveProposalSectionsForVolume({
              volume,
              blocks,
              packageKind: profile.packageKind,
            })
      return { ...volume, sections }
    }),
  }
}

/** Generate markdown for each volume sequentially via sectional ECP + Scoper (BDA-164). */
export async function buildProposalVolumes(
  options: BuildProposalVolumesOptions,
): Promise<ProposalRequirementsProfile> {
  const rfpDoc = options.documents.find((doc) => doc.doc_id === options.profile.rfp_doc_id)
  if (!rfpDoc) {
    throw new Error('buildProposalVolumes: RFP document not found in session')
  }

  const blocks = await fetchDocumentBlocks(options.profile.rfp_doc_id)

  let profile = enrichProfileVolumeSections(options.profile, blocks)

  const batchState: BuildProposalVolumeBatchState = {
    handoff: createEmptyProposalHandoff({
      activeGoal:
        profile.summary.trim() ||
        'Draft complete proposal volumes for the attached RFP',
      packageKind: profile.packageKind,
      pendingSections: collectPendingSectionRefs(profile.volumes),
    }),
    handoffChunkIndex: 0,
    contextTracker: createProposalContextTracker({
      effectiveMaxSeqLen: getScoperClient().getState().maxSeqLen,
    }),
  }
  options.onHandoffUpdate?.(batchState.handoff)

  const volumeOptions: BuildProposalVolumeOptions = {
    blocks,
    rfpDoc,
    companyContext: options.companyContext,
    onProfileUpdate: options.onProfileUpdate,
    onSectionActivity: options.onSectionActivity,
    onHandoffUpdate: options.onHandoffUpdate,
  }

  for (const volumeSeed of profile.volumes) {
    profile = await buildProposalVolume(profile, volumeSeed.id, volumeOptions, batchState)
  }

  syncContextUsageFromTracker(batchState.contextTracker)

  return profile
}

/** Dev harness — sibling draft summaries seed isolated handoff (BDA-198). */
export function runBuildProposalVolumeSiblingHandoffHarness(): void {
  const siblingSummaryPhrase = 'Acme liability coverage meets $2M general aggregate.'
  const profile: ProposalRequirementsProfile = {
    profile_id: 'harness-sibling-handoff',
    rfp_doc_id: 'doc-rfp',
    packageKind: 'contract_framework',
    packageWarnings: [],
    built_at: new Date().toISOString(),
    summary: 'Harness profile for sibling handoff seeding.',
    volumes: [
      {
        id: 'vol-insurance',
        title: 'Insurance and bonding',
        requirementSummary: 'Insurance limits and bonding requirements.',
        status: 'draft',
        sections: [
          {
            id: 'sec-ins-1',
            title: 'General liability',
            findClauseQuery: 'insurance liability',
            status: 'draft',
            bodyMarkdown: `## General liability\n\n${siblingSummaryPhrase}`,
          },
        ],
      },
      {
        id: 'vol-payment',
        title: 'Payment and invoicing',
        requirementSummary: 'Payment terms.',
        status: 'draft',
        sections: [
          {
            id: 'sec-pay-1',
            title: 'Invoicing cadence',
            findClauseQuery: 'payment invoice',
            status: 'draft',
            bodyMarkdown: '## Invoicing\n\nNet 30 with milestone billing.',
          },
        ],
      },
      {
        id: 'vol-indemnity',
        title: 'Indemnification and liability',
        requirementSummary: 'Indemnity caps.',
        status: 'pending',
        sections: [
          {
            id: 'sec-ind-1',
            title: 'Mutual indemnity',
            findClauseQuery: 'indemnification',
            status: 'pending',
          },
        ],
      },
    ],
  }

  const handoff = createIsolatedVolumeProposalHandoff(profile, 'vol-indemnity')

  if (handoff.completedSections.length < 2) {
    throw new Error(
      'runBuildProposalVolumeSiblingHandoffHarness: expected completed sections from two sibling volumes',
    )
  }
  if (handoff.pendingSections.length !== 1 || handoff.pendingSections[0]?.volumeId !== 'vol-indemnity') {
    throw new Error(
      'runBuildProposalVolumeSiblingHandoffHarness: pending sections should be target volume only',
    )
  }

  const block = buildProposalHandoffBlock(handoff, 1)
  if (!block.includes(siblingSummaryPhrase.slice(0, 40))) {
    throw new Error(
      'runBuildProposalVolumeSiblingHandoffHarness: handoff block missing sibling summary excerpt',
    )
  }
  if (!block.includes('General liability') || !block.includes('Invoicing cadence')) {
    throw new Error(
      'runBuildProposalVolumeSiblingHandoffHarness: handoff block missing sibling section titles',
    )
  }
}
