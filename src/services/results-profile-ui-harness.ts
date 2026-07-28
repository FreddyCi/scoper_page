import type { CitationRef, CriterionResult, RfpResultsProfile, RfpVerdict } from '@/lib/types'
import { buildMockRfpProfiles } from '@/lib/profile-stub'
import {
  selectVisibleProfiles,
  useSessionStore,
} from '@/store/session-store'

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

/** Dev harness — grid binds store profiles[] and opens profiles workspace (BDA-041) */
export function runResultsProfileGridHarness(): void {
  const store = useSessionStore.getState()
  store.resetSession()
  store.setMode('rfp')

  const documents = [
    {
      doc_id: 'grid-harness-rfp',
      filename: 'City-RFP-2026.pdf',
      mime: 'application/pdf',
      role: 'unknown' as const,
      uploaded_at: new Date().toISOString(),
    },
    {
      doc_id: 'grid-harness-bid-a',
      filename: 'Bidder-A-Response.pdf',
      mime: 'application/pdf',
      role: 'unknown' as const,
      uploaded_at: new Date().toISOString(),
    },
    {
      doc_id: 'grid-harness-bid-b',
      filename: 'Bidder-B-Response.pdf',
      mime: 'application/pdf',
      role: 'unknown' as const,
      uploaded_at: new Date().toISOString(),
    },
  ]

  store.setDocuments(documents)
  const profiles = buildMockRfpProfiles(documents)

  if (profiles.length !== 3) {
    throw new Error('ResultsProfileGridHarness: expected 3 mock profiles')
  }

  store.setProfiles(profiles)
  store.setWorkspaceView('profiles')

  const state = useSessionStore.getState()
  if (state.workspaceView !== 'profiles') {
    throw new Error('ResultsProfileGridHarness: expected profiles workspace view')
  }
  if (state.mode !== 'rfp') {
    throw new Error('ResultsProfileGridHarness: expected rfp mode')
  }
  if (state.profiles.length !== 3) {
    throw new Error('ResultsProfileGridHarness: expected 3 profiles in store')
  }

  const visible = selectVisibleProfiles(state)
  if (visible.length !== 3) {
    throw new Error('ResultsProfileGridHarness: selectVisibleProfiles failed')
  }

  const verdicts = new Set(profiles.map((profile) => profile.verdict))
  if (verdicts.size < 2) {
    throw new Error('ResultsProfileGridHarness: expected varied verdict badges across profiles')
  }

  store.resetSession()
  const afterReset = useSessionStore.getState()
  if (afterReset.profiles.length !== 0 || afterReset.workspaceView !== 'landing') {
    throw new Error('ResultsProfileGridHarness: resetSession failed')
  }
}
