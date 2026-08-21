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
assert(
  shareTable.includes("'voice_note'"),
  'share-table pdf_drawing_annotations must include voice_note (BDA-245)',
)

const minimalPdf = path.join(root, 'public/sample/minimal.pdf')
try {
  readFileSync(minimalPdf)
} catch {
  assert(false, 'public/sample/minimal.pdf missing — run pnpm copy:samples')
}

console.log('[qa:drawing-markup] PASS BDA-240 static wiring (harness module, App chain, export + share)')

console.log('[qa:drawing-markup] BDA-257 mark voice notation wiring')

assert(existsSync(path.join(root, 'src/lib/speech-notes.ts')), 'speech-notes.ts must exist (BDA-247)')
assert(
  existsSync(path.join(root, 'src/hooks/use-mark-dictation.ts')),
  'use-mark-dictation.ts must exist (BDA-249)',
)
assert(
  existsSync(path.join(root, 'src/hooks/use-speech-notes.ts')),
  'use-speech-notes.ts must exist (BDA-248)',
)
assert(
  existsSync(path.join(root, 'src/services/mark-voice-notation-harness.ts')),
  'mark-voice-notation-harness.ts must exist (BDA-257)',
)

const speechNotes = read('src/lib/speech-notes.ts')
assert(speechNotes.includes('runSpeechNotesHarness'), 'speech-notes must export runSpeechNotesHarness')
assert(speechNotes.includes('appendSpeechTranscript'), 'speech-notes must export appendSpeechTranscript')
assert(speechNotes.includes('speechNotesAvailable'), 'speech-notes must export speechNotesAvailable')

const useMarkDictation = read('src/hooks/use-mark-dictation.ts')
assert(useMarkDictation.includes('useMarkDictation'), 'use-mark-dictation must export useMarkDictation')
assert(
  useMarkDictation.includes('runMarkDictationMergeHarness'),
  'use-mark-dictation must export runMarkDictationMergeHarness',
)

const useSpeechNotes = read('src/hooks/use-speech-notes.ts')
assert(useSpeechNotes.includes('useSpeechNotes'), 'use-speech-notes must export useSpeechNotes')
assert(useSpeechNotes.includes('startListening'), 'use-speech-notes must expose startListening')
assert(useSpeechNotes.includes('stopListening'), 'use-speech-notes must expose stopListening')

const documentViewer = read('src/components/workspace/DocumentViewer.tsx')
assert(documentViewer.includes('useMarkDictation'), 'DocumentViewer must integrate useMarkDictation (BDA-250)')
assert(
  documentViewer.includes('handleSpaceKeyDown'),
  'DocumentViewer must wire handleSpaceKeyDown (BDA-250)',
)
assert(
  documentViewer.includes('handleSpaceKeyUp'),
  'DocumentViewer must wire handleSpaceKeyUp (BDA-250)',
)
assert(
  documentViewer.includes("addEventListener('keydown'") &&
    documentViewer.includes("addEventListener('keyup'"),
  'DocumentViewer must register Space keydown/keyup listeners (BDA-250)',
)
assert(
  documentViewer.includes('updateMarkVoiceNote'),
  'DocumentViewer must wire updateMarkVoiceNote (BDA-246)',
)

const dictationOverlay = read('src/components/workspace/pdf-drawing-dictation-overlay.tsx')
assert(
  dictationOverlay.includes('PdfDrawingDictationLayer'),
  'pdf-drawing-dictation-overlay must export PdfDrawingDictationLayer (BDA-252)',
)
assert(
  dictationOverlay.includes('VoiceNotationBadge'),
  'pdf-drawing-dictation-overlay must export VoiceNotationBadge (BDA-253)',
)

assert(
  harnessModule.includes('runMarkVoiceNotationUnitHarnesses'),
  'drawing-markup unit harnesses must call runMarkVoiceNotationUnitHarnesses (BDA-257)',
)

const markVoiceHarness = read('src/services/mark-voice-notation-harness.ts')
assert(
  markVoiceHarness.includes('runSpeechNotesHarness') &&
    markVoiceHarness.includes('runMarkDictationMergeHarness'),
  'mark-voice-notation-harness must run speech-notes + merge harnesses',
)

console.log('[qa:drawing-markup] PASS BDA-257 mark voice notation static wiring')

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
  '[qa:drawing-markup] Manual UI: docs/TASK_BREAKDOWN_MARK_VOICE_NOTATION.md § Manual QA checklist (BDA-258)',
)
