#!/usr/bin/env node
/**
 * Automated QA pre-checks for BDA-100 (no browser required).
 */
import { spawnSync } from 'node:child_process'

const steps = [
  { name: 'production build', args: ['build'] },
  { name: 'preview smoke', args: ['preview:smoke'] },
]

function run(label, args) {
  console.log(`\n[qa:automated] → pnpm ${args.join(' ')}`)
  const result = spawnSync('pnpm', args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    console.error(`[qa:automated] FAIL at ${label}`)
    process.exit(result.status ?? 1)
  }
  console.log(`[qa:automated] PASS ${label}`)
}

console.log('[qa:automated] BDA-100 automated layer — see docs/QA_SCRIPT.md for manual UI pass')

for (const step of steps) {
  run(step.name, step.args)
}

console.log('\n[qa:automated] all automated checks passed')
console.log('[qa:automated] record results in docs/QA_RESULTS.md')
