import { runEcpAgentTool, EcpAgentRunDeniedError } from '@/ecp/agent-run'
import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import { createProposalContextTracker } from '@/lib/proposal-context-tracker'
import {
  applySectionCompletion,
  createEmptyProposalHandoff,
  recordProposalHandoffFailure,
  rollProposalContext,
  type ProposalHandoffSectionRef,
  type ProposalHandoffState,
} from '@/lib/proposal-context-roll'
import {
  PROPOSAL_DRAFT_MIN_CHARS,
  validateProposalVolumeDraft,
} from '@/lib/proposal-export-quality'
import { computeVolumeGenerationProgress } from '@/lib/proposal-volume-section'
import type {
  BlockRecord,
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
  excerptsFromFindClauseResult,
  ProposalContextOverflowError,
} from '@/services/proposal-volume-ecp'
import { getScoperClient, ScoperWebGpuUnavailableError } from '@/services/scoper-client'

/** Milestones for proposal panel / activity log wiring (BDA-174). */
export type ProposalSectionActivityEvent = {
  kind: 'roll' | 'find_clause' | 'writing' | 'validated' | 'section_error'
  volumeId: string
  sectionId: string
  sectionTitle: string
  message?: string
}

export type BuildProposalVolumesOptions = {
  documents: DocumentMeta[]
  profile: ProposalRequirementsProfile
  companyContext: string
  onProfileUpdate: (profile: ProposalRequirementsProfile) => void
  onSectionActivity?: (event: ProposalSectionActivityEvent) => void
  onHandoffUpdate?: (handoff: ProposalHandoffState | null) => void
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
    lines.push(line.slice(0, 320))
    if (lines.length >= 4) break
  }

  return lines
}

function stubSectionMarkdown(
  section: ProposalVolumeSection,
  volume: ProposalVolume,
  excerpts: string[],
  companyContext: string,
): string {
  const excerptBlock =
    excerpts.length > 0
      ? excerpts.map((line) => `- ${line}`).join('\n')
      : '_Draft placeholder — connect the on-device model for full generation._'

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

function summarizeSectionMarkdown(markdown: string): string {
  const plain = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, 220)
}

function appendVolumeSectionBody(existing: string | undefined, sectionMarkdown: string): string {
  const chunk = sectionMarkdown.trim()
  if (!chunk) return existing?.trim() ?? ''
  if (!existing?.trim()) return chunk
  return `${existing.trim()}\n\n${chunk}`
}

async function runReviewFindClause(
  section: ProposalVolumeSection,
  volume: ProposalVolume,
  rfpDoc: DocumentMeta,
  packageKind: ProposalRequirementsProfile['packageKind'],
  contextTracker: ReturnType<typeof createProposalContextTracker>,
): Promise<string[]> {
  const query = buildSectionReviewFindClauseQuery(volume, section.title, packageKind)
  contextTracker.recordSegment('ecp_tool', query)

  const findResult = (await runEcpAgentTool({
    capabilityId: DOCUMENT_CAPABILITIES.find_clause,
    input: { query, docIds: [rfpDoc.doc_id], limit: 6 },
    ecpReady: true,
  })) as FindClauseResult

  return excerptsFromFindClauseResult(findResult)
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
  options: BuildProposalVolumesOptions,
): Promise<{ markdown: string; ecpFindCount: number }> {
  let ecpFindCount = input.excerpts?.length ? 0 : 1
  let markdown = ''

  try {
    markdown = await generateProposalSectionMarkdownViaEcp({
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

  let validation = validateProposalVolumeDraft(markdown, {
    label: input.section.title,
    minChars: PROPOSAL_SECTION_DRAFT_MIN_CHARS,
  })

  if (
    !validation.ok &&
    ecpFindCount < 2 &&
    (input.excerpts?.length ?? 0) === 0
  ) {
    options.onSectionActivity?.({
      kind: 'find_clause',
      volumeId: input.volume.id,
      sectionId: input.section.id,
      sectionTitle: input.section.title,
      message: 'Review retrieve after validation failure',
    })

    const reviewExcerpts = await runReviewFindClause(
      input.section,
      input.volume,
      input.rfpDoc,
      input.packageKind,
      input.contextTracker,
    )
    ecpFindCount += 1

    if (reviewExcerpts.length > 0) {
      rollProposalContext()
      options.onSectionActivity?.({
        kind: 'roll',
        volumeId: input.volume.id,
        sectionId: input.section.id,
        sectionTitle: input.section.title,
        message: 'Roll before review retrieve rewrite',
      })

      markdown = await generateProposalSectionMarkdownViaEcp({
        section: input.section,
        volume: input.volume,
        packageKind: input.packageKind,
        handoff: input.handoff,
        companyContext: input.companyContext,
        rfpDoc: input.rfpDoc,
        excerpts: reviewExcerpts,
        blockExcerptsFallback: input.blockExcerpts,
        contextTracker: input.contextTracker,
        handoffChunkIndex: input.handoffChunkIndex,
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

  return { markdown, ecpFindCount }
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

  let profile: ProposalRequirementsProfile = {
    ...options.profile,
    volumes: options.profile.volumes.map((volume) => {
      const sections =
        volume.sections && volume.sections.length > 0
          ? volume.sections
          : deriveProposalSectionsForVolume({
              volume,
              blocks,
              packageKind: options.profile.packageKind,
            })
      return { ...volume, sections }
    }),
  }

  let handoff = createEmptyProposalHandoff({
    activeGoal:
      profile.summary.trim() ||
      'Draft complete proposal volumes for the attached RFP',
    packageKind: profile.packageKind,
    pendingSections: collectPendingSectionRefs(profile.volumes),
  })
  options.onHandoffUpdate?.(handoff)

  let handoffChunkIndex = 0

  const contextTracker = createProposalContextTracker({
    effectiveMaxSeqLen: getScoperClient().getState().maxSeqLen,
  })

  for (const volumeSeed of profile.volumes) {
    contextTracker.reset()

    const volume =
      profile.volumes.find((entry) => entry.id === volumeSeed.id) ?? volumeSeed

    const sections = volume.sections ?? []

    profile = patchProposalVolume(profile, volume.id, {
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
    options.onProfileUpdate(profile)

    const blockExcerpts = excerptsForVolume(blocks, volume)
    let bodyMarkdown = ''
    let volumeHadError = false
    let volumeErrorMessage: string | undefined

    try {
      for (const sectionSeed of sections) {
        const section =
          profile.volumes
            .find((entry) => entry.id === volume.id)
            ?.sections?.find((entry) => entry.id === sectionSeed.id) ?? sectionSeed

        handoffChunkIndex += 1
        rollProposalContext()
        options.onSectionActivity?.({
          kind: 'roll',
          volumeId: volume.id,
          sectionId: section.id,
          sectionTitle: section.title,
        })

        profile = patchProposalVolumeSection(profile, volume.id, section.id, {
          status: 'generating',
          errorMessage: undefined,
        })
        profile = patchProposalVolume(profile, volume.id, {
          generationProgress: computeVolumeGenerationProgress(
            profile.volumes.find((entry) => entry.id === volume.id)?.sections,
          ),
        })
        options.onProfileUpdate(profile)

        options.onSectionActivity?.({
          kind: 'find_clause',
          volumeId: volume.id,
          sectionId: section.id,
          sectionTitle: section.title,
        })

        options.onSectionActivity?.({
          kind: 'writing',
          volumeId: volume.id,
          sectionId: section.id,
          sectionTitle: section.title,
        })

        const { markdown: sectionMarkdown } = await generateSectionBody(
          {
            section,
            volume,
            rfpDoc,
            blockExcerpts,
            companyContext: options.companyContext,
            packageKind: profile.packageKind,
            handoff,
            handoffChunkIndex,
            contextTracker,
          },
          options,
        )

        const validation = validateProposalVolumeDraft(sectionMarkdown, {
          label: section.title,
          minChars: PROPOSAL_SECTION_DRAFT_MIN_CHARS,
        })

        if (!validation.ok) {
          const reason = validation.reasons.join('; ')
          handoff = recordProposalHandoffFailure(handoff, reason)
          options.onHandoffUpdate?.(handoff)
          volumeHadError = true
          volumeErrorMessage = reason

          profile = patchProposalVolumeSection(profile, volume.id, section.id, {
            status: 'error',
            errorMessage: reason,
            bodyMarkdown: sectionMarkdown.trim() || undefined,
          })
          options.onSectionActivity?.({
            kind: 'section_error',
            volumeId: volume.id,
            sectionId: section.id,
            sectionTitle: section.title,
            message: reason,
          })
          options.onProfileUpdate(profile)
          break
        }

        handoff = applySectionCompletion(handoff, {
          volumeId: volume.id,
          sectionId: section.id,
          title: section.title,
          summary: summarizeSectionMarkdown(sectionMarkdown),
        })
        options.onHandoffUpdate?.(handoff)

        bodyMarkdown = appendVolumeSectionBody(bodyMarkdown, sectionMarkdown)

        profile = patchProposalVolumeSection(profile, volume.id, section.id, {
          status: 'draft',
          bodyMarkdown: sectionMarkdown,
          errorMessage: undefined,
        })
        profile = patchProposalVolume(profile, volume.id, {
          bodyMarkdown,
          generationProgress: computeVolumeGenerationProgress(
            profile.volumes.find((entry) => entry.id === volume.id)?.sections,
          ),
        })
        options.onSectionActivity?.({
          kind: 'validated',
          volumeId: volume.id,
          sectionId: section.id,
          sectionTitle: section.title,
        })
        options.onProfileUpdate(profile)
      }

      if (!volumeHadError) {
        const withTitle =
          bodyMarkdown.length > 0 && !bodyMarkdown.startsWith('#')
            ? [`# ${volume.title}`, '', bodyMarkdown].join('\n')
            : bodyMarkdown

        profile = patchProposalVolume(profile, volume.id, {
          status: 'draft',
          bodyMarkdown: withTitle,
          errorMessage: undefined,
        })
      } else {
        profile = patchProposalVolume(profile, volume.id, {
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
      profile = patchProposalVolume(profile, volume.id, {
        status: 'error',
        errorMessage: message,
      })
    }

    options.onProfileUpdate(profile)
  }

  return profile
}
