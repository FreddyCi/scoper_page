import { runDrawingTakeoffHarness } from '@/lib/drawing-takeoff'
import { runPdfDrawingGeometryHarness } from '@/lib/pdf-drawing-geometry'
import { runExportDrawingTakeoffCsvHarness } from '@/services/export-drawing-takeoff-csv'
import { runMarkVoiceNotationUnitHarnesses } from '@/services/mark-voice-notation-harness'
import { runPdfDrawingExportHarness } from '@/lib/pdf-drawing-export'
import { runExportAnnotatedPdfDrawingMarksHarness } from '@/services/export-annotated-pdf'
import {
  runPdfDrawingAnnotationsCrudHarness,
  runPdfDrawingAnnotationsPageScopeHarness,
  runPdfDrawingAnnotationsSchemaHarness,
  runPdfDrawingAnnotationsUndoHarness,
} from '@/services/pdf-drawing-annotations'
import { runSharePackDrawingAnnotationsHarness } from '@/services/share-pack-import'

/** Sync drawing markup harnesses — geometry / hit tests (BDA-240). */
export function runDrawingMarkupUnitHarnesses(): void {
  runPdfDrawingGeometryHarness()
  runDrawingTakeoffHarness()
  runExportDrawingTakeoffCsvHarness()
  runMarkVoiceNotationUnitHarnesses()
}

/**
 * Async drawing markup harnesses — DuckDB CRUD, page scope, undo, PDF export smoke (BDA-240).
 * Call after `runDuckdbHarness()` (and block-comments if export harness needs sample blocks).
 */
export async function runDrawingMarkupAsyncHarnesses(): Promise<void> {
  await runPdfDrawingAnnotationsSchemaHarness()
  await runPdfDrawingAnnotationsCrudHarness()
  await runPdfDrawingAnnotationsPageScopeHarness()
  await runPdfDrawingAnnotationsUndoHarness()
  await runPdfDrawingExportHarness()
  await runExportAnnotatedPdfDrawingMarksHarness()
}

/**
 * Share-pack drawing round-trip — resets session; run from share harness chain or in isolation (BDA-236).
 */
export async function runDrawingMarkupSharePackHarness(): Promise<void> {
  await runSharePackDrawingAnnotationsHarness()
}

/** Full drawing markup dev chain (unit + async). */
export async function runDrawingMarkupDevHarnesses(): Promise<void> {
  runDrawingMarkupUnitHarnesses()
  await runDrawingMarkupAsyncHarnesses()
}
