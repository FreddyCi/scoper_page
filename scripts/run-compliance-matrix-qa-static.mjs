#!/usr/bin/env node
/**
 * Static pre-checks for compliance matrix, instructions card, and stamp takeoff (BDA-274).
 * Runtime smoke runs on `pnpm dev` via runComplianceMatrix*Harnesses + share pack chain.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(relPath) {
  return readFileSync(path.join(root, relPath), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[qa:compliance-matrix] FAIL ${message}`)
    process.exit(1)
  }
}

console.log('[qa:compliance-matrix] BDA-274 static wiring checks')

const harnessModulePath = 'src/services/compliance-matrix-dev-harnesses.ts'
assert(existsSync(path.join(root, harnessModulePath)), `${harnessModulePath} must exist (BDA-274)`)

const harnessModule = read(harnessModulePath)
assert(
  harnessModule.includes('runComplianceMatrixUnitHarnesses'),
  'compliance-matrix-dev-harnesses must export runComplianceMatrixUnitHarnesses',
)
assert(
  harnessModule.includes('runComplianceMatrixAsyncHarnesses'),
  'compliance-matrix-dev-harnesses must export runComplianceMatrixAsyncHarnesses',
)
assert(
  harnessModule.includes('runExtractRfpRequirementsHarness'),
  'compliance matrix unit chain must include extract-rfp-requirements harness',
)
assert(
  harnessModule.includes('runExtractRfpInstructionsHarness'),
  'compliance matrix unit chain must include extract-rfp-instructions harness',
)
assert(
  harnessModule.includes('runExportRfpComplianceCsvHarness'),
  'compliance matrix unit chain must include export-rfp-compliance-csv harness',
)
assert(
  harnessModule.includes('runDrawingTakeoffHarness') &&
    harnessModule.includes('runExportDrawingTakeoffCsvHarness'),
  'compliance matrix unit chain must include stamp takeoff harnesses (BDA-270/272)',
)
assert(
  harnessModule.includes('runRfpSolicitationMetaHarness'),
  'compliance matrix async chain must include solicitation meta harness (BDA-267)',
)

const appTsx = read('src/App.tsx')
assert(
  appTsx.includes('runComplianceMatrixUnitHarnesses'),
  'App.tsx dev chain must run runComplianceMatrixUnitHarnesses',
)
assert(
  appTsx.includes('runComplianceMatrixAsyncHarnesses'),
  'App.tsx dev chain must run runComplianceMatrixAsyncHarnesses after DuckDB',
)

const shareHarness = read('src/services/share-pack-harness.ts')
assert(
  shareHarness.includes('runSharePackRfpComplianceHarness'),
  'share-pack-harness must include RFP compliance round-trip (BDA-273)',
)

const shareTable = read('src/lib/share-table.ts')
assert(
  String(shareTable.match(/SHARE_PACK_VERSION = (\d+)/)?.[1]) === '4',
  'share-table must use SHARE_PACK_VERSION 4 for RFP matrix tables (BDA-273)',
)
assert(shareTable.includes("'rfp_requirements'"), 'share-table must register rfp_requirements')
assert(shareTable.includes("'rfp_requirement_scores'"), 'share-table must register rfp_requirement_scores')
assert(
  shareTable.includes("'rfp_solicitation_meta'"),
  'share-table must register rfp_solicitation_meta',
)
assert(
  shareTable.includes('SUPPORTED_SHARE_PACK_VERSIONS'),
  'share-table must declare SUPPORTED_SHARE_PACK_VERSIONS for v3 import compat',
)

const shareImport = read('src/services/share-pack-import.ts')
assert(
  shareImport.includes('runSharePackRfpComplianceHarness'),
  'share-pack-import must export runSharePackRfpComplianceHarness',
)
assert(
  shareImport.includes('fetchRfpRequirementsForDoc') &&
    shareImport.includes('fetchRfpInstructionsForDoc'),
  'share-pack-import must hydrate RFP matrix + instructions on import (BDA-273)',
)

const complianceCsv = read('src/services/export-rfp-compliance-csv.ts')
assert(
  complianceCsv.includes('buildRfpInstructionsCsvPreamble'),
  'export-rfp-compliance-csv must prepend instructions preamble (BDA-269)',
)

const takeoffCsv = read('src/services/export-drawing-takeoff-csv.ts')
assert(
  takeoffCsv.includes('buildDrawingTakeoffCsv') &&
    takeoffCsv.includes('runExportDrawingTakeoffCsvHarness'),
  'export-drawing-takeoff-csv must export builder + harness (BDA-272)',
)

const splitView = read('src/components/workspace/SplitDocumentView.tsx')
assert(
  splitView.includes('DrawingTakeoffPanel') && splitView.includes('Export takeoff CSV'),
  'SplitDocumentView must mount takeoff panel + CSV export (BDA-271/272)',
)

assert(
  existsSync(path.join(root, 'src/components/workspace/ComplianceMatrix.tsx')),
  'ComplianceMatrix.tsx must exist (BDA-264)',
)
assert(
  existsSync(path.join(root, 'src/components/workspace/InstructionsCard.tsx')),
  'InstructionsCard.tsx must exist (BDA-268)',
)

const packageJson = read('package.json')
assert(
  packageJson.includes('"qa:compliance-matrix"'),
  'package.json must define qa:compliance-matrix script',
)

console.log('[qa:compliance-matrix] PASS BDA-274 static wiring (harness module, App chain, share v4, UI)')

console.log('[qa:compliance-matrix] TypeScript check')
const tsc = spawnSync('pnpm', ['exec', 'tsc', '-b'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (tsc.status !== 0) {
  console.error('[qa:compliance-matrix] FAIL tsc -b')
  process.exit(tsc.status ?? 1)
}

console.log('[qa:compliance-matrix] PASS tsc -b')
console.log(
  '[qa:compliance-matrix] Runtime smoke: pnpm dev — dev chain runs compliance + share harnesses without [dev-harness] error',
)
console.log(
  '[qa:compliance-matrix] Manual UI: docs/TASK_BREAKDOWN_COMPLIANCE_MATRIX_TAKEOFF.md § BDA-276 manual checklist',
)
