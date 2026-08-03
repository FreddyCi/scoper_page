import type { ProposalPackageKind } from '@/lib/proposal-package-classifier'
import { buildProposalHandoffBlock, type ProposalHandoffState } from '@/lib/proposal-context-roll'
import { CHARS_PER_TOKEN_ESTIMATE } from '@/lib/page-context-manager'
import type { ProposalAnalysisRef, ProposalVolume, ProposalVolumeSection } from '@/lib/types'
import { compactFindClauseQuery } from '@/services/document-search'

export const PROPOSAL_ANALYSIS_REFS_PROMPT_MAX = 3
const PROPOSAL_ANALYSIS_CITATION_EXCERPT_MAX = 160

export const PROPOSAL_SECTION_ONLY_LINE =
  'Write only this section in markdown. Do not output other volumes, sections, or writer instructions.'

export const PROPOSAL_GUARDRAIL_PHRASES = [
  'Mirror solicitation section headings exactly where applicable.',
  'Do not use generic marketing copy or boilerplate unrelated to the RFP.',
  'Align each subsection to the cited RFP requirements.',
  'Reference specific RFP sections (e.g. Section L/M) when requirements mention them.',
  'Do not copy table-of-contents lines, dot leaders, or trailing page numbers from the PDF.',
  'Write only the current section; do not repeat paragraphs already drafted for other sections in this volume.',
  'Do not include prompt labels, source filenames, or meta commentary in the markdown output.',
] as const

/** Fixed system instructions for every proposal volume generation turn. */
export const PROPOSAL_VOLUME_SYSTEM_PROMPT = [
  'You are drafting one volume of a complete proposal response to a government or commercial RFP.',
  '',
  'Guardrails:',
  ...PROPOSAL_GUARDRAIL_PHRASES.map((line) => `- ${line}`),
  '',
  'Output markdown only for the requested volume. Use ## headings that mirror the solicitation structure.',
  'Be specific to the RFP excerpts and responder context; avoid filler and generic sales language.',
].join('\n')

function packageKindLabel(packageKind: ProposalPackageKind): string {
  switch (packageKind) {
    case 'contract_framework':
      return 'contract or master agreement'
    case 'solicitation':
      return 'solicitation RFP'
    default:
      return 'procurement document'
  }
}

/** System instructions for one sectional draft turn (BDA-162). */
export function buildSectionSystemPrompt(packageKind: ProposalPackageKind): string {
  const docLabel = packageKindLabel(packageKind)
  const toneLine =
    packageKind === 'contract_framework'
      ? 'Use compliance-oriented language: accept, exception, or redline stance tied to the cited clauses.'
      : 'Use proposal response language aligned to the cited solicitation requirements.'

  return [
    `You are drafting a single section of a complete proposal response to a ${docLabel}.`,
    toneLine,
    '',
    'Guardrails:',
    ...PROPOSAL_GUARDRAIL_PHRASES.map((line) => `- ${line}`),
    '',
    PROPOSAL_SECTION_ONLY_LINE,
    'Use ## / ### headings appropriate to this section only.',
    'Be specific to the excerpts and responder context; avoid filler and generic sales language.',
    'Prefer a few substantive paragraphs over inventing numbered "SECTION N" headings unless they appear in the excerpts.',
  ].join('\n')
}

export const PROPOSAL_SECTION_SYSTEM_PROMPT = buildSectionSystemPrompt('solicitation')

export type VolumePromptContext = {
  companyContext: string
  rfpFilename?: string
}

export type VolumePromptParts = {
  system: string
  user: string
}

export type SectionPromptInput = {
  section: ProposalVolumeSection
  volume: ProposalVolume
  handoff: ProposalHandoffState | null
  excerpts: string[]
  context: VolumePromptContext
  packageKind?: ProposalPackageKind
  handoffChunkIndex?: number
}

function analysisRefPromptRank(status: ProposalAnalysisRef['status']): number {
  switch (status) {
    case 'fail':
      return 0
    case 'warn':
      return 1
    default:
      return 2
  }
}

function truncateAnalysisCitationExcerpt(excerpt: string): string {
  const trimmed = excerpt.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= PROPOSAL_ANALYSIS_CITATION_EXCERPT_MAX) {
    return trimmed
  }
  return `${trimmed.slice(0, PROPOSAL_ANALYSIS_CITATION_EXCERPT_MAX - 1)}…`
}

/** Capped RFP Analysis criteria block for sectional user prompts (BDA-210). */
export function buildProposalAnalysisRefsBlock(
  analysisRefs: ProposalAnalysisRef[] | undefined,
): string {
  if (!analysisRefs?.length) {
    return ''
  }

  const selected = [...analysisRefs]
    .sort((left, right) => analysisRefPromptRank(left.status) - analysisRefPromptRank(right.status))
    .slice(0, PROPOSAL_ANALYSIS_REFS_PROMPT_MAX)

  const lines = selected.map((ref) => {
    const citationPart = ref.citation?.excerpt
      ? ` — "${truncateAnalysisCitationExcerpt(ref.citation.excerpt)}"`
      : ''
    return `  • [${ref.status}] ${ref.label}${citationPart}`
  })

  return [
    'RFP ANALYSIS FINDINGS (address gaps in this section where relevant):',
    ...lines,
  ].join('\n')
}

/** User turn for one proposal section (includes optional UCW handoff block). */
export function buildSectionUserPrompt(input: SectionPromptInput): string {
  const {
    section,
    volume,
    handoff,
    excerpts,
    context,
    packageKind = handoff?.packageKind ?? 'solicitation',
    handoffChunkIndex = 1,
  } = input

  const excerptBlock =
    excerpts.length > 0
      ? excerpts.map((line, index) => `${index + 1}. ${line}`).join('\n')
      : '(No RFP excerpts available — use the attached document context.)'

  const handoffBlock =
    handoff != null ? buildProposalHandoffBlock(handoff, handoffChunkIndex) : ''

  const analysisBlock = buildProposalAnalysisRefsBlock(volume.analysisRefs)

  const priorInVolume =
    handoff != null
      ? handoff.completedSections.filter((entry) => entry.volumeId === volume.id).length
      : 0
  const continuityNote =
    priorInVolume > 0
      ? 'Earlier subsections in this volume are summarized in the handoff — write fresh prose for the current section title only (no repeated boilerplate from prior subsections).'
      : ''

  return [
    handoffBlock,
    handoffBlock ? '' : null,
    continuityNote,
    continuityNote ? '' : null,
    analysisBlock,
    analysisBlock ? '' : null,
    `Package kind: ${packageKind}`,
    `Volume: ${volume.title}`,
    volume.solicitationRefs?.length
      ? `Solicitation refs: ${volume.solicitationRefs.join(', ')}`
      : '',
    `Volume requirements: ${volume.requirementSummary}`,
    `Section to write: ${section.title}`,
    context.rfpFilename ? `Source document: ${context.rfpFilename}` : '',
    '',
    'Responder company context:',
    context.companyContext.trim(),
    '',
    'Relevant RFP excerpts for this section:',
    excerptBlock,
    '',
    `Write markdown for the "${section.title}" section only (within the "${volume.title}" volume).`,
    PROPOSAL_SECTION_ONLY_LINE,
  ]
    .filter((line) => line !== null && line !== '')
    .join('\n')
}

export function buildSectionPromptParts(input: SectionPromptInput): VolumePromptParts {
  const packageKind = input.packageKind ?? input.handoff?.packageKind ?? 'solicitation'
  return {
    system: buildSectionSystemPrompt(packageKind),
    user: buildSectionUserPrompt(input),
  }
}

/** Combined prompt for isolated sectional Scoper sends. */
export function buildSectionPrompt(input: SectionPromptInput): string {
  const { system, user } = buildSectionPromptParts(input)
  return [system, '', '---', '', user].join('\n')
}

/** User turn: volume metadata, responder context, and RFP excerpts. */
export function buildVolumeUserPrompt(
  volume: ProposalVolume,
  context: VolumePromptContext,
  excerpts: string[],
): string {
  const excerptBlock =
    excerpts.length > 0
      ? excerpts.map((line, index) => `${index + 1}. ${line}`).join('\n')
      : '(No RFP excerpts available — use the attached document context.)'

  return [
    `Volume title: ${volume.title}`,
    volume.solicitationRefs?.length
      ? `Solicitation refs: ${volume.solicitationRefs.join(', ')}`
      : '',
    `Requirements to address: ${volume.requirementSummary}`,
    context.rfpFilename ? `RFP document: ${context.rfpFilename}` : '',
    '',
    'Responder company context:',
    context.companyContext.trim(),
    '',
    'Relevant RFP excerpts:',
    excerptBlock,
    '',
    `Write markdown for the "${volume.title}" volume only.`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildVolumePromptParts(
  volume: ProposalVolume,
  context: VolumePromptContext,
  excerpts: string[],
): VolumePromptParts {
  return {
    system: PROPOSAL_VOLUME_SYSTEM_PROMPT,
    user: buildVolumeUserPrompt(volume, context, excerpts),
  }
}

/** Combined prompt for single-message Scoper turns (MVP path). */
export function buildVolumePrompt(
  volume: ProposalVolume,
  context: VolumePromptContext,
  excerpts: string[],
): string {
  const { system, user } = buildVolumePromptParts(volume, context, excerpts)
  return [system, '', '---', '', user].join('\n')
}

/** Compact query for ECP `@demo/document.find_clause` (BDA-127). */
export function buildVolumeFindClauseQuery(volume: ProposalVolume): string {
  const raw = [
    volume.title,
    volume.requirementSummary,
    ...(volume.solicitationRefs ?? []),
  ]
    .join(' — ')
    .trim()

  return compactFindClauseQuery(raw)
}

/** Dev harness — guardrails, context, and find-clause query (BDA-115) */
export function runProposalPromptsHarness(): void {
  const volume: ProposalVolume = {
    id: 'vol-1',
    title: 'Technical approach',
    requirementSummary: 'Describe installation methodology per Section L.',
    solicitationRefs: ['Section L.1'],
    status: 'pending',
  }

  const context: VolumePromptContext = {
    companyContext: 'Certified roofing subcontractor with twenty years of experience.',
    rfpFilename: 'City-RFP-2026.pdf',
  }
  const excerpts = ['Section L.1 requires a detailed methodology and schedule.']

  const parts = buildVolumePromptParts(volume, context, excerpts)
  const combined = buildVolumePrompt(volume, context, excerpts)
  const findQuery = buildVolumeFindClauseQuery(volume)

  if (!parts.system.includes('generic marketing') || !parts.user.includes('Technical approach')) {
    throw new Error('runProposalPromptsHarness: system/user parts missing guardrails or title')
  }

  for (const phrase of PROPOSAL_GUARDRAIL_PHRASES) {
    if (!parts.system.includes(phrase)) {
      throw new Error(`runProposalPromptsHarness: missing guardrail phrase in system prompt`)
    }
  }

  if (
    !parts.user.includes(context.companyContext) ||
    !parts.user.includes('Section L.1') ||
    !parts.user.includes(context.rfpFilename!)
  ) {
    throw new Error('runProposalPromptsHarness: user prompt missing context, refs, or filename')
  }

  if (!combined.includes('---') || !combined.includes(parts.user)) {
    throw new Error('runProposalPromptsHarness: combined prompt should merge system and user')
  }

  if (!findQuery.includes('Technical') || findQuery.length === 0) {
    throw new Error('runProposalPromptsHarness: find-clause query should retain volume focus')
  }

  const section: ProposalVolumeSection = {
    id: 'sec-insurance',
    title: 'Insurance requirements',
    findClauseQuery: 'insurance coverage bonding',
    status: 'pending',
  }

  const handoff = {
    activeGoal: 'Draft complete proposal for the IT services RFP',
    completedSections: [],
    topicMemory: [],
    pendingSections: [{ volumeId: volume.id, sectionId: section.id, title: section.title }],
    packageKind: 'solicitation' as const,
    doNotRepeat: [],
  }

  const sectionParts = buildSectionPromptParts({
    section,
    volume,
    handoff,
    excerpts,
    context,
  })
  const sectionCombined = buildSectionPrompt({
    section,
    volume,
    handoff,
    excerpts,
    context,
  })

  if (sectionParts.system.includes('all volumes') || sectionParts.user.includes('all volumes')) {
    throw new Error('runProposalPromptsHarness: section prompt must not ask for all volumes')
  }
  if (!sectionParts.system.includes(PROPOSAL_SECTION_ONLY_LINE)) {
    throw new Error('runProposalPromptsHarness: section system missing section-only guardrail')
  }
  if (!sectionParts.user.includes('Insurance requirements') || !sectionParts.user.includes('PROPOSAL CONTEXT HANDOFF')) {
    throw new Error('runProposalPromptsHarness: section user missing title or handoff')
  }

  const maxPromptChars = 8192 * CHARS_PER_TOKEN_ESTIMATE * 0.75
  if (sectionCombined.length > maxPromptChars) {
    throw new Error('runProposalPromptsHarness: section prompt exceeds 8K budget estimate')
  }

  const contractSystem = buildSectionSystemPrompt('contract_framework')
  if (!contractSystem.includes('contract or master agreement')) {
    throw new Error('runProposalPromptsHarness: contract package system tone missing')
  }

  const volumeWithAnalysis: ProposalVolume = {
    ...volume,
    analysisRefs: [
      { criterionId: 'c-pass', label: 'Past performance reference', status: 'pass' },
      { criterionId: 'c-warn', label: 'Bonding documentation', status: 'warn' },
      {
        criterionId: 'c-fail',
        label: 'Insurance limits',
        status: 'fail',
        citation: {
          doc_id: 'rfp-1',
          block_id: 'block-ins',
          excerpt: 'Minimum $2M general liability required for all subcontractors.',
        },
      },
      { criterionId: 'c-fail-2', label: 'Additional insured endorsement', status: 'fail' },
    ],
  }

  const analysisUser = buildSectionUserPrompt({
    section,
    volume: volumeWithAnalysis,
    handoff: null,
    excerpts,
    context,
  })

  if (!analysisUser.includes('RFP ANALYSIS FINDINGS')) {
    throw new Error('runProposalPromptsHarness: section user missing analysis findings block')
  }
  if (
    !analysisUser.includes('[fail] Insurance limits') ||
    !analysisUser.includes('Minimum $2M general liability')
  ) {
    throw new Error('runProposalPromptsHarness: analysis block missing fail criterion + citation')
  }
  if (!analysisUser.includes('[warn] Bonding documentation')) {
    throw new Error('runProposalPromptsHarness: analysis block missing warn criterion')
  }
  if (analysisUser.includes('[pass]')) {
    throw new Error('runProposalPromptsHarness: capped analysis block should prioritize fail/warn')
  }
}
