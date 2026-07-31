import type { CitationRef, ScopeCreepFlag, ScopeCreepProfile, ScopeCreepSeverity, ScopeCreepVerdict } from '@/lib/types'
import { buildMockCreepProfiles } from '@/lib/creep-profile-stub'
import {
  selectVisibleProfiles,
  useSessionStore,
} from '@/store/session-store'

const REQUIRED_VERDICTS: ScopeCreepVerdict[] = ['aligned', 'possible_creep', 'creep']
const REQUIRED_SEVERITIES: ScopeCreepSeverity[] = ['high', 'medium', 'low']

export function assertCreepProfileShape(profile: ScopeCreepProfile): void {
  if (!profile.profile_id || !profile.baseline_doc_id || !profile.candidate_doc_id) {
    throw new Error('CreepProfileUiHarness: profile missing ids')
  }

  if (!REQUIRED_VERDICTS.includes(profile.verdict)) {
    throw new Error(`CreepProfileUiHarness: invalid verdict ${profile.verdict}`)
  }

  if (!profile.summary?.trim()) {
    throw new Error('CreepProfileUiHarness: summary required')
  }

  if (profile.flags.length === 0) {
    throw new Error('CreepProfileUiHarness: flags required')
  }

  for (const flag of profile.flags) {
    assertCreepFlagShape(flag)
  }

  const severitySet = new Set(profile.flags.map((flag) => flag.severity))
  for (const severity of REQUIRED_SEVERITIES) {
    if (!severitySet.has(severity)) {
      throw new Error(`CreepProfileUiHarness: missing flag severity ${severity}`)
    }
  }
}

function assertCreepFlagShape(flag: ScopeCreepFlag): void {
  if (!flag.id || !flag.summary || !flag.flag_type) {
    throw new Error('CreepProfileUiHarness: flag missing id, summary, or flag_type')
  }

  if (!REQUIRED_SEVERITIES.includes(flag.severity)) {
    throw new Error(`CreepProfileUiHarness: invalid flag severity ${flag.severity}`)
  }
}

/** Simulates CreepFlagRow click routing for harness tests */
export function invokeCreepFlagClick(
  flag: ScopeCreepFlag,
  onFlagClick: (citation: CitationRef) => void,
): boolean {
  const citation = flag.evidence[0]
  if (!citation) return false
  onFlagClick(citation)
  return true
}

/** Dev harness — mock creep profile shape + flag click callback (BDA-071) */
export function runCreepProfileUiHarness(): void {
  const baseline = {
    doc_id: 'creep-ui-baseline',
    filename: 'Baseline-SOW.pdf',
    mime: 'application/pdf',
    role: 'baseline' as const,
    uploaded_at: new Date().toISOString(),
  }

  const change = {
    doc_id: 'creep-ui-change',
    filename: 'Change-Addendum.pdf',
    mime: 'application/pdf',
    role: 'change_request' as const,
    uploaded_at: new Date().toISOString(),
  }

  const [profile] = buildMockCreepProfiles([baseline, change])
  if (!profile) {
    throw new Error('CreepProfileUiHarness: expected mock creep profile')
  }

  assertCreepProfileShape(profile)

  let clickedBlockId: string | null = null
  const cited = profile.flags.find((flag) => flag.evidence[0])
  if (!cited?.evidence[0]) {
    throw new Error('CreepProfileUiHarness: expected cited flag')
  }

  const didClick = invokeCreepFlagClick(cited, (citation) => {
    clickedBlockId = citation.block_id
  })

  if (!didClick || clickedBlockId !== cited.evidence[0].block_id) {
    throw new Error('CreepProfileUiHarness: onFlagClick callback failed')
  }
}

/** Dev harness — creep grid binds store creepProfiles[] in proposal mode (legacy BDA-071 UI) */
export function runCreepProfileGridHarness(): void {
  const store = useSessionStore.getState()
  store.resetSession()
  store.setMode('proposal')

  const baseline = {
    doc_id: 'creep-grid-baseline',
    filename: 'Baseline-SOW.pdf',
    mime: 'application/pdf',
    role: 'baseline' as const,
    uploaded_at: new Date().toISOString(),
  }

  const change = {
    doc_id: 'creep-grid-change',
    filename: 'Change-Addendum.pdf',
    mime: 'application/pdf',
    role: 'change_request' as const,
    uploaded_at: new Date().toISOString(),
  }

  store.setDocuments([baseline, change])
  const profiles = buildMockCreepProfiles([baseline, change])

  if (profiles.length !== 1) {
    throw new Error('CreepProfileGridHarness: expected 1 mock creep profile')
  }

  store.setCreepProfiles(profiles)
  store.setWorkspaceView('profiles')

  const state = useSessionStore.getState()
  if (state.workspaceView !== 'profiles') {
    throw new Error('CreepProfileGridHarness: expected profiles workspace view')
  }
  if (state.mode !== 'proposal') {
    throw new Error('CreepProfileGridHarness: expected proposal mode')
  }
  if (state.creepProfiles.length !== 1) {
    throw new Error('CreepProfileGridHarness: expected 1 creep profile in store')
  }

  const visible = selectVisibleProfiles(state)
  if (visible.length !== 1) {
    throw new Error('CreepProfileGridHarness: selectVisibleProfiles failed')
  }

  const severities = new Set(profiles[0]?.flags.map((flag) => flag.severity) ?? [])
  if (severities.size < 3) {
    throw new Error('CreepProfileGridHarness: expected varied severity badges across flags')
  }

  store.resetSession()
  const afterReset = useSessionStore.getState()
  if (afterReset.creepProfiles.length !== 0 || afterReset.workspaceView !== 'landing') {
    throw new Error('CreepProfileGridHarness: resetSession failed')
  }
}
