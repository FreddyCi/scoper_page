import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const distDir = join(process.cwd(), 'dist')
const assetsDir = join(distDir, 'assets')

const scoutDeploy = process.argv.includes('--scout')

const scoutSamplePaths = scoutDeploy
  ? [
      'sample/dpr-construction-msa-2025.pdf',
      'sample/contract-keyword-check.docx',
      'sample/windows-drawing.pdf',
      'sample/files/buyer-rubric.md',
    ]
  : []

const REQUIRED_PUBLIC_PATHS = scoutDeploy
  ? [
      'index.html',
      '404.html',
      '_headers',
      'duckdb/duckdb-browser-eh.worker.js',
      'liteparse/liteparse_wasm_bg.wasm',
      'pdfjs/pdf.worker.min.mjs',
      'tesseract/worker.min.js',
      '.assetsignore',
      ...scoutSamplePaths,
    ]
  : [
      'index.html',
      '404.html',
      '_headers',
      '_redirects',
      'duckdb/duckdb-eh.wasm',
      'duckdb/duckdb-browser-eh.worker.js',
      'liteparse/liteparse_wasm_bg.wasm',
      'pdfjs/pdf.worker.min.mjs',
      'tesseract/worker.min.js',
    ]

const REQUIRED_WORKER_CHUNKS = ['duckdb.worker', 'liteparse.worker', 'scoper.worker']

function fail(message) {
  console.error(`[verify-build-assets] ${message}`)
  process.exit(1)
}

if (!existsSync(distDir)) {
  fail('dist/ not found — run pnpm build first')
}

for (const relativePath of REQUIRED_PUBLIC_PATHS) {
  const absolutePath = join(distDir, relativePath)
  if (!existsSync(absolutePath)) {
    fail(`missing ${relativePath}`)
  }
}

if (!existsSync(assetsDir)) {
  fail('dist/assets not found')
}

const assetFiles = readdirSync(assetsDir)

for (const workerChunk of REQUIRED_WORKER_CHUNKS) {
  if (!assetFiles.some((file) => file.includes(workerChunk))) {
    fail(`missing bundled worker chunk matching ${workerChunk}`)
  }
}

console.log(
  `[verify-build-assets] dist HTML, WASM, public workers, and Vite worker chunks present${scoutDeploy ? ' (scout deploy)' : ''}`,
)
