import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const distDir = join(process.cwd(), 'dist')
const assetsDir = join(distDir, 'assets')

/** Post-build bundle size guardrails (BDA-090) — uncompressed bytes */
const LIMITS = [
  { label: 'main entry chunk', match: /^index-.*\.js$/, maxBytes: 2_600_000 },
  { label: 'scoper worker', match: /^scoper\.worker-.*\.js$/, maxBytes: 400_000 },
  { label: 'duckdb worker', match: /^duckdb\.worker-.*\.js$/, maxBytes: 250_000 },
  { label: 'liteparse worker', match: /^liteparse\.worker-.*\.js$/, maxBytes: 40_000 },
]

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function findLargestMatching(assetFiles, pattern) {
  const matches = assetFiles.filter((file) => pattern.test(file))
  if (matches.length === 0) return null

  return matches.reduce((largest, file) => {
    const size = statSync(join(assetsDir, file)).size
    if (!largest) return { file, size }
    return size > largest.size ? { file, size } : largest
  }, null)
}

if (!existsSync(assetsDir)) {
  console.error('[check-bundle-size] dist/assets not found — run pnpm build first')
  process.exit(1)
}

const assetFiles = readdirSync(assetsDir)
let failed = false

for (const limit of LIMITS) {
  const match = findLargestMatching(assetFiles, limit.match)
  if (!match) {
    console.error(`[check-bundle-size] missing asset for ${limit.label}`)
    failed = true
    continue
  }

  const status = match.size <= limit.maxBytes ? 'ok' : 'FAIL'
  console.log(
    `[check-bundle-size] ${status} ${limit.label}: ${formatBytes(match.size)} (limit ${formatBytes(limit.maxBytes)})`,
  )

  if (match.size > limit.maxBytes) {
    failed = true
  }
}

if (failed) {
  process.exit(1)
}

console.log('[check-bundle-size] all bundle checks passed')
