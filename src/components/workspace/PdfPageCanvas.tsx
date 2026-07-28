import { useEffect, useRef, useState } from 'react'

import type { PDFDocumentProxy } from 'pdfjs-dist'

import { citationViewportHighlight } from '@/lib/citation-bbox'
import type { CitationRef } from '@/lib/types'
import { cn } from '@/lib/utils'

type PdfPageCanvasProps = {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  citation?: CitationRef | null
  className?: string
}

export function PdfPageCanvas({
  pdf,
  pageNumber,
  scale,
  citation,
  className,
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<ReturnType<typeof citationViewportHighlight>>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    setRendering(true)
    setRenderError(null)

    void pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas 2D context unavailable')

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        setCanvasSize({ width: canvas.width, height: canvas.height })
        setHighlight(citationViewportHighlight(citation, pageNumber, viewport))

        return page.render({ canvasContext: context, viewport, canvas }).promise
      })
      .catch((error) => {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (!cancelled) setRendering(false)
      })

    return () => {
      cancelled = true
    }
  }, [pdf, pageNumber, scale, citation])

  return (
    <div className={cn('relative inline-block', className)}>
      <canvas ref={canvasRef} className="bg-white shadow-panel block max-w-full" />

      {canvasSize.width > 0 && canvasSize.height > 0 ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          {highlight ? (
            <div
              className="absolute rounded-sm border-2 border-sky-500 bg-sky-400/25"
              style={{
                left: highlight.left,
                top: highlight.top,
                width: highlight.width,
                height: highlight.height,
              }}
            />
          ) : null}
        </div>
      ) : null}

      {rendering ? (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center bg-white/70 text-xs">
          Rendering page…
        </div>
      ) : null}

      {renderError ? (
        <div className="text-destructive absolute inset-x-0 bottom-0 bg-white/90 px-3 py-2 text-xs">
          {renderError}
        </div>
      ) : null}
    </div>
  )
}
