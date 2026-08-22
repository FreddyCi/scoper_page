import { runScoutAction } from '@/lib/scout/actions'
import {
  EVALUATE_RFP_JOURNEY_STEP_COUNT,
  evaluateRfpJourney,
} from '@/lib/scout/journeys/evaluate-rfp'
import { assertValidScoutSteps } from '@/lib/scout/types'
import { useSessionStore } from '@/store/session-store'
import { useScoutStore } from '@/store/scout-store'

const EVALUATE_RFP_ACTION_STEPS: Record<string, string | undefined> = {
  welcome: 'continue',
  'load-sample': 'load_sample_evaluation',
  'open-evaluation': 'navigate_profiles',
  'run-qualification': 'run_qualification',
  'read-criterion': 'focus_first_criterion',
  'compliance-matrix': undefined,
  instructions: undefined,
  'export-csv': 'export_matrix_csv',
  done: 'complete_journey',
}

/** Dev harness — Evaluate RFP journey wiring (BDA-294). */
export async function runScoutEvaluateRfpJourneyHarness(): Promise<void> {
  assertValidScoutSteps(evaluateRfpJourney)

  if (evaluateRfpJourney.steps.length !== EVALUATE_RFP_JOURNEY_STEP_COUNT) {
    throw new Error('runScoutEvaluateRfpJourneyHarness: unexpected evaluate journey step count')
  }

  for (const step of evaluateRfpJourney.steps) {
    const expectedAction = EVALUATE_RFP_ACTION_STEPS[step.id]
    if (expectedAction !== step.action) {
      throw new Error(
        `runScoutEvaluateRfpJourneyHarness: step "${step.id}" action mismatch (expected ${expectedAction ?? 'none'}, got ${step.action ?? 'none'})`,
      )
    }
  }

  const doneStep = evaluateRfpJourney.steps.find((step) => step.id === 'done')
  if (!doneStep?.secondaryActions?.includes('open_share_sheet')) {
    throw new Error('runScoutEvaluateRfpJourneyHarness: done step missing open_share_sheet secondary action')
  }
  if (!doneStep.secondaryActions.includes('open_upload')) {
    throw new Error('runScoutEvaluateRfpJourneyHarness: done step missing open_upload secondary action')
  }

  useSessionStore.getState().resetSession()
  useScoutStore.getState().resetScoutProgress()

  const focusEmpty = await runScoutAction('focus_first_criterion')
  if (focusEmpty.ok) {
    throw new Error('runScoutEvaluateRfpJourneyHarness: focus_first_criterion should fail on empty session')
  }

  useSessionStore.setState({
    profiles: [
      {
        profile_id: 'demo',
        source_doc_id: 'bid',
        verdict: 'likely',
        subject: { name: 'Demo Sub' },
        summary: 'Harness profile',
        criteria: [
          {
            id: 'c1',
            label: 'Sample shall clause',
            status: 'pass',
            citation: { doc_id: 'bid', block_id: 'block-1', excerpt: 'shall comply' },
          },
        ],
      },
    ],
  })

  const focus = await runScoutAction('focus_first_criterion')
  if (!focus.ok) {
    throw new Error(`runScoutEvaluateRfpJourneyHarness: focus_first_criterion failed: ${focus.error}`)
  }
  if (useSessionStore.getState().selectedCitation?.block_id !== 'block-1') {
    throw new Error('runScoutEvaluateRfpJourneyHarness: focus_first_criterion did not select citation')
  }

  const upload = await runScoutAction('open_upload')
  if (!upload.ok || !useSessionStore.getState().uploadPopupOpen) {
    throw new Error('runScoutEvaluateRfpJourneyHarness: open_upload did not open upload popup')
  }

  useSessionStore.getState().resetSession()
  useScoutStore.getState().resetScoutProgress()
}
