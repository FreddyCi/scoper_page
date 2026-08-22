import { getScoutJourney, expectedScoutJourneyAccent } from '@/lib/scout/journeys-map'
import { evaluateRfpJourney } from '@/lib/scout/journeys/evaluate-rfp'
import { generateProposalJourney } from '@/lib/scout/journeys/generate-proposal'
import { markTakeoffJourney } from '@/lib/scout/journeys/mark-takeoff'
import type { ScoutJourney, ScoutJourneyId } from '@/lib/scout/types'
import { assertValidScoutSteps } from '@/lib/scout/types'

function assertJourneyShape(
  journey: ScoutJourney,
  expectedStepCount: number,
  expectedStepIds: string[],
): void {
  const expectedAccent = expectedScoutJourneyAccent(journey.id)
  if (journey.accent !== expectedAccent) {
    throw new Error(
      `assertJourneyShape: ${journey.id} accent should be ${expectedAccent}, got ${journey.accent}`,
    )
  }

  if (journey.steps.length !== expectedStepCount) {
    throw new Error(
      `assertJourneyShape: ${journey.id} expected ${expectedStepCount} steps, got ${journey.steps.length}`,
    )
  }

  assertValidScoutSteps(journey)

  const resolved = getScoutJourney(journey.id)
  if (resolved !== journey) {
    throw new Error(`assertJourneyShape: getScoutJourney mismatch for ${journey.id}`)
  }

  const stepIds = journey.steps.map((step) => step.id)
  if (stepIds.join('|') !== expectedStepIds.join('|')) {
    throw new Error(`assertJourneyShape: ${journey.id} step id order mismatch`)
  }
}

/** Dev harness — evaluate RFP journey shape and registry refs (BDA-279). */
export function runEvaluateRfpJourneyHarness(): void {
  assertJourneyShape(evaluateRfpJourney, 9, [
    'welcome',
    'load-sample',
    'open-evaluation',
    'run-qualification',
    'read-criterion',
    'compliance-matrix',
    'instructions',
    'export-csv',
    'done',
  ])
}

/** Dev harness — generate proposal journey (BDA-280). */
export function runGenerateProposalJourneyHarness(): void {
  assertJourneyShape(generateProposalJourney, 6, [
    'load-sample',
    'setup-panel',
    'build-profile',
    'generate-volume',
    'export-markdown',
    'done',
  ])
}

/** Dev harness — mark / takeoff journey (BDA-280). */
export function runMarkTakeoffJourneyHarness(): void {
  assertJourneyShape(markTakeoffJourney, 7, [
    'load-sample',
    'mark-mode',
    'place-stamps',
    'takeoff-panel',
    'jump-to-mark',
    'export-csv',
    'done',
  ])
}

/** Run all journey definition harnesses (BDA-279–280). */
export function runScoutJourneysHarness(): void {
  runEvaluateRfpJourneyHarness()
  runGenerateProposalJourneyHarness()
  runMarkTakeoffJourneyHarness()

  const ids: ScoutJourneyId[] = ['evaluate_rfp', 'generate_proposal', 'mark_takeoff']
  for (const id of ids) {
    getScoutJourney(id)
  }
}
