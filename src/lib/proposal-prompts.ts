import type { ProposalVolume } from '@/lib/types'

export const PROPOSAL_GUARDRAIL_PHRASES = [
  'Mirror solicitation section headings exactly where applicable.',
  'Do not use generic marketing copy or boilerplate unrelated to the RFP.',
  'Align each subsection to the cited RFP requirements.',
  'Reference specific RFP sections (e.g. Section L/M) when requirements mention them.',
] as const

export type VolumePromptContext = {
  companyContext: string
  rfpFilename?: string
}

/** System + user prompt for one proposal volume generation turn. */
export function buildVolumePrompt(
  volume: ProposalVolume,
  context: VolumePromptContext,
  excerpts: string[],
): string {
  const excerptBlock =
    excerpts.length > 0
      ? excerpts.map((line, index) => `${index + 1}. ${line}`).join('\n')
      : '(No RFP excerpts available — use the attached document context.)'

  const guardrails = PROPOSAL_GUARDRAIL_PHRASES.map((line) => `- ${line}`).join('\n')

  return [
    'You are drafting one volume of a complete proposal response to a government or commercial RFP.',
    '',
    'Guardrails:',
    guardrails,
    '',
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
    `Write markdown for the "${volume.title}" volume only. Use ## headings that mirror the solicitation structure. Be specific to the excerpts and context; avoid filler.`,
  ]
    .filter(Boolean)
    .join('\n')
}
