import {
  isActiveStepComplete,
  type ScoutCompletionContext,
  type ScoutCompletionSession,
} from '@/lib/scout/completion'
import { getScoutJourney } from '@/lib/scout/journeys-map'
import type { ScoutPersistedSnapshot } from '@/lib/scout/types'
import { createDefaultScoutSnapshot } from '@/store/scout-store'

/** Whether the active scout step should auto-advance (BDA-287). */
export function shouldAutoAdvanceScoutStep(
  session: ScoutCompletionSession,
  scout: ScoutPersistedSnapshot,
  context: ScoutCompletionContext = {},
): boolean {
  if (!scout.activeJourney || !scout.panelOpen) return false
  if (scout.awaitingManualContinue) return false

  const journey = getScoutJourney(scout.activeJourney)
  const step = journey.steps[scout.stepIndex]
  if (!step || step.manualContinue) return false
  if (scout.stepIndex >= journey.steps.length - 1) return false

  return isActiveStepComplete(session, scout, context)
}

/** Dev harness — auto-advance gating without infinite loops (BDA-287). */
export function runScoutStepEngineHarness(): void {
  const baseSession: ScoutCompletionSession = {
    documents: [],
    mode: 'rfp',
    workspaceView: 'landing',
    profiles: [],
    evaluationDocId: null,
    selectedCitation: null,
    rfpRequirements: [],
    rfpInstructionsProfile: null,
    proposalRequirementsProfile: null,
    companyContext: '',
    pdfMarkDrawingMode: false,
    contractReviewProfile: null,
  }

  const welcomeScout = {
    ...createDefaultScoutSnapshot(),
    activeJourney: 'evaluate_rfp' as const,
    stepIndex: 0,
    panelOpen: true,
  }

  if (shouldAutoAdvanceScoutStep(baseSession, welcomeScout)) {
    throw new Error('runScoutStepEngineHarness: welcome step must not auto-advance')
  }

  const loadSampleScout = { ...welcomeScout, stepIndex: 1 }
  if (
    !shouldAutoAdvanceScoutStep(
      {
        ...baseSession,
        documents: [
          {
            doc_id: 'a',
            filename: 'a.pdf',
            mime: 'application/pdf',
            role: 'baseline',
            uploaded_at: '',
          },
          {
            doc_id: 'b',
            filename: 'b.pdf',
            mime: 'application/pdf',
            role: 'unknown',
            uploaded_at: '',
          },
        ],
        evaluationDocId: 'a',
      },
      loadSampleScout,
    )
  ) {
    throw new Error('runScoutStepEngineHarness: load-sample should auto-advance when complete')
  }

  const manualScout = { ...loadSampleScout, awaitingManualContinue: true }
  if (shouldAutoAdvanceScoutStep(baseSession, manualScout)) {
    throw new Error('runScoutStepEngineHarness: awaitingManualContinue blocks advance')
  }

  const closedPanel = { ...loadSampleScout, panelOpen: false }
  if (shouldAutoAdvanceScoutStep(baseSession, closedPanel)) {
    throw new Error('runScoutStepEngineHarness: closed panel blocks advance')
  }
}
