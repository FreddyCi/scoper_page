#!/usr/bin/env node
/**
 * Static pre-checks for proposal mode sign-off (BDA-151) — no browser.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(relPath) {
  return readFileSync(path.join(root, relPath), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[qa:proposal] FAIL ${message}`)
    process.exit(1)
  }
}

console.log('[qa:proposal] BDA-151 static checks')

const workspaceContent = read('src/components/workspace/WorkspaceContent.tsx')
assert(
  workspaceContent.includes('ProposalGenerationPanel'),
  'WorkspaceContent must render ProposalGenerationPanel',
)
assert(
  workspaceContent.includes("mode === 'rfp'"),
  'WorkspaceContent must branch RFP vs proposal profiles',
)
assert(
  !workspaceContent.includes('CreepProfileGrid'),
  'WorkspaceContent must not mount CreepProfileGrid',
)

const scopeCreepHits = execSync('rg -l scope_creep src || true', {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)

const allowedLegacy = new Set([
  'src/services/share-pack-import.ts',
  'src/lib/share-table.ts',
])
const unexpected = scopeCreepHits.filter((file) => !allowedLegacy.has(file))
assert(
  unexpected.length === 0,
  `scope_creep string only allowed in share-pack-import; found: ${unexpected.join(', ')}`,
)

const samplePdf = path.join(root, 'public/sample/rfp-it-services.pdf')
try {
  readFileSync(samplePdf)
} catch {
  assert(false, 'public/sample/rfp-it-services.pdf missing — run pnpm copy:samples')
}

console.log('[qa:proposal] PASS static routing, legacy scope_creep containment, sample RFP present')
console.log('[qa:proposal] Manual UI: see TASK_BREAKDOWN_PROPOSAL_MODE.md § QA results (BDA-151)')
