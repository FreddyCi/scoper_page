import type { BrandAccent } from '@/lib/brand-accent'

import type { ScoutTargetId } from '@/lib/scout/targets'
import { isScoutTargetId } from '@/lib/scout/targets'

/** Imperative coach actions dispatched from ScoutPanel (BDA-282). */
export type ScoutActionId =
  | 'continue'
  | 'load_sample_evaluation'
  | 'load_sample_proposal'
  | 'load_sample_markup'
  | 'navigate_profiles'
  | 'navigate_split'
  | 'run_qualification'
  | 'enable_mark_mode'
  | 'open_takeoff_panel'
  | 'export_matrix_csv'
  | 'export_proposal_markdown'
  | 'export_takeoff_csv'
  | 'open_share_sheet'
  | 'open_upload'
  | 'focus_first_criterion'
  | 'complete_journey'

export const SCOUT_ACTION_IDS: readonly ScoutActionId[] = [
  'continue',
  'load_sample_evaluation',
  'load_sample_proposal',
  'load_sample_markup',
  'navigate_profiles',
  'navigate_split',
  'run_qualification',
  'enable_mark_mode',
  'open_takeoff_panel',
  'export_matrix_csv',
  'export_proposal_markdown',
  'export_takeoff_csv',
  'open_share_sheet',
  'open_upload',
  'focus_first_criterion',
  'complete_journey',
] as const

export function isScoutActionId(value: unknown): value is ScoutActionId {
  return typeof value === 'string' && (SCOUT_ACTION_IDS as readonly string[]).includes(value)
}

/** One checklist row in a guided journey. */
export type ScoutStep = {
  id: string
  title: string
  body: string
  /** Spotlight anchor; omit for welcome / done steps shown in panel only. */
  target?: ScoutTargetId
  /** Primary “Do this” button; omit when step auto-completes on predicate only. */
  action?: ScoutActionId
  /** Optional footer buttons (e.g. share / upload on done step). */
  secondaryActions?: ScoutActionId[]
  /** Step-level accent override; falls back to journey accent. */
  accent?: BrandAccent
  /** When true, completion requires explicit Continue (not auto-advance on predicate). */
  manualContinue?: boolean
}

/** Declarative journey definition (steps filled in BDA-279 / BDA-280). */
export type ScoutJourney = {
  id: ScoutJourneyId
  title: string
  description: string
  accent: BrandAccent
  steps: ScoutStep[]
}

/** Guided onboarding journey identifiers (Scoper Scout — BDA-277+). */
export type ScoutJourneyId = 'evaluate_rfp' | 'generate_proposal' | 'mark_takeoff'

export const SCOUT_JOURNEY_IDS: readonly ScoutJourneyId[] = [
  'evaluate_rfp',
  'generate_proposal',
  'mark_takeoff',
] as const

export function isScoutJourneyId(value: unknown): value is ScoutJourneyId {
  return typeof value === 'string' && (SCOUT_JOURNEY_IDS as readonly string[]).includes(value)
}

/** Default panel accent per journey (maps to existing BrandAccent tokens). */
export const SCOUT_JOURNEY_ACCENTS: Record<ScoutJourneyId, BrandAccent> = {
  evaluate_rfp: 'sky',
  generate_proposal: 'violet',
  mark_takeoff: 'rose',
}

/** Export-step acknowledgements for completion predicates (BDA-281). */
export type ScoutExportFlags = {
  matrixCsv?: boolean
  proposalMarkdown?: boolean
  takeoffCsv?: boolean
}

export type ScoutPersistedSnapshot = {
  activeJourney: ScoutJourneyId | null
  stepIndex: number
  completedJourneys: ScoutJourneyId[]
  panelOpen: boolean
  dismissed: boolean
  awaitingManualContinue: boolean
  exportTriggered: ScoutExportFlags
}

/** Validate step definitions before journeys ship (BDA-279 harness reuse). */
export function assertValidScoutSteps(journey: ScoutJourney): void {
  const stepIds = new Set<string>()
  for (const step of journey.steps) {
    if (stepIds.has(step.id)) {
      throw new Error(`assertValidScoutSteps: duplicate step id "${step.id}" in ${journey.id}`)
    }
    stepIds.add(step.id)
    if (step.action && !isScoutActionId(step.action)) {
      throw new Error(`assertValidScoutSteps: invalid action on step "${step.id}"`)
    }
    if (step.secondaryActions) {
      for (const actionId of step.secondaryActions) {
        if (!isScoutActionId(actionId)) {
          throw new Error(`assertValidScoutSteps: invalid secondary action on step "${step.id}"`)
        }
      }
    }
    if (step.target && !isScoutTargetId(step.target)) {
      throw new Error(`assertValidScoutSteps: invalid target on step "${step.id}"`)
    }
  }
}
