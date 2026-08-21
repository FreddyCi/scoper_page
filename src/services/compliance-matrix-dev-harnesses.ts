import { runDrawingTakeoffHarness } from '@/lib/drawing-takeoff'
import { runExtractRfpInstructionsHarness } from '@/services/extract-rfp-instructions'
import { runExtractRfpRequirementsHarness } from '@/services/extract-rfp-requirements'
import { runExportDrawingTakeoffCsvHarness } from '@/services/export-drawing-takeoff-csv'
import { runExportRfpComplianceCsvHarness } from '@/services/export-rfp-compliance-csv'
import {
  runRfpRequirementsCrudHarness,
  runRfpRequirementsQualificationHarness,
} from '@/services/rfp-requirements'
import { runRfpRequirementsSchemaHarness } from '@/services/rfp-requirements-schema-harness'
import { runRfpSolicitationMetaHarness } from '@/services/rfp-solicitation-meta'

/** Sync compliance matrix + takeoff unit harnesses (BDA-274). */
export function runComplianceMatrixUnitHarnesses(): void {
  runExtractRfpRequirementsHarness()
  runExtractRfpInstructionsHarness()
  runExportRfpComplianceCsvHarness()
  runDrawingTakeoffHarness()
  runExportDrawingTakeoffCsvHarness()
}

/**
 * Async compliance matrix harnesses — DuckDB schema/CRUD, qualification sync, solicitation meta.
 * Call after `runDuckdbHarness()`.
 */
export async function runComplianceMatrixAsyncHarnesses(): Promise<void> {
  await runRfpRequirementsSchemaHarness()
  await runRfpRequirementsCrudHarness()
  await runRfpRequirementsQualificationHarness()
  await runRfpSolicitationMetaHarness()
}

/** Full compliance matrix dev chain (unit + async). */
export async function runComplianceMatrixDevHarnesses(): Promise<void> {
  runComplianceMatrixUnitHarnesses()
  await runComplianceMatrixAsyncHarnesses()
}
