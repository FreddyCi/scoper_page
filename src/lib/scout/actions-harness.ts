import { runScoutAction } from '@/lib/scout/actions'
import { SCOUT_ACTION_IDS, type ScoutActionId } from '@/lib/scout/types'
import { useSessionStore } from '@/store/session-store'
import { useScoutStore } from '@/store/scout-store'

const SAMPLE_LOADER_ACTIONS = new Set<ScoutActionId>([
  'load_sample_evaluation',
  'load_sample_proposal',
  'load_sample_markup',
])

const EXPORT_ACTIONS = new Set<ScoutActionId>([
  'export_matrix_csv',
  'export_proposal_markdown',
  'export_takeoff_csv',
])

/** Dev harness — invoke scout actions without throw on empty session where safe (BDA-282). */
export async function runScoutActionsHarness(): Promise<void> {
  useSessionStore.getState().resetSession()
  useScoutStore.getState().resetScoutProgress()

  useScoutStore.getState().startJourney('evaluate_rfp')

  const navigate = await runScoutAction('navigate_profiles')
  if (!navigate.ok) {
    throw new Error(`runScoutActionsHarness: navigate_profiles failed: ${navigate.error}`)
  }

  if (useSessionStore.getState().workspaceView !== 'profiles') {
    throw new Error('runScoutActionsHarness: navigate_profiles did not set workspace view')
  }

  const split = await runScoutAction('navigate_split')
  if (!split.ok) {
    throw new Error(`runScoutActionsHarness: navigate_split failed: ${split.error}`)
  }
  if (useSessionStore.getState().workspaceView !== 'split') {
    throw new Error('runScoutActionsHarness: navigate_split did not set workspace view')
  }

  const markMode = await runScoutAction('enable_mark_mode')
  if (!markMode.ok) {
    throw new Error(`runScoutActionsHarness: enable_mark_mode failed: ${markMode.error}`)
  }
  if (!useSessionStore.getState().pdfMarkDrawingMode) {
    throw new Error('runScoutActionsHarness: enable_mark_mode did not enable drawing mode')
  }

  const takeoff = await runScoutAction('open_takeoff_panel')
  if (!takeoff.ok) {
    throw new Error(`runScoutActionsHarness: open_takeoff_panel failed: ${takeoff.error}`)
  }

  const share = await runScoutAction('open_share_sheet')
  if (!share.ok) {
    throw new Error(`runScoutActionsHarness: open_share_sheet failed: ${share.error}`)
  }

  const cont = await runScoutAction('continue')
  if (!cont.ok || useScoutStore.getState().stepIndex !== 1) {
    throw new Error('runScoutActionsHarness: continue failed to advance step')
  }

  for (const actionId of SAMPLE_LOADER_ACTIONS) {
    const result = await runScoutAction(actionId)
    if (!result.deferred) {
      throw new Error(`runScoutActionsHarness: expected deferred ${actionId}`)
    }
  }

  for (const actionId of EXPORT_ACTIONS) {
    const result = await runScoutAction(actionId)
    if (result.ok) {
      throw new Error(`runScoutActionsHarness: expected export failure on empty session for ${actionId}`)
    }
    if (result.deferred) {
      throw new Error(`runScoutActionsHarness: unexpected deferred ${actionId}`)
    }
    if (!result.error) {
      throw new Error(`runScoutActionsHarness: export ${actionId} should include error message`)
    }
  }

  const qualify = await runScoutAction('run_qualification')
  if (qualify.ok || !qualify.error?.includes('baseline')) {
    throw new Error('runScoutActionsHarness: run_qualification should fail without baseline')
  }

  useScoutStore.getState().completeJourney()
  const done = await runScoutAction('complete_journey')
  if (!done.ok) {
    throw new Error(`runScoutActionsHarness: complete_journey failed: ${done.error}`)
  }

  if (SCOUT_ACTION_IDS.length !== 14) {
    throw new Error('runScoutActionsHarness: update harness when SCOUT_ACTION_IDS changes')
  }
}
