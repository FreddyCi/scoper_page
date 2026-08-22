import type { ProposalRequirementsProfile } from '@/lib/types'

export type ProposalDraftValidationResult = {
  ok: boolean
  reasons: string[]
}

export type CanExportProposalProfileResult = {
  ok: boolean
  reasons: string[]
}

/** Minimum trimmed markdown length for a section or whole-volume draft. */
export const PROPOSAL_DRAFT_MIN_CHARS = 280

const PLACEHOLDER_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /draft placeholder\s*[—-]\s*connect the on-device model/i,
    reason: 'Draft is still the offline placeholder stub.',
  },
  { pattern: /\bplaceholder\b.*\b(on-device|full generation)\b/i, reason: 'Body is placeholder text, not proposal content.' },
  { pattern: /\[\s*tbd\s*\]/i, reason: 'Body contains [TBD] placeholders.' },
  { pattern: /lorem\s+ipsum/i, reason: 'Body contains lorem ipsum filler.' },
  { pattern: /^_no draft content for this volume\._$/im, reason: 'Volume has no draft content marker.' },
]

const META_OUTLINE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bhere is (an? )?(outline|table of contents|structure)\b/i, reason: 'Body is a meta-outline, not proposal prose.' },
  { pattern: /\bmeta[- ]?outline\b/i, reason: 'Body describes an outline instead of writing the section.' },
  { pattern: /\b(i will|we will) (now )?write (the )?(full|complete) (section|volume|proposal)\b/i, reason: 'Body defers writing instead of delivering content.' },
  { pattern: /^#\s*volume\s*[i\d]+/im, reason: 'Body looks like a volume index heading, not section content.' },
  {
    pattern: /^(?:\d+\.\s+\*\*[^*]+\*\*\s*\n){3,}/m,
    reason: 'Body is mostly a numbered outline list.',
  },
]

const WRITER_INSTRUCTION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /you are drafting one volume of a complete proposal/i, reason: 'System prompt leaked into export body.' },
  { pattern: /\bguardrails:\s*\n/i, reason: 'Writer guardrails leaked into export body.' },
  { pattern: /output markdown only for the requested volume/i, reason: 'Writer instructions leaked into export body.' },
  { pattern: /write markdown for the ["']/i, reason: 'Volume writer instruction leaked into export body.' },
  { pattern: /mirror solicitation section headings exactly/i, reason: 'Prompt guardrail text appears in export body.' },
  { pattern: /do not use generic marketing copy/i, reason: 'Prompt guardrail text appears in export body.' },
  { pattern: /relevant rfp excerpts:/i, reason: 'Prompt template (RFP excerpts block) leaked into body.' },
  { pattern: /responder company context:/i, reason: 'Prompt template (company context block) leaked into body.' },
  { pattern: /\brfp analysis findings\b/i, reason: 'Prompt analysis block leaked into export body.' },
  { pattern: /source document:\s*.+\.pdf/i, reason: 'Source filename metadata leaked into export body.' },
]

const TOC_OR_FAKE_SECTION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\.{4,}\s*\d+\s*$/m,
    reason: 'Body contains table-of-contents dot leaders.',
  },
  {
    pattern: /^##\s+SECTION\s+\d+/im,
    reason: 'Body uses generic numbered SECTION headings instead of substantive prose.',
  },
  {
    pattern: /\([Vv]ol[-\w]*\/sec[-\w-]+\)/,
    reason: 'Body echoes internal volume/section ids from the proposal handoff.',
  },
  {
    pattern: /\b[A-Z0-9][\w\s.-]{12,}\.pdf\b/i,
    reason: 'Body includes raw source PDF filenames instead of proposal prose.',
  },
]

/** Long PDF filenames echoed from prompts or cover pages — stripped before validation. */
const RAW_PDF_FILENAME_PATTERN = /\b[A-Z0-9][\w\s.-]{12,}\.pdf\b/gi

export type SanitizeProposalDraftOptions = {
  knownFilenames?: string[]
}

/**
 * Remove prompt leaks and raw solicitation filenames from sectional drafts before quality checks.
 */
export function sanitizeProposalDraftMarkdown(
  markdown: string,
  options: SanitizeProposalDraftOptions = {},
): string {
  let result = markdown.replace(/^Source document:\s*.+\.pdf\s*$/gim, '')

  for (const filename of options.knownFilenames ?? []) {
    const trimmed = filename.trim()
    if (!trimmed) continue
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'gi'), 'the solicitation document')
  }

  result = result.replace(RAW_PDF_FILENAME_PATTERN, 'the solicitation document')
  return result.replace(/\n{3,}/g, '\n\n').trim()
}

export function isLikelyPdfFilenameLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/^source document:\s*.+\.pdf/i.test(trimmed)) return true
  return RAW_PDF_FILENAME_PATTERN.test(trimmed)
}

export type ValidateProposalDraftOptions = {
  /** Volume or section title for clearer error messages. */
  label?: string
  minChars?: number
}

function prefixReason(label: string | undefined, reason: string): string {
  return label ? `${label}: ${reason}` : reason
}

/**
 * Validates a single section or full volume markdown before marking draft / allowing export.
 */
export function validateProposalVolumeDraft(
  markdown: string,
  options: ValidateProposalDraftOptions = {},
): ProposalDraftValidationResult {
  const reasons: string[] = []
  const trimmed = markdown.trim()
  const minChars = options.minChars ?? PROPOSAL_DRAFT_MIN_CHARS
  const label = options.label

  if (trimmed.length === 0) {
    reasons.push(prefixReason(label, 'Draft is empty.'))
    return { ok: false, reasons }
  }

  if (trimmed.length < minChars) {
    reasons.push(
      prefixReason(
        label,
        `Draft is too short (${trimmed.length} chars; need at least ${minChars}).`,
      ),
    )
  }

  for (const { pattern, reason } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push(prefixReason(label, reason))
    }
  }

  for (const { pattern, reason } of META_OUTLINE_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push(prefixReason(label, reason))
    }
  }

  for (const { pattern, reason } of WRITER_INSTRUCTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push(prefixReason(label, reason))
    }
  }

  for (const { pattern, reason } of TOC_OR_FAKE_SECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push(prefixReason(label, reason))
    }
  }

  const fakeSectionHeadings = trimmed.match(/^##\s+SECTION\s+\d+/gim)?.length ?? 0
  if (fakeSectionHeadings >= 2) {
    reasons.push(
      prefixReason(label, 'Body repeats generic SECTION N headings (likely outline spam).'),
    )
  }

  const outlineOnly =
    (trimmed.match(/^\s*\d+\.\s+\*\*/gm)?.length ?? 0) >= 4 &&
    trimmed.replace(/\d+\.\s+\*\*[^*]+\*\*/g, '').trim().length < minChars / 2
  if (outlineOnly) {
    reasons.push(prefixReason(label, 'Draft is outline bullets without substantive paragraphs.'))
  }

  return { ok: reasons.length === 0, reasons }
}

/**
 * Full-profile export gate — every volume must be `draft` with passing body quality (BDA-158).
 */
export function canExportProposalProfile(
  profile: ProposalRequirementsProfile,
): CanExportProposalProfileResult {
  const reasons: string[] = []

  if (profile.volumes.length === 0) {
    return { ok: false, reasons: ['Proposal profile has no volumes.'] }
  }

  for (const volume of profile.volumes) {
    const label = volume.title.trim() || volume.id

    if (volume.status === 'pending' || volume.status === 'generating') {
      reasons.push(`${label}: Volume is not generated yet.`)
      continue
    }

    if (volume.status === 'error') {
      reasons.push(
        `${label}: Generation failed${volume.errorMessage ? ` (${volume.errorMessage})` : ''}.`,
      )
      continue
    }

    if (volume.status !== 'draft') {
      reasons.push(`${label}: Unexpected volume status "${volume.status}".`)
      continue
    }

    const body = volume.bodyMarkdown?.trim() ?? ''
    const validation = validateProposalVolumeDraft(body, { label })
    if (!validation.ok) {
      reasons.push(...validation.reasons)
    }
  }

  return { ok: reasons.length === 0, reasons }
}

const HARNESS_GOOD_DRAFT = `
## Technical approach

Acme Systems will execute cloud migration in three phases aligned to Section L.1 requirements.
Our CMMI Level 3 quality system defines entry/exit criteria for each phase.

### Staffing and schedule

A dedicated program manager and two senior engineers support the client for twelve months,
with weekly status reporting and risk registers maintained in the shared project workspace.
`.trim()

const HARNESS_BAD_META = `
# Volume 1: Response

Here is an outline for the technical volume:

1. **Introduction**
2. **Methodology**
3. **Staffing**
4. **Risk management**

We will write the full section in the next step.
`.trim()

const HARNESS_BAD_LEAK = `
Guardrails:
- Mirror solicitation section headings exactly where applicable.

Write markdown for the "Technical approach" volume only.

## Technical approach

Short stub.
`.trim()

const HARNESS_BAD_STUB = `
# Master Services Agreement Response

## Draft response

> Draft placeholder — connect the on-device model for full generation.
`.trim()

const HARNESS_BAD_HANDOFF_LEAK = `
## Scope of Work

Materials (Vol-0-scope/sec-3-materials-and-work-furnished-by-othe) must comply with Section 22.
`.trim()

/** Dev harness — export quality rules (BDA-158) */
export function runProposalExportQualityHarness(): void {
  const good = validateProposalVolumeDraft(HARNESS_GOOD_DRAFT, { label: 'Technical' })
  if (!good.ok) {
    throw new Error(`runProposalExportQualityHarness: good draft failed: ${good.reasons.join('; ')}`)
  }

  const meta = validateProposalVolumeDraft(HARNESS_BAD_META)
  if (meta.ok) {
    throw new Error('runProposalExportQualityHarness: meta-outline should fail')
  }

  const leak = validateProposalVolumeDraft(HARNESS_BAD_LEAK)
  if (leak.ok) {
    throw new Error('runProposalExportQualityHarness: prompt leak should fail')
  }

  const handoffLeak = validateProposalVolumeDraft(HARNESS_BAD_HANDOFF_LEAK)
  if (handoffLeak.ok) {
    throw new Error('runProposalExportQualityHarness: handoff id leak should fail')
  }

  const scoutFilename =
    'DPR CONSTRUCTION - Fully Executed MSA - Pro-Bel Enterprises - 2025.pdf'
  const filenameLeak = `## Scope of Work\n\nPer ${scoutFilename}, Pro-Bel will coordinate deliverables.\n\n${'Substantive alignment text for the master services agreement scope section. '.repeat(4)}`
  const sanitizedFilename = sanitizeProposalDraftMarkdown(filenameLeak, {
    knownFilenames: [scoutFilename],
  })
  const filenameAfterSanitize = validateProposalVolumeDraft(sanitizedFilename, {
    label: 'Scope of Work',
  })
  if (!filenameAfterSanitize.ok) {
    throw new Error(
      `runProposalExportQualityHarness: filename sanitize should pass: ${filenameAfterSanitize.reasons.join('; ')}`,
    )
  }

  const stub = validateProposalVolumeDraft(HARNESS_BAD_STUB)
  if (stub.ok) {
    throw new Error('runProposalExportQualityHarness: placeholder stub should fail')
  }

  const profileOk: ProposalRequirementsProfile = {
    profile_id: 'q-harness',
    rfp_doc_id: 'rfp-1',
    summary: 'Harness profile.',
    built_at: new Date().toISOString(),
    packageKind: 'solicitation',
    packageWarnings: [],
    volumes: [
      {
        id: 'v1',
        title: 'Technical approach',
        requirementSummary: 'Methodology.',
        status: 'draft',
        bodyMarkdown: HARNESS_GOOD_DRAFT,
      },
    ],
  }

  if (!canExportProposalProfile(profileOk).ok) {
    throw new Error('runProposalExportQualityHarness: valid profile should export')
  }

  const profileBad: ProposalRequirementsProfile = {
    ...profileOk,
    volumes: [
      {
        id: 'v1',
        title: 'Technical approach',
        requirementSummary: 'Methodology.',
        status: 'draft',
        bodyMarkdown: HARNESS_BAD_STUB,
      },
    ],
  }

  if (canExportProposalProfile(profileBad).ok) {
    throw new Error('runProposalExportQualityHarness: stub profile should not export')
  }

  const profilePending: ProposalRequirementsProfile = {
    ...profileOk,
    volumes: [{ ...profileOk.volumes[0]!, status: 'pending', bodyMarkdown: undefined }],
  }

  if (canExportProposalProfile(profilePending).ok) {
    throw new Error('runProposalExportQualityHarness: pending volume should block export')
  }
}
