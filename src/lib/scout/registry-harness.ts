import {
  SCOUT_TARGETS,
  SCOUT_TARGET_IDS,
  isScoutTargetId,
} from '@/lib/scout/targets'
import {
  SCOUT_ACTION_IDS,
  SCOUT_JOURNEY_ACCENTS,
  SCOUT_JOURNEY_IDS,
  assertValidScoutSteps,
  isScoutActionId,
  isScoutJourneyId,
} from '@/lib/scout/types'

/** Dev harness — registry integrity for targets, actions, journeys (BDA-278). */
export function runScoutRegistryHarness(): void {
  const targetValues = Object.values(SCOUT_TARGETS)
  if (targetValues.length !== SCOUT_TARGET_IDS.length) {
    throw new Error('runScoutRegistryHarness: SCOUT_TARGET_IDS out of sync with SCOUT_TARGETS')
  }

  const uniqueTargets = new Set(targetValues)
  if (uniqueTargets.size !== targetValues.length) {
    throw new Error('runScoutRegistryHarness: duplicate SCOUT_TARGETS values')
  }

  for (const id of SCOUT_TARGET_IDS) {
    if (!isScoutTargetId(id)) {
      throw new Error(`runScoutRegistryHarness: invalid target id "${id}"`)
    }
  }

  const uniqueActions = new Set(SCOUT_ACTION_IDS)
  if (uniqueActions.size !== SCOUT_ACTION_IDS.length) {
    throw new Error('runScoutRegistryHarness: duplicate SCOUT_ACTION_IDS')
  }

  for (const id of SCOUT_ACTION_IDS) {
    if (!isScoutActionId(id)) {
      throw new Error(`runScoutRegistryHarness: invalid action id "${id}"`)
    }
  }

  for (const journeyId of SCOUT_JOURNEY_IDS) {
    if (!isScoutJourneyId(journeyId)) {
      throw new Error(`runScoutRegistryHarness: invalid journey id "${journeyId}"`)
    }
    if (!SCOUT_JOURNEY_ACCENTS[journeyId]) {
      throw new Error(`runScoutRegistryHarness: missing accent for journey "${journeyId}"`)
    }
  }

  assertValidScoutSteps({
    id: 'evaluate_rfp',
    title: 'Harness',
    description: 'Harness journey',
    accent: 'sky',
    steps: [
      {
        id: 'welcome',
        title: 'Welcome',
        body: 'Test',
        manualContinue: true,
        action: 'continue',
      },
      {
        id: 'matrix',
        title: 'Matrix',
        body: 'Test',
        target: SCOUT_TARGETS.complianceMatrix,
        action: 'export_matrix_csv',
      },
    ],
  })
}
