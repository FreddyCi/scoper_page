import type { CitationRef, CriterionResult, RfpResultsProfile, RfpVerdict } from '@/lib/types'
import { buildMockRfpProfiles } from '@/lib/profile-stub'

const REQUIRED_VERDICTS: RfpVerdict[] = ['likely', 'might', 'unlikely']
const REQUIRED_STATUSES = ['pass', 'warn', 'fail'] as const

export function assertResultsProfileShape(profile: RfpResultsProfile): void {
  if (!profile.profile_id || !profile.source_doc_id) {
    throw new Error('ResultsProfileUiHarness: profile missing ids')
  }

  if (!REQUIRED_VERDICTS.includes(profile.verdict)) {
    throw new Error(`ResultsProfileUiHarness: invalid verdict ${profile.verdict}`)
  }

  if (!profile.subject.name?.trim()) {
    throw new Error('ResultsProfileUiHarness: subject.name required')
  }

  if (!profile.summary?.trim()) {
    throw new Error('ResultsProfileUiHarness: summary required')
  }

  if (profile.criteria.length === 0) {
    throw new Error('ResultsProfileUiHarness: criteria required')
  }

  for (const criterion of profile.criteria) {
    assertCriterionShape(criterion)
  }

  const statusSet = new Set(profile.criteria.map((item) => item.status))
  for (const status of REQUIRED_STATUSES) {
    if (!statusSet.has(status)) {
      throw new Error(`ResultsProfileUiHarness: missing criterion status ${status}`)
    }
  }
}

function assertCriterionShape(criterion: CriterionResult): void {
  if (!criterion.id || !criterion.label) {
    throw new Error('ResultsProfileUiHarness: criterion missing id or label')
  }

  if (!REQUIRED_STATUSES.includes(criterion.status)) {
    throw new Error(`ResultsProfileUiHarness: invalid criterion status ${criterion.status}`)
  }
}

/** Simulates CriterionRow click routing for harness tests */
export function invokeCriterionClick(
  criterion: CriterionResult,
  onCriterionClick: (citation: CitationRef) => void,
): boolean {
  if (!criterion.citation) return false
  onCriterionClick(criterion.citation)
  return true
}

/** Dev harness — mock profile shape + criterion click callback (BDA-040) */
export function runResultsProfileUiHarness(): void {
  const [profile] = buildMockRfpProfiles([
    {
      doc_id: 'ui-harness-doc',
      filename: 'Bidder-A-Response.pdf',
      mime: 'application/pdf',
      role: 'unknown',
      uploaded_at: new Date().toISOString(),
    },
  ])

  if (!profile) {
    throw new Error('ResultsProfileUiHarness: expected mock profile')
  }

  assertResultsProfileShape(profile)

  if (!profile.subject.role) {
    throw new Error('ResultsProfileUiHarness: expected subject.role on mock profile')
  }

  let clickedBlockId: string | null = null
  const cited = profile.criteria.find((item) => item.citation)
  if (!cited?.citation) {
    throw new Error('ResultsProfileUiHarness: expected cited criterion')
  }

  const didClick = invokeCriterionClick(cited, (citation) => {
    clickedBlockId = citation.block_id
  })

  if (!didClick || clickedBlockId !== cited.citation.block_id) {
    throw new Error('ResultsProfileUiHarness: onCriterionClick callback failed')
  }

  const uncited = profile.criteria.find((item) => !item.citation)
  if (!uncited) {
    throw new Error('ResultsProfileUiHarness: expected uncited criterion')
  }

  let uncitedClicked = false
  invokeCriterionClick(uncited, () => {
    uncitedClicked = true
  })

  if (uncitedClicked) {
    throw new Error('ResultsProfileUiHarness: uncited criterion must not fire callback')
  }
}
