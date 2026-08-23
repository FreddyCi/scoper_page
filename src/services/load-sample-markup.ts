import { ingestFiles } from '@/services/ingest-router'
import { readScoperExportMetadata } from '@/services/import-pdf-comments'
import {
  fetchSampleFile,
  SAMPLE_WINDOWS_DRAWING_FILENAME,
  SAMPLE_WINDOWS_DRAWING_URL,
} from '@/services/load-sample-documents'
import {
  fetchPdfDrawingAnnotationsForDoc,
  insertPdfDrawingAnnotation,
} from '@/services/pdf-drawing-annotations'
import { useSessionStore } from '@/store/session-store'
import { extractScoperExportWindowStamps } from '@/lib/scoper-export-drawing-stamps'
import { dispatchScoutUiEvent, SCOUT_UI_EVENTS } from '@/lib/scout/scout-ui-events'

/** Alias URL for docs/QA — same bytes as [`windows-drawing.pdf`](../public/sample/windows-drawing.pdf). */
export const SAMPLE_PLAN_WINDOWS_URL = '/sample/plan-windows-sample.pdf'
export const SAMPLE_PLAN_WINDOWS_FILENAME = 'plan-windows-sample.pdf'

/** Demo floor-plan sheet with pre-marked windows (Scoper burned-in export). */
export const SAMPLE_MARKUP_DEMO_PAGE_NUM = 8

export type LoadSampleMarkupOptions = {
  /** Pre-seed window stamps for takeoff + jump (default true). */
  seedStamps?: boolean
}

const DEMO_STAMP_COLOR = '#E11D48'

/** Insert window stamps on the demo floor-plan sheet (page 8) from a Scoper burned-in export. */
export async function seedSampleMarkupWindowStampsFromExport(
  docId: string,
  exportBytes: Uint8Array,
  pageNum = SAMPLE_MARKUP_DEMO_PAGE_NUM,
): Promise<number> {
  const stamps = await extractScoperExportWindowStamps(exportBytes)
  const demoStamps = stamps.filter((stamp) => stamp.page_num === pageNum)

  for (const stamp of demoStamps) {
    await insertPdfDrawingAnnotation({
      doc_id: docId,
      page_num: stamp.page_num,
      tool: 'stamp',
      color: DEMO_STAMP_COLOR,
      geometry: { kind: 'stamp', x: stamp.x, y: stamp.y, stampKind: 'window' },
      authorInitials: 'Demo',
    })
  }

  const annotations = await fetchPdfDrawingAnnotationsForDoc(docId)
  return annotations.filter((row) => row.geometry.kind === 'stamp').length
}

/**
 * Ingest the Windows Scoper export plan, open split view on the marked floor plan,
 * and seed takeoff rows from burned-in stamp geometry (BDA-285).
 */
export async function loadSampleMarkupWorkspace(
  options: LoadSampleMarkupOptions = {},
): Promise<void> {
  const seedStamps = options.seedStamps ?? true
  const store = useSessionStore.getState()

  const file = await fetchSampleFile(SAMPLE_WINDOWS_DRAWING_URL, SAMPLE_WINDOWS_DRAWING_FILENAME)
  const exportBytes = new Uint8Array(await file.arrayBuffer())
  const scoperMeta = await readScoperExportMetadata(exportBytes, file.name)

  const { results, errors } = await ingestFiles([file], {
    ocrEnabled: false,
    skipPdfTextExtract: true,
  })

  if (results.length === 0) {
    throw new Error(errors[0]?.error ?? 'Failed to ingest sample plan drawing')
  }

  store.commitIngestResults(results)

  const planResult = results[0]
  if (!planResult || planResult.mime !== 'application/pdf') {
    throw new Error('Sample markup workspace: plan PDF was not ingested')
  }

  store.setActiveDocId(planResult.doc_id)
  store.setWorkspaceView('split')

  if (seedStamps) {
    const stampCount = await seedSampleMarkupWindowStampsFromExport(
      planResult.doc_id,
      exportBytes,
    )

    if (
      scoperMeta.isScoperExport &&
      scoperMeta.commentMode === 'burned-in' &&
      stampCount > 0
    ) {
      store.setSuppressDrawingOverlayPreview(planResult.doc_id, true)
    }

    const annotations = await fetchPdfDrawingAnnotationsForDoc(planResult.doc_id)
    const page8Stamp = annotations.find(
      (row) =>
        row.geometry.kind === 'stamp' && row.page_num === SAMPLE_MARKUP_DEMO_PAGE_NUM,
    )
    if (page8Stamp) {
      dispatchScoutUiEvent(SCOUT_UI_EVENTS.jumpToTakeoffMark, {
        page: SAMPLE_MARKUP_DEMO_PAGE_NUM,
        annotationId: page8Stamp.annotation_id,
      })
    }
  }
}

/** Dev harness — plan sample ingested with pre-seeded stamps (BDA-285). */
export async function runLoadSampleMarkupHarness(): Promise<void> {
  useSessionStore.getState().resetSession()

  await loadSampleMarkupWorkspace({ seedStamps: true })

  const after = useSessionStore.getState()

  if (after.documents.length < 1) {
    throw new Error('runLoadSampleMarkupHarness: expected ingested plan document')
  }
  if (after.workspaceView !== 'split') {
    throw new Error('runLoadSampleMarkupHarness: expected split view')
  }
  if (after.activeDocId == null) {
    throw new Error('runLoadSampleMarkupHarness: activeDocId not set')
  }

  const plan = after.documents.find((doc) => doc.doc_id === after.activeDocId)
  if (plan?.mime !== 'application/pdf') {
    throw new Error('runLoadSampleMarkupHarness: active document must be PDF plan')
  }

  const annotations = await fetchPdfDrawingAnnotationsForDoc(after.activeDocId)
  const stampCount = annotations.filter((row) => row.geometry.kind === 'stamp').length
  if (stampCount < 1) {
    throw new Error(`runLoadSampleMarkupHarness: expected stamps on page ${SAMPLE_MARKUP_DEMO_PAGE_NUM}, got ${stampCount}`)
  }

  const page8Count = annotations.filter(
    (row) => row.geometry.kind === 'stamp' && row.page_num === SAMPLE_MARKUP_DEMO_PAGE_NUM,
  ).length
  if (page8Count < 1) {
    throw new Error(
      `runLoadSampleMarkupHarness: expected stamps on page ${SAMPLE_MARKUP_DEMO_PAGE_NUM}, got ${page8Count}`,
    )
  }

  if (!after.suppressDrawingOverlayPreviewDocIds.includes(after.activeDocId)) {
    throw new Error('runLoadSampleMarkupHarness: expected burned-in overlay preview suppressed')
  }
}
