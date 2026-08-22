import { evaluateRfpJourney } from '@/lib/scout/journeys/evaluate-rfp'
import { getScoutJourney } from '@/lib/scout/journeys-map'
import { assertValidScoutSteps } from '@/lib/scout/types'

/** Dev harness — evaluate RFP journey shape and registry refs (BDA-279). */
export function runEvaluateRfpJourneyHarness(): void {
  const journey = evaluateRfpJourney

  if (journey.id !== 'evaluate_rfp') {
    throw new Error('runEvaluateRfpJourneyHarness: unexpected journey id')
  }

  if (journey.accent !== 'sky') {
    throw new Error('runEvaluateRfpJourneyHarness: evaluate_rfp accent should be sky')
  }

  if (journey.steps.length !== 9) {
    throw new Error(`runEvaluateRfpJourneyHarness: expected 9 steps, got ${journey.steps.length}`)
  }

  assertValidScoutSteps(journey)

  const resolved = getScoutJourney('evaluate_rfp')
  if (resolved !== journey) {
    throw new Error('runEvaluateRfpJourneyHarness: getScoutJourney mismatch')
  }

  const stepIds = journey.steps.map((step) => step.id)
  const expectedIds = [
    'welcome',
    'load-sample',
    'open-evaluation',
    'run-qualification',
    'read-criterion',
    'compliance-matrix',
    'instructions',
    'export-csv',
    'done',
  ]
  if (stepIds.join('|') !== expectedIds.join('|')) {
    throw new Error('runEvaluateRfpJourneyHarness: step id order mismatch')
  }
}
