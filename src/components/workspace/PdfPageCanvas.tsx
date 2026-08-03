import { useCallback, useEffect, useRef, useState } from 'react'

import type { PDFDocumentProxy, PageViewport, RenderTask } from 'pdfjs-dist'

import { PdfHighlightEditor } from '@/components/workspace/PdfHighlightEditor'
import { PdfDrawingOverlay, type PdfDrawingShapeCommit, type PdfDrawingStrokeCommit } from '@/components/workspace/PdfDrawingOverlay'
import { citationViewportHighlight, viewportRectToLiteParseBbox } from '@/lib/citation-bbox'
import type { Bbox, CitationRef, PdfDrawingAnnotation, PdfDrawingTool } from '@/lib/types'
import { cn } from '@/lib/utils'

type PdfPageCanvasProps = {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  citation?: CitationRef | null
  hasBlockComment?: boolean
  editable?: boolean
  adjusting?: boolean
  onRegionCommit?: (bbox: Bbox) => void | Promise<void>
  /** Normalized drawing marks for this page (read-only overlay until Mark mode tools, BDA-224+). */
  drawingAnnotations?: PdfDrawingAnnotation[]
  markDrawingMode?: boolean
  markTool?: PdfDrawingTool
  markColor?: string
  markStrokeWidth?: number
  eraserRadiusPx?: number
  onStrokeCommit?: (commit: PdfDrawingStrokeCommit) => void | Promise<void>
  /** @deprecated Use onStrokeCommit */
  onPenStrokeCommit?: (commit: PdfDrawingStrokeCommit) => void | Promise<void>
  onShapeCommit?: (commit: PdfDrawingShapeCommit) => void | Promise<void>
  onEraseAnnotation?: (annotationId: string) => void | Promise<void>
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
  hasBlockComment = false,
  editable = false,
  adjusting = false,
  onRegionCommit,
  drawingAnnotations = [],
  markDrawingMode = false,
  markTool = 'pen',
  markColor,
  markStrokeWidth,
  eraserRadiusPx,
  onStrokeCommit,
  onPenStrokeCommit,
  onShapeCommit,
  onEraseAnnotation,
  className,
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<ReturnType<typeof citationViewportHighlight>>(null)
  const [viewport, setViewport] = useState<PageViewport | null>(null)
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout | null>(null)

  const handleHighlightCommit = useCallback(
    async (cssRect: { left: number; top: number; width: number; height: number }) => {
      if (!viewport || !canvasLayout || !onRegionCommit) return

      const viewportRect = {
        left: cssRect.left / canvasLayout.scaleX,
        top: cssRect.top / canvasLayout.scaleY,
        width: cssRect.width / canvasLayout.scaleX,
        height: cssRect.height / canvasLayout.scaleY,
      }
      const bbox = viewportRectToLiteParseBbox(viewportRect, viewport)
      await onRegionCommit(bbox)
    },
    [canvasLayout, onRegionCommit, viewport],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    setRendering(true)
    setRenderError(null)

    renderTaskRef.current?.cancel()

    void pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        setViewport(viewport)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas 2D context unavailable')

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        setCanvasLayout(readCanvasLayout(canvas))

        const renderTask = page.render({ canvasContext: context, viewport, canvas })
        renderTaskRef.current = renderTask

        return renderTask.promise.then(() => {
          if (!cancelled) {
            setCanvasLayout(readCanvasLayout(canvas))
          }
        })
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error)
          if (!message.includes('Rendering cancelled')) {
            setRenderError(message)
          }
        }
      })
      .finally(() => {
        if (!cancelled) setRendering(false)
      })

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
    }
  }, [pdf, pageNumber, scale])

  useEffect(() => {
    let cancelled = false

    void pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return
        const viewport = page.getViewport({ scale })
        setViewport(viewport)
        setHighlight(citationViewportHighlight(citation, pageNumber, viewport))
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[pdf-page-canvas] highlight failed', error)
          setHighlight(null)
        }
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
  }, [pdf, pageNumber, scale])

  const scaledHighlight =
    highlight && canvasLayout
      ? {
          left: highlight.left * canvasLayout.scaleX,
          top: highlight.top * canvasLayout.scaleY,
          width: highlight.width * canvasLayout.scaleX,
          height: highlight.height * canvasLayout.scaleY,
        }
      : null

  const drawingViewport =
    canvasLayout != null
      ? { width: canvasLayout.width, height: canvasLayout.height }
      : null
  const showDrawingOverlay =
    drawingViewport != null &&
    (drawingAnnotations.length > 0 ||
      (markDrawingMode &&
        (onStrokeCommit ||
          onPenStrokeCommit ||
          onShapeCommit ||
          onEraseAnnotation)))

  return (
    <div className={cn('relative inline-block w-fit', className)}>
      <canvas ref={canvasRef} className="bg-white shadow-panel block" />

      {canvasLayout && scaledHighlight ? (
        <div
          className="absolute inset-0"
          style={{ width: canvasLayout.width, height: canvasLayout.height }}
        >
          {editable ? (
            <PdfHighlightEditor
              rect={scaledHighlight}
              boundsWidth={canvasLayout.width}
              boundsHeight={canvasLayout.height}
              hasBlockComment={hasBlockComment}
              disabled={adjusting}
              onCommit={handleHighlightCommit}
            />
          ) : (
            <div
              className={cn(
                'pointer-events-none absolute rounded-sm border-2 bg-sky-400/25',
                hasBlockComment
                  ? 'border-amber-500 ring-2 ring-amber-400/70'
                  : 'border-sky-500',
              )}
              style={{
                left: scaledHighlight.left,
                top: scaledHighlight.top,
                width: scaledHighlight.width,
                height: scaledHighlight.height,
              }}
            />
          )}
        </div>
      ) : null}

      {showDrawingOverlay && drawingViewport ? (
        <div
          className="absolute inset-0"
          style={{ width: drawingViewport.width, height: drawingViewport.height }}
        >
          <PdfDrawingOverlay
            annotations={drawingAnnotations}
            viewport={drawingViewport}
            interactive={markDrawingMode}
            activeTool={markTool}
            markColor={markColor}
            markStrokeWidth={markStrokeWidth}
            eraserRadiusPx={eraserRadiusPx}
            onStrokeCommit={onStrokeCommit}
            onPenStrokeCommit={onPenStrokeCommit}
            onShapeCommit={onShapeCommit}
            onEraseAnnotation={onEraseAnnotation}
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
