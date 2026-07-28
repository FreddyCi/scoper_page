import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const distDir = join(process.cwd(), 'dist')
const indexHtml = join(distDir, 'index.html')
const notFoundHtml = join(distDir, '404.html')

if (!existsSync(indexHtml)) {
  console.error('[prepare-static-hosting] dist/index.html not found — run pnpm build first')
  process.exit(1)
}

copyFileSync(indexHtml, notFoundHtml)

const hostingFiles = ['_headers', '_redirects']
for (const file of hostingFiles) {
  const path = join(distDir, file)
  if (!existsSync(path)) {
    console.warn(`[prepare-static-hosting] warning: dist/${file} missing (expected from public/)`)
  }
}

console.log('[prepare-static-hosting] copied index.html → 404.html for GitHub Pages SPA fallback')
