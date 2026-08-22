import type { ScoutActionId } from '@/lib/scout/types'

/** Primary button labels for ScoutPanel “Do this” actions (BDA-286). */
export const SCOUT_ACTION_LABELS: Record<ScoutActionId, string> = {
  continue: 'Continue',
  load_sample_evaluation: 'Load sample package',
  load_sample_proposal: 'Load sample solicitation',
  load_sample_markup: 'Load sample plan',
  navigate_profiles: 'Open profiles view',
  navigate_split: 'Open document view',
  run_qualification: 'Run qualification',
  enable_mark_mode: 'Enable Mark mode',
  open_takeoff_panel: 'Open takeoff sheet',
  export_matrix_csv: 'Export matrix CSV',
  export_proposal_markdown: 'Export proposal markdown',
  export_takeoff_csv: 'Export takeoff CSV',
  open_share_sheet: 'Open share workspace',
  open_upload: 'Upload documents',
  focus_first_criterion: 'Jump to sample citation',
  build_proposal_profile: 'Build proposal profile',
  generate_proposal_volume: 'Generate sample volume',
  complete_journey: 'Finish tour',
}

export function scoutActionLabel(actionId: ScoutActionId): string {
  return SCOUT_ACTION_LABELS[actionId]
}

export type ScoutStepStatus = 'done' | 'current' | 'upcoming'

export function scoutStepStatus(stepIndex: number, activeIndex: number): ScoutStepStatus {
  if (stepIndex < activeIndex) return 'done'
  if (stepIndex === activeIndex) return 'current'
  return 'upcoming'
}
