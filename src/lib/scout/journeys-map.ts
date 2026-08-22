import { evaluateRfpJourney } from '@/lib/scout/journeys/evaluate-rfp'
import type { ScoutJourney, ScoutJourneyId } from '@/lib/scout/types'

const SCOUT_JOURNEYS: Partial<Record<ScoutJourneyId, ScoutJourney>> = {
  evaluate_rfp: evaluateRfpJourney,
}

/** Resolve a journey definition by id (BDA-279+). */
export function getScoutJourney(journeyId: ScoutJourneyId): ScoutJourney {
  const journey = SCOUT_JOURNEYS[journeyId]
  if (!journey) {
    throw new Error(`getScoutJourney: journey "${journeyId}" is not defined yet`)
  }
  return journey
}

/** Registered journeys for harness iteration. */
export function listDefinedScoutJourneys(): ScoutJourney[] {
  return Object.values(SCOUT_JOURNEYS).filter((journey): journey is ScoutJourney => journey != null)
}
