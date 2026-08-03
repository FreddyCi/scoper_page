#!/usr/bin/env node
/**
 * Static pre-checks for drawing PDF markup sign-off (BDA-240) — no browser.
 * Runtime CRUD + export smoke runs on `pnpm dev` via runDrawingMarkupAsyncHarnesses.
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
    console.error(`[qa:drawing-markup] FAIL ${message}`)
    process.exit(1)
  }
}

console.log('[qa:drawing-markup] BDA-240 static wiring checks')

const harnessModulePath = 'src/services/drawing-markup-dev-harnesses.ts'
assert(existsSync(path.join(root, harnessModulePath)), `${harnessModulePath} must exist (BDA-240)`)

const harnessModule = read(harnessModulePath)
assert(
  harnessModule.includes('runDrawingMarkupUnitHarnesses'),
  'drawing-markup-dev-harnesses must export runDrawingMarkupUnitHarnesses',
)
assert(
  harnessModule.includes('runDrawingMarkupAsyncHarnesses'),
  'drawing-markup-dev-harnesses must export runDrawingMarkupAsyncHarnesses',
)
assert(
  harnessModule.includes('runPdfDrawingAnnotationsCrudHarness'),
  'drawing-markup async chain must include CRUD harness',
)
assert(
  harnessModule.includes('runPdfDrawingExportHarness'),
  'drawing-markup async chain must include pdf-drawing-export harness (BDA-237)',
)
assert(
  harnessModule.includes('runExportAnnotatedPdfDrawingMarksHarness'),
  'drawing-markup async chain must include annotated PDF drawing merge harness (BDA-238)',
)
assert(
  harnessModule.includes('runSharePackDrawingAnnotationsHarness'),
  'drawing-markup must wire share-pack drawing round-trip (BDA-236)',
)

const appTsx = read('src/App.tsx')
assert(
  appTsx.includes('runDrawingMarkupUnitHarnesses'),
  'App.tsx dev chain must run runDrawingMarkupUnitHarnesses',
)
assert(
  appTsx.includes('runDrawingMarkupAsyncHarnesses'),
  'App.tsx dev chain must run runDrawingMarkupAsyncHarnesses after DuckDB',
)

const proposalDev = read('src/services/proposal-dev-harnesses.ts')
assert(
  !proposalDev.includes('runPdfDrawingGeometryHarness'),
  'geometry harness should run via drawing-markup-dev-harnesses, not proposal-dev',
)

const exportAnnotated = read('src/services/export-annotated-pdf.ts')
assert(
  exportAnnotated.includes('includeDrawingMarks'),
  'export-annotated-pdf must support includeDrawingMarks (BDA-238)',
)
assert(
  exportAnnotated.includes('drawPdfDrawingAnnotationsOnPage'),
  'export-annotated-pdf must merge drawing vectors on burned-in path',
)

const splitView = read('src/components/workspace/SplitDocumentView.tsx')
assert(
  splitView.includes('Export PDF with drawing marks'),
  'SplitDocumentView footer must offer drawing marks export (BDA-239)',
)

const shareTable = read('src/lib/share-table.ts')
assert(
  String(shareTable.match(/SHARE_PACK_VERSION = (\d+)/)?.[1]) === '3',
  'share-table must use SHARE_PACK_VERSION 3 for pdf_drawing_annotations (BDA-235)',
)
assert(shareTable.includes("'pdf_drawing_annotations'"), 'share-table must register pdf_drawing_annotations')

const minimalPdf = path.join(root, 'public/sample/minimal.pdf')
try {
  readFileSync(minimalPdf)
} catch {
  assert(false, 'public/sample/minimal.pdf missing — run pnpm copy:samples')
}

console.log('[qa:drawing-markup] PASS BDA-240 static wiring (harness module, App chain, export + share)')

console.log('[qa:drawing-markup] TypeScript check')
const tsc = spawnSync('pnpm', ['exec', 'tsc', '--noEmit'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (tsc.status !== 0) {
  console.error('[qa:drawing-markup] FAIL tsc --noEmit')
  process.exit(tsc.status ?? 1)
}

console.log('[qa:drawing-markup] PASS tsc --noEmit')
console.log(
  '[qa:drawing-markup] Runtime smoke: pnpm dev — dev chain runs runDrawingMarkupAsyncHarnesses without [dev-harness] error',
)
console.log(
  '[qa:drawing-markup] Manual UI: docs/TASK_BREAKDOWN_DRAWING_PDF_MARKUP.md § BDA-241 manual checklist',
)
