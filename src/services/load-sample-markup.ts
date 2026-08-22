import { ingestFiles } from '@/services/ingest-router'
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

/** Alias URL for docs/QA — same bytes as [`windows-drawing.pdf`](../public/sample/windows-drawing.pdf). */
export const SAMPLE_PLAN_WINDOWS_URL = '/sample/plan-windows-sample.pdf'
export const SAMPLE_PLAN_WINDOWS_FILENAME = 'plan-windows-sample.pdf'

export type LoadSampleMarkupOptions = {
  /** Pre-seed window stamps for reliable takeoff demo (default true). */
  seedStamps?: boolean
}

const DEMO_STAMP_COLOR = '#E11D48'

/** Insert demo window stamps on the plan PDF (BDA-285). */
export async function seedSampleMarkupWindowStamps(docId: string): Promise<number> {
  await insertPdfDrawingAnnotation({
    doc_id: docId,
    page_num: 1,
    tool: 'stamp',
    color: DEMO_STAMP_COLOR,
    geometry: { kind: 'stamp', x: 0.28, y: 0.42, stampKind: 'window' },
    voice_note: 'North elevation — typ. window',
    authorInitials: 'Demo',
  })

  await insertPdfDrawingAnnotation({
    doc_id: docId,
    page_num: 1,
    tool: 'stamp',
    color: DEMO_STAMP_COLOR,
    geometry: { kind: 'stamp', x: 0.62, y: 0.38, stampKind: 'window' },
    authorInitials: 'Demo',
  })

  await insertPdfDrawingAnnotation({
    doc_id: docId,
    page_num: 2,
    tool: 'stamp',
    color: DEMO_STAMP_COLOR,
    geometry: { kind: 'stamp', x: 0.45, y: 0.55, stampKind: 'window' },
    voice_note: 'South elevation glazing count',
    authorInitials: 'Demo',
  })

  const annotations = await fetchPdfDrawingAnnotationsForDoc(docId)
  return annotations.filter((row) => row.geometry.kind === 'stamp').length
}

/**
 * Ingest the Windows plan drawing, open split view, and optionally seed demo stamps (BDA-285).
 */
export async function loadSampleMarkupWorkspace(
  options: LoadSampleMarkupOptions = {},
): Promise<void> {
  const seedStamps = options.seedStamps ?? true
  const store = useSessionStore.getState()

  const file = await fetchSampleFile(SAMPLE_WINDOWS_DRAWING_URL, SAMPLE_WINDOWS_DRAWING_FILENAME)
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
    await seedSampleMarkupWindowStamps(planResult.doc_id)
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
  if (stampCount < 2) {
    throw new Error(`runLoadSampleMarkupHarness: expected ≥2 stamps, got ${stampCount}`)
  }
}
