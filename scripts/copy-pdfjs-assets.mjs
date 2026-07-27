import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFile = join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
const targetDir = join(root, 'public/pdfjs')
const targetFile = join(targetDir, 'pdf.worker.min.mjs')

if (!existsSync(sourceFile)) {
  console.warn('[copy-pdfjs-assets] pdfjs-dist not installed — skipping')
  process.exit(0)
}

mkdirSync(targetDir, { recursive: true })
cpSync(sourceFile, targetFile)

console.log('[copy-pdfjs-assets] copied pdf.worker.min.mjs to public/pdfjs/')
