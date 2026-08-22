export type {
  ScoutActionId,
  ScoutExportFlags,
  ScoutJourney,
  ScoutJourneyId,
  ScoutPersistedSnapshot,
  ScoutStep,
} from '@/lib/scout/types'
export {
  assertValidScoutSteps,
  isScoutActionId,
  isScoutJourneyId,
  SCOUT_ACTION_IDS,
  SCOUT_JOURNEY_ACCENTS,
  SCOUT_JOURNEY_IDS,
} from '@/lib/scout/types'

export type { ScoutTargetId } from '@/lib/scout/targets'
export {
  isScoutTargetId,
  queryScoutTarget,
  scoutTargetProps,
  SCOUT_TARGETS,
  SCOUT_TARGET_IDS,
} from '@/lib/scout/targets'

export { runScoutRegistryHarness } from '@/lib/scout/registry-harness'

export {
  evaluateRfpJourney,
  EVALUATE_RFP_JOURNEY_STEP_COUNT,
  generateProposalJourney,
  GENERATE_PROPOSAL_JOURNEY_STEP_COUNT,
  markTakeoffJourney,
  MARK_TAKEOFF_JOURNEY_STEP_COUNT,
} from '@/lib/scout/journeys'

export {
  getScoutJourney,
  listDefinedScoutJourneys,
  expectedScoutJourneyAccent,
} from '@/lib/scout/journeys-map'
export {
  runEvaluateRfpJourneyHarness,
  runGenerateProposalJourneyHarness,
  runMarkTakeoffJourneyHarness,
  runScoutJourneysHarness,
} from '@/lib/scout/journeys-harness'

export type {
  ScoutCompletionContext,
  ScoutCompletionSession,
  ScoutStepCompletionKey,
} from '@/lib/scout/completion'
export {
  createScoutCompletionSession,
  isActiveStepComplete,
  isStepComplete,
  scoutStepKey,
} from '@/lib/scout/completion'
export { runScoutCompletionHarness } from '@/lib/scout/completion-harness'
export { runScoutStepEngineHarness, shouldAutoAdvanceScoutStep } from '@/lib/scout/scout-step-engine'
export {
  padSpotlightRect,
  isSpotlightRectVisible,
  runScoutSpotlightGeometryHarness,
  SCOUT_SPOTLIGHT_PAD,
} from '@/lib/scout/spotlight-geometry'
export type { ScoutSpotlightRect } from '@/lib/scout/spotlight-geometry'
export {
  applyJourneyStart,
  confirmStartJourney,
  journeyStartConfirmCopy,
  readSessionGuardSnapshot,
  runScoutSessionGuardHarness,
  sessionHasWorkspaceContent,
  shouldConfirmJourneyStart,
} from '@/lib/scout/session-guard'
export type { JourneyStartConfirmCopy, SessionGuardSnapshot } from '@/lib/scout/session-guard'

export type { ScoutActionResult, RunScoutActionOptions } from '@/lib/scout/actions'
export { runScoutAction, ScoutActionDeferredError } from '@/lib/scout/actions'
export { runScoutActionsHarness } from '@/lib/scout/actions-harness'
export {
  scoutActionLabel,
  scoutStepStatus,
  SCOUT_ACTION_LABELS,
} from '@/lib/scout/scout-action-labels'
export { SCOUT_UI_EVENTS, dispatchScoutUiEvent } from '@/lib/scout/scout-ui-events'
