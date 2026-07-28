import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import { PDFJS_WORKER_URL } from '@/lib/pdfjs-config'

let workerConfigured = false

export function ensurePdfJsWorker(): void {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
  workerConfigured = true
}

export async function loadPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  ensurePdfJsWorker()
  const task = pdfjs.getDocument({ data: bytes.slice() })
  return task.promise
}

export { pdfjs }
