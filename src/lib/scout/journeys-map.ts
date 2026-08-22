import { evaluateRfpJourney } from '@/lib/scout/journeys/evaluate-rfp'
import { generateProposalJourney } from '@/lib/scout/journeys/generate-proposal'
import { markTakeoffJourney } from '@/lib/scout/journeys/mark-takeoff'
import type { ScoutJourney, ScoutJourneyId } from '@/lib/scout/types'
import { SCOUT_JOURNEY_ACCENTS } from '@/lib/scout/types'

const SCOUT_JOURNEYS: Record<ScoutJourneyId, ScoutJourney> = {
  evaluate_rfp: evaluateRfpJourney,
  generate_proposal: generateProposalJourney,
  mark_takeoff: markTakeoffJourney,
}

/** Resolve a journey definition by id (BDA-279+). */
export function getScoutJourney(journeyId: ScoutJourneyId): ScoutJourney {
  return SCOUT_JOURNEYS[journeyId]
}

/** All registered journeys for harness iteration. */
export function listDefinedScoutJourneys(): ScoutJourney[] {
  return Object.values(SCOUT_JOURNEYS)
}

/** Expected accent for a journey id (harness helper). */
export function expectedScoutJourneyAccent(journeyId: ScoutJourneyId): string {
  return SCOUT_JOURNEY_ACCENTS[journeyId]
}
