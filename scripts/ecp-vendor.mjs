#!/usr/bin/env node
/**
 * Optional — clones and builds @executioncontrolprotocol/* from GitHub when
 * npm packages @0.0.10 are unavailable. Not required for the current
 * protocol-compatible bootstrap in src/ecp/.
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendorDir = path.join(rootDir, 'vendor/ecp')
const builtCore = path.join(vendorDir, 'packages/core/dist/index.js')

function run(command, cwd = rootDir) {
  execSync(command, { cwd, stdio: 'inherit' })
}

if (!existsSync(path.join(vendorDir, 'package.json'))) {
  console.log('[ecp-vendor] cloning executioncontrolprotocol (development)...')
  run(
    'git clone --depth 1 -b development https://github.com/GuillaumeCleme/executioncontrolprotocol.git vendor/ecp',
  )
}

if (!existsSync(builtCore)) {
  console.log('[ecp-vendor] installing and building ECP workspace...')
  run('npm install', vendorDir)
  run('npm run build', vendorDir)
}

console.log('[ecp-vendor] ready')
