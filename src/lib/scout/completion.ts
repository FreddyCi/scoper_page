import { getProposalSetupState } from '@/lib/proposal-readiness'
import type {
  ProposalRequirementsProfile,
  RfpResultsProfile,
} from '@/lib/types'
import type { ScoutJourneyId, ScoutPersistedSnapshot } from '@/lib/scout/types'
import { getScoutJourney } from '@/lib/scout/journeys-map'
import type { SessionState } from '@/store/session-store'

/** Session fields used by step completion predicates (BDA-281). */
export type ScoutCompletionSession = Pick<
  SessionState,
  | 'documents'
  | 'mode'
  | 'workspaceView'
  | 'profiles'
  | 'evaluationDocId'
  | 'selectedCitation'
  | 'rfpRequirements'
  | 'rfpInstructionsProfile'
  | 'proposalRequirementsProfile'
  | 'companyContext'
  | 'pdfMarkDrawingMode'
  | 'contractReviewProfile'
>

/** UI/async signals not mirrored on session store yet (takeoff panel, stamp counts). */
export type ScoutCompletionContext = {
  stampCount?: number
  takeoffPanelOpen?: boolean
  markJumpTriggered?: boolean
}

export type ScoutStepCompletionKey = `${ScoutJourneyId}:${string}`

export function scoutStepKey(journeyId: ScoutJourneyId, stepId: string): ScoutStepCompletionKey {
  return `${journeyId}:${stepId}`
}

function qualificationProfileCount(session: ScoutCompletionSession): number {
  return session.profiles.length + (session.contractReviewProfile ? 1 : 0)
}

function hasDraftProposalContent(profile: ProposalRequirementsProfile | null): boolean {
  if (!profile) return false

  for (const volume of profile.volumes) {
    if (volume.status === 'draft' && (volume.bodyMarkdown?.trim().length ?? 0) > 0) {
      return true
    }
    if (
      volume.sections?.some(
        (section) => section.status === 'draft' && (section.bodyMarkdown?.trim().length ?? 0) > 0,
      )
    ) {
      return true
    }
  }

  return false
}

function evaluateRfpStepComplete(
  stepId: string,
  session: ScoutCompletionSession,
  scout: ScoutPersistedSnapshot,
): boolean {
  switch (stepId) {
    case 'welcome':
    case 'done':
      return false
    case 'load-sample':
      return session.documents.length >= 2 && session.evaluationDocId != null
    case 'open-evaluation':
      return session.mode === 'rfp' && session.workspaceView === 'profiles'
    case 'run-qualification':
      return qualificationProfileCount(session) > 0
    case 'read-criterion':
      return session.selectedCitation != null
    case 'compliance-matrix':
      return session.rfpRequirements.length > 0
    case 'instructions':
      return session.rfpInstructionsProfile != null
    case 'export-csv':
      return scout.exportTriggered.matrixCsv === true
    default:
      return false
  }
}

function generateProposalStepComplete(
  stepId: string,
  session: ScoutCompletionSession,
  scout: ScoutPersistedSnapshot,
): boolean {
  const setup = getProposalSetupState({
    documents: session.documents,
    evaluationDocId: session.evaluationDocId,
    companyContext: session.companyContext,
    proposalRequirementsProfile: session.proposalRequirementsProfile,
  })

  switch (stepId) {
    case 'done':
      return false
    case 'load-sample':
      return (
        session.mode === 'proposal' &&
        session.documents.length >= 1 &&
        session.evaluationDocId != null
      )
    case 'setup-panel':
      return (
        session.mode === 'proposal' &&
        session.workspaceView === 'profiles' &&
        setup.hasRfp &&
        setup.hasContext
      )
    case 'build-profile':
      return setup.hasProfile
    case 'generate-volume':
      return hasDraftProposalContent(session.proposalRequirementsProfile)
    case 'export-markdown':
      return scout.exportTriggered.proposalMarkdown === true
    default:
      return false
  }
}

function markTakeoffStepComplete(
  stepId: string,
  session: ScoutCompletionSession,
  scout: ScoutPersistedSnapshot,
  context: ScoutCompletionContext,
): boolean {
  switch (stepId) {
    case 'done':
      return false
    case 'load-sample':
      return session.documents.length >= 1 && session.workspaceView === 'split'
    case 'mark-mode':
      return session.pdfMarkDrawingMode
    case 'place-stamps':
      return (context.stampCount ?? 0) >= 2
    case 'takeoff-panel':
      return context.takeoffPanelOpen === true
    case 'jump-to-mark':
      return context.markJumpTriggered === true
    case 'export-csv':
      return scout.exportTriggered.takeoffCsv === true
    default:
      return false
  }
}

/**
 * Returns whether a journey step's completion criteria are met.
 * Steps with `manualContinue` never auto-complete — use explicit Continue (BDA-281).
 */
export function isStepComplete(
  journeyId: ScoutJourneyId,
  stepId: string,
  session: ScoutCompletionSession,
  scout: ScoutPersistedSnapshot,
  context: ScoutCompletionContext = {},
): boolean {
  const journey = getScoutJourney(journeyId)
  const step = journey.steps.find((candidate) => candidate.id === stepId)
  if (!step) return false
  if (step.manualContinue) return false

  switch (journeyId) {
    case 'evaluate_rfp':
      return evaluateRfpStepComplete(stepId, session, scout)
    case 'generate_proposal':
      return generateProposalStepComplete(stepId, session, scout)
    case 'mark_takeoff':
      return markTakeoffStepComplete(stepId, session, scout, context)
    default:
      return false
  }
}

/** Whether the active step at `stepIndex` is complete (convenience for ScoutProvider). */
export function isActiveStepComplete(
  session: ScoutCompletionSession,
  scout: ScoutPersistedSnapshot,
  context: ScoutCompletionContext = {},
): boolean {
  if (!scout.activeJourney) return false
  const journey = getScoutJourney(scout.activeJourney)
  const step = journey.steps[scout.stepIndex]
  if (!step) return false
  return isStepComplete(scout.activeJourney, step.id, session, scout, context)
}

/** Minimal session slice factory for harness/tests. */
export function createScoutCompletionSession(
  partial: Partial<ScoutCompletionSession> = {},
): ScoutCompletionSession {
  return {
    documents: [],
    mode: 'rfp',
    workspaceView: 'landing',
    profiles: [] as RfpResultsProfile[],
    evaluationDocId: null,
    selectedCitation: null,
    rfpRequirements: [],
    rfpInstructionsProfile: null,
    proposalRequirementsProfile: null,
    companyContext: '',
    pdfMarkDrawingMode: false,
    contractReviewProfile: null,
    ...partial,
  }
}
