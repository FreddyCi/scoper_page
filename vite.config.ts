import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['tesseract.js'],
    exclude: ['@duckdb/duckdb-wasm', '@llamaindex/liteparse-wasm', 'pdfjs-dist', 'bitgpu'],
  },
  build: {
    target: 'esnext',
  },
  assetsInclude: ['**/*.wasm'],
})
