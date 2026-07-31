import type { ProposalPackageKind } from '@/lib/proposal-package-classifier'
import type { ProposalVolume } from '@/lib/types'
import {
  compactFindClauseQuery,
  FIND_CLAUSE_QUERY_MAX_LENGTH,
} from '@/services/document-search'

export type SectionFindClauseIntent = 'primary' | 'review'

const PACKAGE_QUERY_TERMS: Record<
  ProposalPackageKind,
  { primary: string[]; review: string[] }
> = {
  solicitation: {
    primary: ['Section L', 'Section M', 'solicitation requirement', 'proposal instruction'],
    review: ['compliance', 'evaluation factor', 'mandatory requirement'],
  },
  contract_framework: {
    primary: ['contract clause', 'MSA obligation', 'terms and conditions', 'compliance'],
    review: ['clause language', 'redline', 'exception', 'obligation evidence'],
  },
  unknown: {
    primary: ['procurement requirement', 'document section'],
    review: ['compliance', 'supporting evidence'],
  },
}

const REQUIREMENT_SUMMARY_MAX = 120

function trimRequirementSummary(summary: string): string {
  const normalized = summary.replace(/\s+/g, ' ').trim()
  if (normalized.length <= REQUIREMENT_SUMMARY_MAX) {
    return normalized
  }
  return normalized.slice(0, REQUIREMENT_SUMMARY_MAX).trim()
}

export type BuildSectionFindClauseQueryInput = {
  volume: ProposalVolume
  sectionTitle: string
  packageKind: ProposalPackageKind
  intent?: SectionFindClauseIntent
}

/**
 * Compact ECP find_clause query for one proposal section (BDA-175).
 * Vocabulary differs for solicitation vs contract/MSA packages.
 */
export function buildSectionFindClauseQuery(
  volumeOrInput: ProposalVolume | BuildSectionFindClauseQueryInput,
  sectionTitle?: string,
  packageKind?: ProposalPackageKind,
  intent: SectionFindClauseIntent = 'primary',
): string {
  const input: BuildSectionFindClauseQueryInput =
    typeof sectionTitle === 'string' && packageKind != null
      ? {
          volume: volumeOrInput as ProposalVolume,
          sectionTitle,
          packageKind,
          intent,
        }
      : {
          ...(volumeOrInput as BuildSectionFindClauseQueryInput),
          intent: (volumeOrInput as BuildSectionFindClauseQueryInput).intent ?? 'primary',
        }

  const { volume, sectionTitle: title, packageKind: kind, intent: queryIntent } = input
  const vocabulary = PACKAGE_QUERY_TERMS[kind] ?? PACKAGE_QUERY_TERMS.unknown
  const tail =
    queryIntent === 'review' ? vocabulary.review.slice(0, 3) : vocabulary.primary.slice(0, 3)

  const parts = [
    title.trim(),
    volume.title.trim(),
    ...(volume.solicitationRefs?.slice(0, 2) ?? []),
    trimRequirementSummary(volume.requirementSummary),
    ...tail,
  ].filter((part) => part.length > 0)

  return compactFindClauseQuery(parts.join(' '))
}

/** Review retrieve path — same builder with review intent (max 2 ECP calls/section). */
export function buildSectionReviewFindClauseQuery(
  volume: ProposalVolume,
  sectionTitle: string,
  packageKind: ProposalPackageKind,
): string {
  return buildSectionFindClauseQuery({ volume, sectionTitle, packageKind, intent: 'review' })
}

/** Dev harness — package-aware sectional queries (BDA-175) */
export function runProposalSectionFindClauseHarness(): void {
  const volume: ProposalVolume = {
    id: 'vol-1',
    title: 'Technical approach',
    requirementSummary: 'Describe methodology and staffing per Section L.',
    solicitationRefs: ['Section L.1'],
    status: 'pending',
  }

  const solicitationQuery = buildSectionFindClauseQuery(volume, 'Insurance', 'solicitation')
  const contractQuery = buildSectionFindClauseQuery(volume, 'Insurance', 'contract_framework')

  if (solicitationQuery.length === 0 || solicitationQuery.length > FIND_CLAUSE_QUERY_MAX_LENGTH) {
    throw new Error('runProposalSectionFindClauseHarness: solicitation query length invalid')
  }
  if (contractQuery.length === 0 || contractQuery.length > FIND_CLAUSE_QUERY_MAX_LENGTH) {
    throw new Error('runProposalSectionFindClauseHarness: contract query length invalid')
  }
  if (solicitationQuery === contractQuery) {
    throw new Error('runProposalSectionFindClauseHarness: packageKind should change query text')
  }
  if (!/section l|solicitation/i.test(solicitationQuery)) {
    throw new Error('runProposalSectionFindClauseHarness: solicitation vocabulary missing')
  }
  if (!/contract|msa|clause/i.test(contractQuery)) {
    throw new Error('runProposalSectionFindClauseHarness: contract vocabulary missing')
  }

  const reviewQuery = buildSectionReviewFindClauseQuery(volume, 'Insurance', 'solicitation')
  if (reviewQuery === solicitationQuery) {
    throw new Error('runProposalSectionFindClauseHarness: review intent should differ from primary')
  }
  if (reviewQuery.length > FIND_CLAUSE_QUERY_MAX_LENGTH) {
    throw new Error('runProposalSectionFindClauseHarness: review query exceeded max length')
  }

  const longSummaryVolume: ProposalVolume = {
    ...volume,
    requirementSummary: `${'Long requirement narrative. '.repeat(80)}Section L staffing.`,
  }
  const compact = buildSectionFindClauseQuery(longSummaryVolume, 'Staffing', 'solicitation')
  if (compact.length > FIND_CLAUSE_QUERY_MAX_LENGTH) {
    throw new Error('runProposalSectionFindClauseHarness: compactFindClauseQuery should cap length')
  }
  if (!compact.includes('Staffing')) {
    throw new Error('runProposalSectionFindClauseHarness: section title should survive compaction')
  }
}
