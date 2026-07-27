import * as pdfjs from 'pdfjs-dist'

import { PDFJS_WORKER_URL } from '@/lib/pdfjs-config'

let workerConfigured = false

function ensurePdfWorker() {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
  workerConfigured = true
}

export type RenderedPdfPage = {
  pageNum: number
  pdfWidth: number
  pdfHeight: number
  canvas: HTMLCanvasElement
}

export async function renderPdfPage(
  bytes: Uint8Array,
  pageNum: number,
  dpi = 150,
): Promise<RenderedPdfPage> {
  ensurePdfWorker()

  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: dpi / 72 })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D context unavailable')
  }

  await page.render({ canvasContext: context, viewport, canvas }).promise

  const [xMin, yMin, xMax, yMax] = page.view
  return {
    pageNum,
    pdfWidth: xMax - xMin,
    pdfHeight: yMax - yMin,
    canvas,
  }
}

export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  ensurePdfWorker()
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise
  return pdf.numPages
}
