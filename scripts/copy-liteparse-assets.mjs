import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFile = join(
  root,
  'node_modules/@llamaindex/liteparse-wasm/pkg/liteparse_wasm_bg.wasm',
)
const targetDir = join(root, 'public/liteparse')
const targetFile = join(targetDir, 'liteparse_wasm_bg.wasm')

if (!existsSync(sourceFile)) {
  console.warn('[copy-liteparse-assets] @llamaindex/liteparse-wasm not installed — skipping')
  process.exit(0)
}

mkdirSync(targetDir, { recursive: true })
cpSync(sourceFile, targetFile)

console.log('[copy-liteparse-assets] copied liteparse_wasm_bg.wasm to public/liteparse/')
