import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Shared isolation headers for WASM threads (optional — BDA-090) */
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
      },
    },
  },
  optimizeDeps: {
    include: ['tesseract.js'],
    exclude: ['@duckdb/duckdb-wasm', '@llamaindex/liteparse-wasm', 'pdfjs-dist', 'bitgpu'],
  },
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  build: {
    target: 'esnext',
    reportCompressedSize: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/xlsx/')) return 'vendor-xlsx'
          if (id.includes('/mammoth/')) return 'vendor-mammoth'
          if (id.includes('/streamdown/')) return 'vendor-streamdown'
        },
      },
    },
  },
  assetsInclude: ['**/*.wasm'],
})
