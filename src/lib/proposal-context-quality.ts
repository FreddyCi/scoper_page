import { PROPOSAL_CONTEXT_MIN_LENGTH } from '@/lib/proposal-readiness'

export type ProposalContextQualityResult = {
  ok: boolean
  warnings: string[]
}

const PLACEHOLDER_PATTERNS: { pattern: RegExp; message: string }[] = [
  { pattern: /\btbd\b|\bt\.?\s*b\.?\s*d\.?\b/i, message: 'Context contains "TBD" — add real company capabilities.' },
  { pattern: /\btodo\b|\bfixme\b/i, message: 'Context looks like a draft placeholder (TODO/FIXME).' },
  { pattern: /lorem\s+ipsum/i, message: 'Replace lorem ipsum with actual responder details.' },
  { pattern: /\bplaceholder\b|\[\s*insert/i, message: 'Context uses placeholder wording.' },
  { pattern: /\bcoming\s+soon\b|\bfill\s+in\b/i, message: 'Context is incomplete ("coming soon" / "fill in").' },
  { pattern: /^n\/?a\.?$/i, message: 'Context cannot be only "N/A".' },
  { pattern: /^test(ing)?\s*123?$/i, message: 'Context looks like test filler.' },
]

const MIN_DISTINCT_WORDS = 3

const MIN_LETTER_RATIO = 0.55

function trimmedContext(companyContext: string): string {
  return companyContext.trim()
}

function distinctWordCount(text: string): number {
  const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? []
  return new Set(words).size
}

function letterRatio(text: string): number {
  if (text.length === 0) return 0
  const letters = text.match(/[a-zA-Z]/g)?.length ?? 0
  return letters / text.length
}

function isMostlyRepeatedCharacter(text: string): boolean {
  if (text.length < PROPOSAL_CONTEXT_MIN_LENGTH) return false
  const counts = new Map<string, number>()
  for (const char of text.replace(/\s/g, '')) {
    counts.set(char, (counts.get(char) ?? 0) + 1)
  }
  const max = Math.max(...counts.values(), 0)
  return max / Math.max(text.replace(/\s/g, '').length, 1) > 0.85
}

/**
 * Validates responder / company context before profile build and generation (BDA-157).
 */
export function assessProposalContextQuality(companyContext: string): ProposalContextQualityResult {
  const warnings: string[] = []
  const trimmed = trimmedContext(companyContext)

  if (trimmed.length === 0) {
    return { ok: false, warnings: ['Add responder context describing your company and qualifications.'] }
  }

  if (trimmed.length < PROPOSAL_CONTEXT_MIN_LENGTH) {
    warnings.push(
      `Context is too short (${trimmed.length} chars). Use at least ${PROPOSAL_CONTEXT_MIN_LENGTH} characters.`,
    )
  }

  if (isMostlyRepeatedCharacter(trimmed)) {
    warnings.push('Context looks like repeated filler characters — add substantive company details.')
  }

  if (distinctWordCount(trimmed) < MIN_DISTINCT_WORDS) {
    warnings.push('Context needs more distinct terms (capabilities, certifications, differentiators).')
  }

  if (letterRatio(trimmed) < MIN_LETTER_RATIO) {
    warnings.push('Context should be mostly readable text, not numbers or symbols alone.')
  }

  for (const { pattern, message } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) {
      warnings.push(message)
    }
  }

  return { ok: warnings.length === 0, warnings }
}

/** Dev harness — substantive vs placeholder context (BDA-157) */
export function runProposalContextQualityHarness(): void {
  const good = assessProposalContextQuality(
    'Acme Systems is a CMMI Level 3 integrator specializing in cloud migration and managed services since 2004.',
  )
  if (!good.ok || good.warnings.length > 0) {
    throw new Error(`runProposalContextQualityHarness: good context failed: ${good.warnings.join('; ')}`)
  }

  const tbd = assessProposalContextQuality('TBD — company info pending review soon.')
  if (tbd.ok) {
    throw new Error('runProposalContextQualityHarness: TBD context should fail')
  }

  const empty = assessProposalContextQuality('   ')
  if (empty.ok) {
    throw new Error('runProposalContextQualityHarness: empty context should fail')
  }

  const short = assessProposalContextQuality('Too short')
  if (short.ok) {
    throw new Error('runProposalContextQualityHarness: short context should fail')
  }

  const repeated = assessProposalContextQuality('x'.repeat(PROPOSAL_CONTEXT_MIN_LENGTH))
  if (repeated.ok) {
    throw new Error('runProposalContextQualityHarness: repeated filler should fail')
  }
}
