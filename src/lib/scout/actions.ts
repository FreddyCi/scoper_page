import {
  assembleProposalMarkdown,
  canExportDraftedProposalVolumes,
  proposalExportFilename,
} from '@/lib/assemble-proposal-markdown'
import { beginBlobSave } from '@/lib/download-blob'
import type { ScoutActionId } from '@/lib/scout/types'
import { SCOUT_UI_EVENTS, dispatchScoutUiEvent } from '@/lib/scout/scout-ui-events'
import { loadSampleEvaluationWorkspace } from '@/services/load-sample-documents'
import { downloadDrawingTakeoffCsv } from '@/services/export-drawing-takeoff-csv'
import { downloadRfpComplianceCsv } from '@/services/export-rfp-compliance-csv'
import { fetchPdfDrawingAnnotationsForDoc } from '@/services/pdf-drawing-annotations'
import { useSessionStore } from '@/store/session-store'
import { useScoutStore } from '@/store/scout-store'

export type ScoutActionResult = {
  ok: boolean
  error?: string
  /** Sample loader not implemented yet (BDA-283–285). */
  deferred?: boolean
}

export type RunScoutActionOptions = {
  /** Proposal volume id for generate actions (BDA-295). */
  volumeId?: string
}

/** Thrown when a sample loader action awaits a later task breakdown. */
export class ScoutActionDeferredError extends Error {
  readonly actionId: ScoutActionId
  readonly followUpTask: string

  constructor(actionId: ScoutActionId, followUpTask: string) {
    super(`Scout action "${actionId}" is pending ${followUpTask}`)
    this.name = 'ScoutActionDeferredError'
    this.actionId = actionId
    this.followUpTask = followUpTask
  }
}

function fail(message: string): ScoutActionResult {
  return { ok: false, error: message }
}

function succeed(): ScoutActionResult {
  return { ok: true }
}

function deferred(actionId: ScoutActionId, followUpTask: string): ScoutActionResult {
  return { ok: false, deferred: true, error: new ScoutActionDeferredError(actionId, followUpTask).message }
}

async function exportMatrixCsv(): Promise<ScoutActionResult> {
  const session = useSessionStore.getState()
  if (session.rfpRequirements.length === 0) {
    return fail('No compliance matrix rows to export yet')
  }

  try {
    const baselineFilename = session.documents.find(
      (doc) => doc.doc_id === session.evaluationDocId,
    )?.filename

    await downloadRfpComplianceCsv({
      baselineFilename,
      requirements: session.rfpRequirements,
      profiles: session.profiles,
      scores: session.rfpRequirementScores,
      instructions: session.rfpInstructionsProfile,
    })
    useScoutStore.getState().markExportTriggered({ matrixCsv: true })
    return succeed()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return fail('Export cancelled')
    }
    return fail(error instanceof Error ? error.message : 'Matrix CSV export failed')
  }
}

async function exportProposalMarkdown(): Promise<ScoutActionResult> {
  const session = useSessionStore.getState()
  const profile = session.proposalRequirementsProfile
  if (!profile) {
    return fail('Build a proposal requirements profile before exporting')
  }
  if (!canExportDraftedProposalVolumes(profile)) {
    return fail('No drafted proposal volumes available to export')
  }

  try {
    const rfpDoc = session.documents.find((doc) => doc.doc_id === profile.rfp_doc_id)
    const markdown = assembleProposalMarkdown(profile, {
      rfpFilename: rfpDoc?.filename,
      exportMode: 'drafted-only',
    })
    const filename = proposalExportFilename(rfpDoc?.filename ?? 'proposal', 'drafted-only')
    const writeBlob = await beginBlobSave({
      filename,
      mime: 'text/markdown',
      extension: '.md',
    })
    await writeBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    useScoutStore.getState().markExportTriggered({ proposalMarkdown: true })
    return succeed()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return fail('Export cancelled')
    }
    return fail(error instanceof Error ? error.message : 'Proposal export failed')
  }
}

async function exportTakeoffCsv(): Promise<ScoutActionResult> {
  const session = useSessionStore.getState()
  const docId = session.activeDocId
  if (!docId) {
    return fail('Open a drawing document before exporting takeoff CSV')
  }

  try {
    const annotations = await fetchPdfDrawingAnnotationsForDoc(docId)
    const stamps = annotations.filter((row) => row.geometry.kind === 'stamp')
    if (stamps.length === 0) {
      return fail('No window stamps found for takeoff export')
    }

    const baselineFilename = session.documents.find((doc) => doc.doc_id === docId)?.filename
    await downloadDrawingTakeoffCsv({ annotations: stamps, baselineFilename })
    useScoutStore.getState().markExportTriggered({ takeoffCsv: true })
    return succeed()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return fail('Export cancelled')
    }
    return fail(error instanceof Error ? error.message : 'Takeoff CSV export failed')
  }
}

/**
 * Dispatch a Scout coach action to session store, services, or UI events (BDA-282).
 * Sample loaders return `{ deferred: true }` until BDA-283–285 land.
 */
export async function runScoutAction(
  actionId: ScoutActionId,
  _options: RunScoutActionOptions = {},
): Promise<ScoutActionResult> {
  const session = useSessionStore.getState()
  const scout = useScoutStore.getState()

  try {
    switch (actionId) {
      case 'continue':
        scout.setAwaitingManualContinue(false)
        scout.advanceStep()
        return succeed()

      case 'complete_journey':
        scout.completeJourney()
        return succeed()

      case 'navigate_profiles':
        session.setWorkspaceView('profiles')
        return succeed()

      case 'navigate_split':
        session.setWorkspaceView('split')
        return succeed()

      case 'run_qualification':
        if (session.evaluationDocId == null) {
          return fail('Set an evaluation baseline before running qualification')
        }
        await session.runRfpQualification()
        return succeed()

      case 'enable_mark_mode':
        session.setPdfMarkDrawingMode(true)
        session.setPdfMarkTool('stamp')
        return succeed()

      case 'open_takeoff_panel':
        dispatchScoutUiEvent(SCOUT_UI_EVENTS.openTakeoffPanel)
        return succeed()

      case 'open_share_sheet':
        dispatchScoutUiEvent(SCOUT_UI_EVENTS.openShareSheet)
        return succeed()

      case 'load_sample_evaluation':
        try {
          await loadSampleEvaluationWorkspace()
          return succeed()
        } catch (error) {
          return fail(
            error instanceof Error ? error.message : 'Sample evaluation workspace load failed',
          )
        }

      case 'load_sample_proposal':
        return deferred('load_sample_proposal', 'BDA-284')

      case 'load_sample_markup':
        return deferred('load_sample_markup', 'BDA-285')

      case 'export_matrix_csv':
        return exportMatrixCsv()

      case 'export_proposal_markdown':
        return exportProposalMarkdown()

      case 'export_takeoff_csv':
        return exportTakeoffCsv()

      default: {
        const exhaustive: never = actionId
        return fail(`Unknown scout action: ${String(exhaustive)}`)
      }
    }
  } catch (error) {
    if (error instanceof ScoutActionDeferredError) {
      return deferred(error.actionId, error.followUpTask)
    }
    return fail(error instanceof Error ? error.message : 'Scout action failed')
  }
}
