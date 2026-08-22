import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { SCOUT_DEPLOY_SAMPLE_PATHS } from './scout-sample-manifest.mjs'

const distDir = join(process.cwd(), 'dist')
const ignoreSource = join(process.cwd(), 'scripts/scout-deploy.assetsignore')
const ignoreTarget = join(distDir, '.assetsignore')

const scoutSampleAllow = new Set(SCOUT_DEPLOY_SAMPLE_PATHS)

if (!existsSync(distDir)) {
  console.error('[prepare-scout-deploy] dist/ not found — run vite build first')
  process.exit(1)
}

/** Paths that must not exist in dist for Workers deploy (SPA uses wrangler.jsonc). */
const REMOVE_PATHS = [
  join(distDir, '_redirects'),
  join(distDir, 'duckdb/duckdb-eh.wasm'),
  join(distDir, '.DS_Store'),
  join(distDir, 'duckdb/.DS_Store'),
]

for (const absolutePath of REMOVE_PATHS) {
  if (!existsSync(absolutePath)) continue
  rmSync(absolutePath, { recursive: true, force: true })
  console.log(`[prepare-scout-deploy] removed ${relative(process.cwd(), absolutePath)}`)
}

function pruneSampleDir() {
  const sampleRoot = join(distDir, 'sample')
  if (!existsSync(sampleRoot)) {
    console.warn('[prepare-scout-deploy] dist/sample missing — run pnpm copy:assets before scout build')
    return
  }

  const removed = []

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        if (readdirSync(absolutePath).length === 0) {
          rmSync(absolutePath, { recursive: true, force: true })
        }
        continue
      }

      const rel = relative(distDir, absolutePath).replace(/\\/g, '/')
      if (!scoutSampleAllow.has(rel)) {
        rmSync(absolutePath, { force: true })
        removed.push(rel)
      }
    }
  }

  walk(sampleRoot)

  if (removed.length > 0) {
    console.log(
      `[prepare-scout-deploy] pruned ${removed.length} non-Scout sample file(s) from dist/sample`,
    )
  }

  console.log(
    `[prepare-scout-deploy] Scout samples kept: ${SCOUT_DEPLOY_SAMPLE_PATHS.join(', ')}`,
  )
}

pruneSampleDir()

copyFileSync(ignoreSource, ignoreTarget)
console.log('[prepare-scout-deploy] wrote dist/.assetsignore')
