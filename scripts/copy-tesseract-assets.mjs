import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFile = join(root, 'node_modules/tesseract.js/dist/worker.min.js')
const targetDir = join(root, 'public/tesseract')
const targetFile = join(targetDir, 'worker.min.js')

if (!existsSync(sourceFile)) {
  console.warn('[copy-tesseract-assets] tesseract.js not installed — skipping')
  process.exit(0)
}

mkdirSync(targetDir, { recursive: true })
cpSync(sourceFile, targetFile)

console.log('[copy-tesseract-assets] copied worker.min.js to public/tesseract/')
