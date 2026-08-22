/** Guided onboarding journey identifiers (Scoper Scout — BDA-277+). */
export type ScoutJourneyId = 'evaluate_rfp' | 'generate_proposal' | 'mark_takeoff'

export const SCOUT_JOURNEY_IDS: readonly ScoutJourneyId[] = [
  'evaluate_rfp',
  'generate_proposal',
  'mark_takeoff',
] as const

export function isScoutJourneyId(value: unknown): value is ScoutJourneyId {
  return typeof value === 'string' && (SCOUT_JOURNEY_IDS as readonly string[]).includes(value)
}

/** Export-step acknowledgements for completion predicates (BDA-281). */
export type ScoutExportFlags = {
  matrixCsv?: boolean
  proposalMarkdown?: boolean
  takeoffCsv?: boolean
}

export type ScoutPersistedSnapshot = {
  activeJourney: ScoutJourneyId | null
  stepIndex: number
  completedJourneys: ScoutJourneyId[]
  panelOpen: boolean
  dismissed: boolean
  awaitingManualContinue: boolean
  exportTriggered: ScoutExportFlags
}
