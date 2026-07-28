import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const PREVIEW_URL = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173'
const PREVIEW_PATHS = [
  '/',
  '/duckdb/duckdb-eh.wasm',
  '/duckdb/duckdb-browser-eh.worker.js',
  '/liteparse/liteparse_wasm_bg.wasm',
  '/pdfjs/pdf.worker.min.mjs',
  '/sample/rfp-it-services.pdf',
  '/sample/bidder-acme-response.pdf',
  '/sample/minimal.pdf',
  '/sample/minimal.docx',
  '/sample/minimal.xlsx',
]

async function waitForServer(url, attempts = 30) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // retry
    }
    await delay(250)
  }
  throw new Error(`preview server did not become ready at ${url}`)
}

async function verifyPaths(baseUrl) {
  for (const path of PREVIEW_PATHS) {
    const response = await fetch(`${baseUrl}${path}`)
    if (!response.ok) {
      throw new Error(`GET ${path} failed with ${response.status}`)
    }

    if (path.endsWith('.wasm')) {
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('wasm') && !contentType.includes('octet-stream')) {
        throw new Error(`unexpected WASM content-type for ${path}: ${contentType}`)
      }
    }
  }
}

const preview = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: 'pipe',
  shell: process.platform === 'win32',
})

try {
  await waitForServer(PREVIEW_URL)
  await verifyPaths(PREVIEW_URL)
  console.log('[preview-smoke] preview server serves shell, WASM, and sample PDF')
} finally {
  preview.kill('SIGTERM')
}
