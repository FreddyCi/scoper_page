#!/usr/bin/env node
/**
 * Static pre-checks for Scoper Scout (BDA-300).
 * Runtime smoke runs on `pnpm dev` via runScoutUnitHarnesses / runScoutAsyncUnitHarnesses.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(relPath) {
  return readFileSync(path.join(root, relPath), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[qa:scout] FAIL ${message}`)
    process.exit(1)
  }
}

function listSourceFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listSourceFiles(fullPath, files)
      continue
    }
    if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

function loadSrcCorpus() {
  const files = listSourceFiles(path.join(root, 'src'))
  return files.map((filePath) => ({
    rel: path.relative(root, filePath),
    text: readFileSync(filePath, 'utf8'),
  }))
}

function extractScoutTargetIds(source) {
  const start = source.indexOf('export const SCOUT_TARGETS')
  const end = source.indexOf('} as const', start)
  assert(start >= 0 && end > start, 'SCOUT_TARGETS block not found in targets.ts')
  const block = source.slice(start, end)
  return [...block.matchAll(/:\s*'([^']+)'/g)].map((match) => match[1])
}

function countJourneySteps(journeySource) {
  const stepsStart = journeySource.indexOf('steps: [')
  assert(stepsStart >= 0, 'journey file missing steps array')
  const stepsEnd = journeySource.indexOf('\n  ],', stepsStart)
  assert(stepsEnd > stepsStart, 'journey steps array end not found')
  const block = journeySource.slice(stepsStart, stepsEnd)
  return [...block.matchAll(/^\s+id:\s*'([^']+)'/gm)].length
}

function readJourneyStepCountConstant(journeySource, constantName) {
  const match = journeySource.match(new RegExp(`export const ${constantName} = (\\d+)`))
  return match ? Number(match[1]) : null
}

console.log('[qa:scout] BDA-300 static wiring checks')

const requiredFiles = [
  'src/components/scout/ScoutPanel.tsx',
  'src/components/scout/ScoutProvider.tsx',
  'src/components/scout/ScoutSpotlight.tsx',
  'src/components/scout/ScoutHeaderLauncher.tsx',
  'src/components/scout/ScoutJourneyPicker.tsx',
  'src/components/onboarding/CompanyOnboardingEntryHost.tsx',
  'src/store/scout-store.ts',
  'src/lib/scout/targets.ts',
  'src/lib/scout/actions.ts',
  'src/lib/scout/completion.ts',
  'src/lib/scout/journeys-map.ts',
  'src/lib/scout/journeys/evaluate-rfp.ts',
  'src/lib/scout/journeys/generate-proposal.ts',
  'src/lib/scout/journeys/mark-takeoff.ts',
  'src/services/scout-dev-harnesses.ts',
  'src/services/load-sample-documents.ts',
  'src/services/load-sample-proposal.ts',
  'src/services/load-sample-markup.ts',
]

for (const relPath of requiredFiles) {
  assert(existsSync(path.join(root, relPath)), `${relPath} must exist (BDA-300)`)
}

const targetsSource = read('src/lib/scout/targets.ts')
const targetIds = extractScoutTargetIds(targetsSource)
assert(targetIds.length >= 20, 'expected at least 20 SCOUT_TARGETS entries')
assert(new Set(targetIds).size === targetIds.length, 'duplicate SCOUT_TARGETS values detected')

const targetIdsExport = read('src/lib/scout/targets.ts')
assert(
  targetIdsExport.includes('export const SCOUT_TARGET_IDS'),
  'targets.ts must export SCOUT_TARGET_IDS',
)

const corpus = loadSrcCorpus()
const corpusText = corpus.map((entry) => entry.text).join('\n')
const missingTargets = targetIds.filter((targetId) => !corpusText.includes(targetId))
assert(
  missingTargets.length === 0,
  `SCOUT_TARGETS not referenced under src/: ${missingTargets.join(', ')}`,
)

const journeyExpectations = [
  {
    file: 'src/lib/scout/journeys/evaluate-rfp.ts',
    constant: 'EVALUATE_RFP_JOURNEY_STEP_COUNT',
    expectedCount: 9,
    expectedFirstStep: 'welcome',
    loadSampleAction: 'load_sample_evaluation',
  },
  {
    file: 'src/lib/scout/journeys/generate-proposal.ts',
    constant: 'GENERATE_PROPOSAL_JOURNEY_STEP_COUNT',
    expectedCount: 6,
    expectedFirstStep: 'load-sample',
    loadSampleAction: 'load_sample_proposal',
  },
  {
    file: 'src/lib/scout/journeys/mark-takeoff.ts',
    constant: 'MARK_TAKEOFF_JOURNEY_STEP_COUNT',
    expectedCount: 7,
    expectedFirstStep: 'load-sample',
    loadSampleAction: 'load_sample_markup',
  },
]

for (const journey of journeyExpectations) {
  const source = read(journey.file)
  const declared = readJourneyStepCountConstant(source, journey.constant)
  const counted = countJourneySteps(source)
  assert(declared === journey.expectedCount, `${journey.constant} should be ${journey.expectedCount}`)
  assert(counted === journey.expectedCount, `${journey.file} step count mismatch (${counted})`)
  assert(
    source.includes(`id: '${journey.expectedFirstStep}'`),
    `${journey.file} missing first step ${journey.expectedFirstStep}`,
  )
  assert(
    source.includes(`action: '${journey.loadSampleAction}'`),
    `${journey.file} must wire load-sample → ${journey.loadSampleAction}`,
  )
}

const devHarnesses = read('src/services/scout-dev-harnesses.ts')
assert(
  devHarnesses.includes('runScoutUnitHarnesses') &&
    devHarnesses.includes('runScoutAsyncUnitHarnesses') &&
    devHarnesses.includes('runScoutSampleLoaderSmokeHarness'),
  'scout-dev-harnesses must export unit + async + sample loader smoke',
)

const appTsx = read('src/App.tsx')
assert(appTsx.includes('runScoutUnitHarnesses'), 'App.tsx must run runScoutUnitHarnesses')
assert(appTsx.includes('runScoutAsyncUnitHarnesses'), 'App.tsx must run runScoutAsyncUnitHarnesses')
assert(appTsx.includes('subscribeScoutStorageSync'), 'App.tsx must subscribe scout storage sync')

const scoutProvider = read('src/components/scout/ScoutProvider.tsx')
assert(
  scoutProvider.includes('<ScoutPanel') && scoutProvider.includes('CompanyOnboardingEntryHost'),
  'ScoutProvider must mount ScoutPanel and company onboarding entry host',
)

const actions = read('src/lib/scout/actions.ts')
for (const action of ['load_sample_evaluation', 'load_sample_proposal', 'load_sample_markup']) {
  assert(actions.includes(`'${action}'`), `scout actions must handle ${action}`)
}

const packageJson = read('package.json')
assert(packageJson.includes('"qa:scout"'), 'package.json must define qa:scout script')

console.log(
  `[qa:scout] PASS BDA-300 static wiring (${targetIds.length} targets, ${journeyExpectations.length} journeys, ${requiredFiles.length} core files)`,
)

console.log('[qa:scout] TypeScript check')
const tsc = spawnSync('pnpm', ['exec', 'tsc', '-b'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (tsc.status !== 0) {
  console.error('[qa:scout] FAIL tsc -b')
  process.exit(tsc.status ?? 1)
}

console.log('[qa:scout] PASS tsc -b')
console.log(
  '[qa:scout] Runtime smoke: pnpm dev — scout dev harness chain completes without [dev-harness] error',
)
console.log('[qa:scout] Manual UI: docs/TASK_BREAKDOWN_SCOPER_SCOUT.md § BDA-302 manual checklist')
