import type { ProposalVolume } from '@/lib/types'
import { compactFindClauseQuery } from '@/services/document-search'

export const PROPOSAL_GUARDRAIL_PHRASES = [
  'Mirror solicitation section headings exactly where applicable.',
  'Do not use generic marketing copy or boilerplate unrelated to the RFP.',
  'Align each subsection to the cited RFP requirements.',
  'Reference specific RFP sections (e.g. Section L/M) when requirements mention them.',
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

export type VolumePromptContext = {
  companyContext: string
  rfpFilename?: string
}

export type VolumePromptParts = {
  system: string
  user: string
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
}
