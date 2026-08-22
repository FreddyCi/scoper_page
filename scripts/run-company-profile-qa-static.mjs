#!/usr/bin/env node
/**
 * Static pre-checks for company profile onboarding (BDA-309).
 * Runtime smoke runs on `pnpm dev` via runCompanyProfileUnitHarnesses in App.tsx.
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
    console.error(`[qa:company-profile] FAIL ${message}`)
    process.exit(1)
  }
}

function extractOnboardingItemNames(source) {
  const names = []
  const pattern = /^\s+name:\s*'([^']+)'/gm
  let match
  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1])
  }
  return names
}

console.log('[qa:company-profile] BDA-309 static wiring checks')

const requiredFiles = [
  'src/components/ui/questionnaire.tsx',
  'src/components/ui/questionnaire-harness.tsx',
  'src/components/onboarding/CompanyOnboardingQuestionnaire.tsx',
  'src/components/onboarding/CompanyOnboardingEntryHost.tsx',
  'src/components/onboarding/CompanyProfileSetupPrompt.tsx',
  'src/lib/company-profile/schema.ts',
  'src/lib/company-profile/questionnaire-items.ts',
  'src/lib/company-profile/form-defaults.ts',
  'src/lib/company-profile/to-company-context.ts',
  'src/lib/company-profile/onboarding-entry.ts',
  'src/lib/company-profile/company-profile-harness.ts',
  'src/lib/company-profile/company-profile-dev-harnesses.ts',
  'src/store/company-profile-store.ts',
]

for (const relPath of requiredFiles) {
  assert(existsSync(path.join(root, relPath)), `${relPath} must exist (BDA-309)`)
}

const questionnaireItems = read('src/lib/company-profile/questionnaire-items.ts')
assert(
  questionnaireItems.includes('export const COMPANY_ONBOARDING_ITEMS'),
  'questionnaire-items must export COMPANY_ONBOARDING_ITEMS',
)
assert(
  questionnaireItems.includes('assertUniqueCompanyOnboardingItemNames'),
  'questionnaire-items must export assertUniqueCompanyOnboardingItemNames',
)

const itemNames = extractOnboardingItemNames(questionnaireItems)
assert(itemNames.length >= 8, 'COMPANY_ONBOARDING_ITEMS must define at least 8 steps')
const uniqueNames = new Set(itemNames)
assert(
  uniqueNames.size === itemNames.length,
  `duplicate onboarding item names: ${itemNames.filter((name, index) => itemNames.indexOf(name) !== index).join(', ')}`,
)

const devHarnesses = read('src/lib/company-profile/company-profile-dev-harnesses.ts')
assert(
  devHarnesses.includes('runCompanyProfileUnitHarnesses'),
  'company-profile-dev-harnesses must export runCompanyProfileUnitHarnesses',
)
assert(
  devHarnesses.includes('runCompanyProfileHarness') &&
    devHarnesses.includes('runCompanyContextSerializerHarness') &&
    devHarnesses.includes('runCompanyProfileStoreHarness'),
  'company-profile unit chain must include schema, serializer, and store harnesses',
)

const profileHarness = read('src/lib/company-profile/company-profile-harness.ts')
assert(
  profileHarness.includes('assertUniqueCompanyOnboardingItemNames'),
  'company-profile-harness must validate questionnaire item registry',
)

const appTsx = read('src/App.tsx')
assert(
  appTsx.includes('runCompanyProfileUnitHarnesses'),
  'App.tsx dev chain must run runCompanyProfileUnitHarnesses',
)
assert(
  appTsx.includes('subscribeCompanyProfileStorageSync'),
  'App.tsx must subscribe company profile cross-tab sync',
)
assert(
  appTsx.includes('CompanyOnboardingEntryHost') ||
    read('src/components/scout/ScoutProvider.tsx').includes('CompanyOnboardingEntryHost'),
  'CompanyOnboardingEntryHost must be mounted in app shell',
)

const serializer = read('src/lib/company-profile/to-company-context.ts')
assert(
  serializer.includes('companyProfileToContext') &&
    serializer.includes('assessCompanyProfileContextQuality') &&
    serializer.includes('runCompanyContextSerializerHarness'),
  'to-company-context must export serializer + quality harness',
)

const proposalPanel = read('src/components/workspace/ProposalGenerationPanel.tsx')
assert(
  proposalPanel.includes('CompanyProfileSetupPrompt'),
  'ProposalGenerationPanel must surface company profile setup CTA (BDA-308)',
)

const targets = read('src/lib/scout/targets.ts')
assert(
  targets.includes("companyProfileSetup: 'company-profile-setup'"),
  'SCOUT_TARGETS must include companyProfileSetup',
)

const packageJson = read('package.json')
assert(
  packageJson.includes('"qa:company-profile"'),
  'package.json must define qa:company-profile script',
)

console.log(
  `[qa:company-profile] PASS BDA-309 static wiring (${requiredFiles.length} files, ${itemNames.length} unique item names)`,
)

console.log('[qa:company-profile] TypeScript check')
const tsc = spawnSync('pnpm', ['exec', 'tsc', '-b'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (tsc.status !== 0) {
  console.error('[qa:company-profile] FAIL tsc -b')
  process.exit(tsc.status ?? 1)
}

console.log('[qa:company-profile] PASS tsc -b')
console.log(
  '[qa:company-profile] Runtime smoke: pnpm dev — dev chain runs company profile harnesses without [dev-harness] error',
)
console.log(
  '[qa:company-profile] Manual UI: docs/TASK_BREAKDOWN_SCOPER_SCOUT.md § BDA-302 rows 16–18',
)
