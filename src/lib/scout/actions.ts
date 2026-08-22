import {
  assembleProposalMarkdown,
  canExportDraftedProposalVolumes,
  proposalExportFilename,
} from '@/lib/assemble-proposal-markdown'
import { beginBlobSave } from '@/lib/download-blob'
import { aggregateDrawingTakeoff } from '@/lib/drawing-takeoff'
import type { ScoutActionId } from '@/lib/scout/types'
import { SCOUT_UI_EVENTS, dispatchScoutUiEvent } from '@/lib/scout/scout-ui-events'
import {
  assertScoutProposalReadyToGenerate,
  pickScoutProposalVolumeId,
  scoutProposalExportFailureMessage,
  scoutProposalGenerateFailureMessage,
  scoutProposalProfileFailureMessage,
} from '@/lib/scout/proposal-scout-helpers'
import { getProposalSetupState } from '@/lib/proposal-readiness'
import type { CitationRef, CriterionResult } from '@/lib/types'
import { focusCitation } from '@/services/citation-bridge'
import { loadSampleEvaluationWorkspace } from '@/services/load-sample-documents'
import { loadSampleMarkupWorkspace } from '@/services/load-sample-markup'
import { loadSampleProposalWorkspace } from '@/services/load-sample-proposal'
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

function firstCriterionCitation(session: ReturnType<typeof useSessionStore.getState>): CitationRef | null {
  for (const profile of session.profiles) {
    const citation = findFirstCriterionCitation(profile.criteria)
    if (citation) {
      return { ...citation, doc_id: citation.doc_id ?? profile.source_doc_id }
    }
  }

  if (session.contractReviewProfile) {
    const citation = findFirstCriterionCitation(session.contractReviewProfile.criteria)
    if (citation) {
      return {
        ...citation,
        doc_id: citation.doc_id ?? session.contractReviewProfile.source_doc_id,
      }
    }
  }

  if (session.evaluationBaselineProfile) {
    const citation = findFirstCriterionCitation(session.evaluationBaselineProfile.criteria)
    if (citation) {
      return {
        ...citation,
        doc_id: citation.doc_id ?? session.evaluationBaselineProfile.source_doc_id,
      }
    }
  }

  return null
}

function findFirstCriterionCitation(criteria: CriterionResult[]): CitationRef | null {
  for (const criterion of criteria) {
    if (criterion.citation) {
      return criterion.citation
    }
  }
  return null
}

function focusFirstCriterion(): ScoutActionResult {
  const session = useSessionStore.getState()
  const citation = firstCriterionCitation(session)
  if (!citation) {
    return fail('No criterion citations yet — run qualification or load the sample package first')
  }

  focusCitation(citation)
  return succeed()
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
    return fail(
      scoutProposalExportFailureMessage(
        'Build a proposal requirements profile before exporting.',
      ),
    )
  }
  if (!canExportDraftedProposalVolumes(profile)) {
    return fail(
      scoutProposalExportFailureMessage(
        'No drafted proposal volumes available to export yet — generate a volume first.',
      ),
    )
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

async function jumpToTakeoffMark(): Promise<ScoutActionResult> {
  const session = useSessionStore.getState()
  const docId = session.activeDocId
  if (!docId) {
    return fail('Open a plan drawing before jumping to a stamp')
  }

  try {
    const annotations = await fetchPdfDrawingAnnotationsForDoc(docId)
    const rows = aggregateDrawingTakeoff(annotations)
    if (rows.length === 0) {
      return fail('No window stamps found for takeoff jump')
    }

    const firstRow = rows[0]!
    const annotationId = firstRow.annotationIds[0]
    if (!annotationId) {
      return fail('Takeoff row is missing an annotation id')
    }

    dispatchScoutUiEvent(SCOUT_UI_EVENTS.openTakeoffPanel)
    dispatchScoutUiEvent(SCOUT_UI_EVENTS.jumpToTakeoffMark, {
      page: firstRow.page,
      annotationId,
    })
    dispatchScoutUiEvent(SCOUT_UI_EVENTS.markJumpTriggered)
    return succeed()
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Takeoff jump failed')
  }
}

/**
 * Dispatch a Scout coach action to session store, services, or UI events (BDA-282).
 * Sample loaders return `{ deferred: true }` until BDA-283–285 land.
 */
export async function runScoutAction(
  actionId: ScoutActionId,
  options: RunScoutActionOptions = {},
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

      case 'jump_to_takeoff_mark':
        return jumpToTakeoffMark()

      case 'open_share_sheet':
        dispatchScoutUiEvent(SCOUT_UI_EVENTS.openShareSheet)
        return succeed()

      case 'open_upload':
        session.openUploadPopup('rfp')
        return succeed()

      case 'focus_first_criterion':
        return focusFirstCriterion()

      case 'build_proposal_profile': {
        const setup = getProposalSetupState({
          documents: session.documents,
          evaluationDocId: session.evaluationDocId,
          companyContext: session.companyContext,
          proposalRequirementsProfile: session.proposalRequirementsProfile,
        })
        if (!setup.hasRfp || !setup.hasContext) {
          return fail('Select the solicitation RFP and add responder context before building the profile.')
        }
        await session.runProposalRequirementsProfile()
        const afterProfile = useSessionStore.getState()
        if (!afterProfile.proposalRequirementsProfile) {
          return fail(
            scoutProposalProfileFailureMessage(afterProfile.proposalGenerationError),
          )
        }
        return succeed()
      }

      case 'generate_proposal_volume': {
        const readyError = assertScoutProposalReadyToGenerate({
          documents: session.documents,
          evaluationDocId: session.evaluationDocId,
          companyContext: session.companyContext,
          proposalRequirementsProfile: session.proposalRequirementsProfile,
        })
        if (readyError) {
          return fail(readyError)
        }

        const profile = session.proposalRequirementsProfile!
        const volumeId = options.volumeId ?? pickScoutProposalVolumeId(profile)
        if (!volumeId) {
          return fail('Build a proposal profile with at least one volume before generating.')
        }

        await session.runGenerateProposalVolume(volumeId)

        const afterGenerate = useSessionStore.getState()
        const updatedProfile = afterGenerate.proposalRequirementsProfile
        const volume = updatedProfile?.volumes.find((entry) => entry.id === volumeId)

        if (volume?.status === 'draft') {
          return succeed()
        }

        return fail(
          scoutProposalGenerateFailureMessage(
            afterGenerate.proposalGenerationError,
            volume?.errorMessage,
          ),
        )
      }

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
        try {
          await loadSampleProposalWorkspace()
          return succeed()
        } catch (error) {
          return fail(
            error instanceof Error ? error.message : 'Sample proposal workspace load failed',
          )
        }

      case 'load_sample_markup':
        try {
          await loadSampleMarkupWorkspace()
          return succeed()
        } catch (error) {
          return fail(
            error instanceof Error ? error.message : 'Sample markup workspace load failed',
          )
        }

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
