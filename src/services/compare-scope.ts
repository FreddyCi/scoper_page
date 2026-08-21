import { fetchDocumentBlocks } from '@/services/document-blocks'
import {
  fetchScopeCreepProfiles,
  persistScopeCreepProfile,
} from '@/services/scope-creep-store'
import { countObligationMatches } from '@/lib/obligation-pattern'
import type { BlockRecord, CitationRef, DocumentMeta, ScopeCreepFlag, ScopeCreepProfile } from '@/lib/types'
import { blockToCitation } from '@/lib/types'
import { useSessionStore } from '@/store/session-store'

export type CompareScopeInput = {
  baselineDocId: string
  candidateDocId: string
}

export type CompareScopeResult = {
  profiles: ScopeCreepProfile[]
  summary: string
}

export type FlagCreepResult = {
  flags: ScopeCreepFlag[]
  summary: string
  profile: ScopeCreepProfile
}

const TOKEN_PATTERN = /[a-z0-9]{4,}/gi

const DELIVERABLE_PATTERN =
  /(?:shall|must)\s+(?:provide|deliver|implement|supply)|additional\s+\w+|new\s+deliverable|beyond\s+(?:the\s+)?baseline/i

const TIMELINE_PATTERN =
  /\b(\d{1,3})\s*(?:calendar\s+)?(day|days|week|weeks|month|months)\b|\b(ninety|one hundred twenty|120|90)\b/gi

const BUDGET_PATTERN =
  /\b(budget|cost|fee|pricing|payment)\b.*\b(increase|additional|expanded|extra)\b|\b\d+\s*%\s*(?:increase|uplift)\b/i

const EXCLUSION_PATTERN = /\b(excluded|exclusion|out of scope|not included|except as noted)\b/i

function tokenSet(text: string): Set<string> {
  const matches = text.toLowerCase().match(TOKEN_PATTERN) ?? []
  return new Set(matches)
}

function overlapRatio(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const token of left) {
    if (right.has(token)) shared += 1
  }
  return shared / Math.min(left.size, right.size)
}

function citationFromBlock(block: BlockRecord): CitationRef {
  return blockToCitation(block)
}

function makeFlag(
  id: string,
  flagType: string,
  severity: ScopeCreepFlag['severity'],
  summary: string,
  evidence: CitationRef[],
): ScopeCreepFlag {
  return { id, flag_type: flagType, severity, summary, evidence }
}

function detectNewDeliverables(
  baselineBlocks: BlockRecord[],
  candidateBlocks: BlockRecord[],
): ScopeCreepFlag[] {
  const flags: ScopeCreepFlag[] = []
  const baselineTokens = baselineBlocks.map((block) => tokenSet(block.text))

  for (const block of candidateBlocks) {
    if (!DELIVERABLE_PATTERN.test(block.text)) continue

    const candidateTokens = tokenSet(block.text)
    const similar = baselineTokens.some((tokens) => overlapRatio(tokens, candidateTokens) >= 0.35)
    if (similar) continue

    flags.push(
      makeFlag(
        `new-deliverable-${block.block_id}`,
        'new_deliverable',
        'high',
        truncateSummary(block.text, 'New deliverable or expanded obligation in change document'),
        [citationFromBlock(block)],
      ),
    )
  }

  return flags
}

function detectShallMustShifts(
  baselineBlocks: BlockRecord[],
  candidateBlocks: BlockRecord[],
): ScopeCreepFlag[] {
  const flags: ScopeCreepFlag[] = []

  for (const block of candidateBlocks) {
    const candidateMatches = countObligationMatches(block.text)
    if (candidateMatches === 0) continue

    const candidateTokens = tokenSet(block.text)
    const relatedBaseline = baselineBlocks.filter(
      (baseline) => overlapRatio(tokenSet(baseline.text), candidateTokens) >= 0.25,
    )

    const baselineMatches = relatedBaseline.reduce(
      (total, baseline) => total + countObligationMatches(baseline.text),
      0,
    )

    if (candidateMatches > baselineMatches) {
      flags.push(
        makeFlag(
          `shall-shift-${block.block_id}`,
          'shall_must_shift',
          'medium',
          truncateSummary(
            block.text,
            'Stronger shall/must obligation language in change document vs baseline',
          ),
          [citationFromBlock(block)],
        ),
      )
    }
  }

  return flags
}

function detectTimelineGaps(
  baselineBlocks: BlockRecord[],
  candidateBlocks: BlockRecord[],
): ScopeCreepFlag[] {
  const baselineText = baselineBlocks.map((block) => block.text).join('\n')
  const flags: ScopeCreepFlag[] = []

  for (const block of candidateBlocks) {
    if (!TIMELINE_PATTERN.test(block.text)) continue

    const candidateTimeline = extractTimelineTokens(block.text)
    const baselineTimeline = extractTimelineTokens(baselineText)
    const novel = candidateTimeline.some((token) => !baselineTimeline.includes(token))

    if (novel || baselineTimeline.length === 0) {
      flags.push(
        makeFlag(
          `timeline-${block.block_id}`,
          'timeline_gap',
          'low',
          truncateSummary(block.text, 'Timeline or delivery window differs from baseline'),
          [citationFromBlock(block)],
        ),
      )
    }
  }

  return flags
}

function extractTimelineTokens(text: string): string[] {
  const tokens: string[] = []
  for (const match of text.matchAll(TIMELINE_PATTERN)) {
    tokens.push(match[0].toLowerCase())
  }
  return tokens
}

function detectBudgetGaps(
  baselineBlocks: BlockRecord[],
  candidateBlocks: BlockRecord[],
): ScopeCreepFlag[] {
  const baselineText = baselineBlocks.map((block) => block.text).join('\n').toLowerCase()
  const flags: ScopeCreepFlag[] = []

  for (const block of candidateBlocks) {
    if (!BUDGET_PATTERN.test(block.text)) continue
    if (baselineText.includes(block.text.toLowerCase().slice(0, 40))) continue

    flags.push(
      makeFlag(
        `budget-${block.block_id}`,
        'budget_gap',
        'medium',
        truncateSummary(block.text, 'Budget or commercial increase not present in baseline scope'),
        [citationFromBlock(block)],
      ),
    )
  }

  return flags
}

function detectMissingClauses(
  baselineBlocks: BlockRecord[],
  candidateBlocks: BlockRecord[],
): ScopeCreepFlag[] {
  const candidateText = candidateBlocks.map((block) => block.text).join('\n').toLowerCase()
  const flags: ScopeCreepFlag[] = []

  for (const block of baselineBlocks) {
    if (!EXCLUSION_PATTERN.test(block.text)) continue

    const keywords = [...tokenSet(block.text)].slice(0, 8)
    const carriedForward = keywords.some((token) => candidateText.includes(token))
    if (carriedForward) continue

    flags.push(
      makeFlag(
        `missing-clause-${block.block_id}`,
        'missing_clause',
        'medium',
        truncateSummary(
          block.text,
          'Baseline exclusion or boundary clause not reflected in change document',
        ),
        [citationFromBlock(block)],
      ),
    )
  }

  return flags
}

function truncateSummary(text: string, fallback: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return fallback
  return cleaned.length > 140 ? `${cleaned.slice(0, 137)}…` : cleaned
}

function dedupeFlags(flags: ScopeCreepFlag[]): ScopeCreepFlag[] {
  const seen = new Set<string>()
  const unique: ScopeCreepFlag[] = []

  for (const flag of flags) {
    const key = `${flag.flag_type}:${flag.evidence[0]?.block_id ?? flag.id}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(flag)
  }

  return unique
}

/** Baseline blocks plus any supporting context documents tagged in the session */
async function fetchBaselineContextBlocks(
  baselineDocId: string,
  documents: DocumentMeta[],
): Promise<BlockRecord[]> {
  const baselineBlocks = await fetchDocumentBlocks(baselineDocId)
  const supportingDocIds = documents
    .filter((doc) => doc.role === 'supporting')
    .map((doc) => doc.doc_id)

  if (supportingDocIds.length === 0) {
    return baselineBlocks
  }

  const supportingBlocks = await Promise.all(
    supportingDocIds.map((docId) => fetchDocumentBlocks(docId)),
  )

  return [...baselineBlocks, ...supportingBlocks.flat()]
}

function buildProfile(input: CompareScopeInput, flags: ScopeCreepFlag[]): ScopeCreepProfile {
  const profile: ScopeCreepProfile = {
    profile_id: `creep-${input.baselineDocId}-${input.candidateDocId}`,
    baseline_doc_id: input.baselineDocId,
    candidate_doc_id: input.candidateDocId,
    verdict: 'aligned',
    flags,
    summary: '',
  }

  if (flags.some((flag) => flag.severity === 'high')) {
    profile.verdict = 'creep'
  } else if (flags.length > 0) {
    profile.verdict = 'possible_creep'
  }

  profile.summary =
    flags.length === 0
      ? 'No scope drift flags detected between the baseline and change documents.'
      : `Detected ${flags.length} scope drift flag${flags.length === 1 ? '' : 's'} between baseline and change documents.`

  return profile
}

/** Cross-doc scope comparison with rule-based creep heuristics (BDA-072) */
export async function compareScope(input: CompareScopeInput): Promise<CompareScopeResult> {
  const documents = useSessionStore.getState().documents
  const [baselineBlocks, candidateBlocks] = await Promise.all([
    fetchBaselineContextBlocks(input.baselineDocId, documents),
    fetchDocumentBlocks(input.candidateDocId),
  ])

  if (baselineBlocks.length === 0 || candidateBlocks.length === 0) {
    throw new Error('compare_scope requires ingested blocks in both baseline and candidate documents')
  }

  const flags = dedupeFlags([
    ...detectNewDeliverables(baselineBlocks, candidateBlocks),
    ...detectShallMustShifts(baselineBlocks, candidateBlocks),
    ...detectTimelineGaps(baselineBlocks, candidateBlocks),
    ...detectBudgetGaps(baselineBlocks, candidateBlocks),
    ...detectMissingClauses(baselineBlocks, candidateBlocks),
  ])

  const profile = buildProfile(input, flags)
  await persistScopeCreepProfile(profile)

  const profiles = await fetchScopeCreepProfiles()
  useSessionStore.getState().setCreepProfiles(profiles)

  return {
    profiles,
    summary: profile.summary,
  }
}

/** Return creep flags for a baseline/candidate pair — runs compare_scope if needed (BDA-072) */
export async function flagCreep(input: CompareScopeInput): Promise<FlagCreepResult> {
  const result = await compareScope(input)
  const profile =
    result.profiles.find(
      (item) =>
        item.baseline_doc_id === input.baselineDocId &&
        item.candidate_doc_id === input.candidateDocId,
    ) ?? buildProfile(input, [])

  return {
    flags: profile.flags,
    summary: profile.summary,
    profile,
  }
}

/** Dev harness — baseline + change markdown pair yields flags with evidence (BDA-072) */
export async function runCompareScopeHarness(): Promise<void> {
  const { ingestFile } = await import('@/services/ingest-router')

  const baselineMarkdown = [
    '# Baseline SOW',
    '',
    'Monthly PDF reporting package is included in scope.',
    'Vendor integrations with non-approved third-party systems are excluded from scope.',
    'All deliverables shall be completed within one hundred twenty (120) calendar days.',
  ].join('\n')

  const changeMarkdown = [
    '# Change Addendum',
    '',
    'Contractor shall provide additional analytics dashboards beyond the baseline reporting package.',
    'All deliverables shall be completed within ninety (90) calendar days.',
    'Budget increase of 15% approved for expanded scope.',
  ].join('\n')

  const baseline = await ingestFile(
    new File([baselineMarkdown], 'baseline-sow.md', { type: 'text/markdown' }),
  )
  const change = await ingestFile(
    new File([changeMarkdown], 'change-addendum.md', { type: 'text/markdown' }),
  )

  const result = await compareScope({
    baselineDocId: baseline.doc_id,
    candidateDocId: change.doc_id,
  })

  const profile = result.profiles.find(
    (item) =>
      item.baseline_doc_id === baseline.doc_id && item.candidate_doc_id === change.doc_id,
  )

  if (!profile || profile.flags.length === 0) {
    throw new Error('runCompareScopeHarness failed: expected at least one scope flag')
  }

  if (!profile.flags.some((flag) => flag.evidence.length > 0)) {
    throw new Error('runCompareScopeHarness failed: expected evidence citations on flags')
  }

  const flagResult = await flagCreep({
    baselineDocId: baseline.doc_id,
    candidateDocId: change.doc_id,
  })

  if (flagResult.flags.length !== profile.flags.length) {
    throw new Error('runCompareScopeHarness failed: flag_creep flag count mismatch')
  }

  useSessionStore.getState().resetSession()
}
