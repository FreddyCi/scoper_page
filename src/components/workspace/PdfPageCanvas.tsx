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

type CanvasLayout = {
  width: number
  height: number
  scaleX: number
  scaleY: number
}

function readCanvasLayout(canvas: HTMLCanvasElement): CanvasLayout | null {
  if (canvas.width <= 0 || canvas.height <= 0) return null

  const { width, height } = canvas.getBoundingClientRect()
  if (width <= 0 || height <= 0) return null

  return {
    width,
    height,
    scaleX: width / canvas.width,
    scaleY: height / canvas.height,
  }
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
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout | null>(null)

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
        setHighlight(citationViewportHighlight(citation, pageNumber, viewport))
        setCanvasLayout(readCanvasLayout(canvas))

        return page.render({ canvasContext: context, viewport, canvas }).promise.then(() => {
          if (!cancelled) {
            setCanvasLayout(readCanvasLayout(canvas))
          }
        })
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function syncLayout() {
      const node = canvasRef.current
      if (!node) return
      setCanvasLayout(readCanvasLayout(node))
    }

    syncLayout()

    const observer = new ResizeObserver(syncLayout)
    observer.observe(canvas)

    return () => {
      observer.disconnect()
    }
  }, [pdf, pageNumber, scale, citation])

  const scaledHighlight =
    highlight && canvasLayout
      ? {
          left: highlight.left * canvasLayout.scaleX,
          top: highlight.top * canvasLayout.scaleY,
          width: highlight.width * canvasLayout.scaleX,
          height: highlight.height * canvasLayout.scaleY,
        }
      : null

  return (
    <div className={cn('relative inline-block max-w-full', className)}>
      <canvas ref={canvasRef} className="bg-white shadow-panel block h-auto max-w-full" />

      {canvasLayout && scaledHighlight ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ width: canvasLayout.width, height: canvasLayout.height }}
        >
          <div
            className="absolute rounded-sm border-2 border-sky-500 bg-sky-400/25"
            style={{
              left: scaledHighlight.left,
              top: scaledHighlight.top,
              width: scaledHighlight.width,
              height: scaledHighlight.height,
            }}
          />
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
