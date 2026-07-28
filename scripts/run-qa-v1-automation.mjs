#!/usr/bin/env node
/**
 * Automated QA pre-checks for BDA-101 (extends BDA-100 automation).
 */
import { spawnSync } from 'node:child_process'

const steps = [
  { name: 'production build', args: ['build'] },
  { name: 'preview smoke (incl. v1 office fixtures)', args: ['preview:smoke'] },
]

function run(label, args) {
  console.log(`\n[qa:v1] → pnpm ${args.join(' ')}`)
  const result = spawnSync('pnpm', args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    console.error(`[qa:v1] FAIL at ${label}`)
    process.exit(result.status ?? 1)
  }
  console.log(`[qa:v1] PASS ${label}`)
}

console.log('[qa:v1] BDA-101 automated layer — see docs/QA_V1_SCRIPT.md for manual UI pass')
console.log('[qa:v1] Dev harness chain (formats, creep, comments, ECP) runs on pnpm dev — see QA_V1_RESULTS.md')

for (const step of steps) {
  run(step.name, step.args)
}

console.log('\n[qa:v1] all automated checks passed')
console.log('[qa:v1] record results in docs/QA_V1_RESULTS.md')
