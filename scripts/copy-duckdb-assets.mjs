import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = join(root, 'node_modules/@duckdb/duckdb-wasm/dist')
const targetDir = join(root, 'public/duckdb')

const ASSETS = ['duckdb-eh.wasm', 'duckdb-browser-eh.worker.js']

if (!existsSync(sourceDir)) {
  console.warn('[copy-duckdb-assets] @duckdb/duckdb-wasm not installed — skipping')
  process.exit(0)
}

mkdirSync(targetDir, { recursive: true })

for (const file of ASSETS) {
  cpSync(join(sourceDir, file), join(targetDir, file))
}

console.log(`[copy-duckdb-assets] copied ${ASSETS.length} files to public/duckdb/`)
