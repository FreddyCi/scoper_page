/**
 * Verify WASM assets on a deployed or preview URL (BDA-092).
 * Usage: DEPLOY_URL=https://example.com pnpm verify:deploy
 */
const baseUrl = (process.env.DEPLOY_URL ?? process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173').replace(
  /\/$/,
  '',
)

const WASM_PATHS = [
  '/duckdb/duckdb-eh.wasm',
  '/liteparse/liteparse_wasm_bg.wasm',
]

const REQUIRED_PATHS = [
  '/',
  ...WASM_PATHS,
  '/sample/minimal.pdf',
]

function isWasmMime(contentType) {
  const lower = contentType.toLowerCase()
  return lower.includes('application/wasm') || lower.includes('application/octet-stream')
}

async function verify() {
  let failed = false

  for (const path of REQUIRED_PATHS) {
    const response = await fetch(`${baseUrl}${path}`)
    if (!response.ok) {
      console.error(`[verify-deploy] FAIL ${path} → HTTP ${response.status}`)
      failed = true
      continue
    }

    const contentType = response.headers.get('content-type') ?? ''
    console.log(`[verify-deploy] ok ${path} → ${response.status} (${contentType || 'no content-type'})`)

    if (WASM_PATHS.includes(path) && !isWasmMime(contentType)) {
      console.error(`[verify-deploy] FAIL ${path} — expected WASM MIME, got: ${contentType}`)
      failed = true
    }
  }

  if (failed) {
    process.exit(1)
  }

  console.log(`[verify-deploy] all checks passed for ${baseUrl}`)
}

await verify()
