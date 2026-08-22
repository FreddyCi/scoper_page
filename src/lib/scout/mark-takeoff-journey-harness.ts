import { runScoutAction } from '@/lib/scout/actions'
import {
  MARK_TAKEOFF_JOURNEY_STEP_COUNT,
  markTakeoffJourney,
} from '@/lib/scout/journeys/mark-takeoff'
import { assertValidScoutSteps } from '@/lib/scout/types'
import { useSessionStore } from '@/store/session-store'
import { useScoutStore } from '@/store/scout-store'

const MARK_TAKEOFF_ACTION_STEPS: Record<string, string | undefined> = {
  'load-sample': 'load_sample_markup',
  'mark-mode': 'enable_mark_mode',
  'place-stamps': undefined,
  'takeoff-panel': 'open_takeoff_panel',
  'jump-to-mark': 'jump_to_takeoff_mark',
  'export-csv': 'export_takeoff_csv',
  done: 'complete_journey',
}

/** Dev harness — Mark and takeoff journey wiring (BDA-296). */
export async function runScoutMarkTakeoffJourneyHarness(): Promise<void> {
  assertValidScoutSteps(markTakeoffJourney)

  if (markTakeoffJourney.steps.length !== MARK_TAKEOFF_JOURNEY_STEP_COUNT) {
    throw new Error('runScoutMarkTakeoffJourneyHarness: unexpected mark/takeoff journey step count')
  }

  for (const step of markTakeoffJourney.steps) {
    const expectedAction = MARK_TAKEOFF_ACTION_STEPS[step.id]
    if (expectedAction !== step.action) {
      throw new Error(
        `runScoutMarkTakeoffJourneyHarness: step "${step.id}" action mismatch (expected ${expectedAction ?? 'none'}, got ${step.action ?? 'none'})`,
      )
    }
  }

  const placeStampsStep = markTakeoffJourney.steps.find((step) => step.id === 'place-stamps')
  if (placeStampsStep?.target !== 'mark-stamp-tool') {
    throw new Error('runScoutMarkTakeoffJourneyHarness: place-stamps should spotlight stamp tool')
  }

  useSessionStore.getState().resetSession()
  useScoutStore.getState().resetScoutProgress()

  const jumpEmpty = await runScoutAction('jump_to_takeoff_mark')
  if (jumpEmpty.ok) {
    throw new Error('runScoutMarkTakeoffJourneyHarness: jump_to_takeoff_mark should fail on empty session')
  }

  const takeoffEmpty = await runScoutAction('open_takeoff_panel')
  if (!takeoffEmpty.ok) {
    throw new Error(`runScoutMarkTakeoffJourneyHarness: open_takeoff_panel failed: ${takeoffEmpty.error}`)
  }

  const exportEmpty = await runScoutAction('export_takeoff_csv')
  if (exportEmpty.ok) {
    throw new Error('runScoutMarkTakeoffJourneyHarness: export_takeoff_csv should fail without stamps')
  }

  useSessionStore.getState().resetSession()
  useScoutStore.getState().resetScoutProgress()
}
