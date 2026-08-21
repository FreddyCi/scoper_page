import { MicAudioLinesIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  denormalizePoint,
  normalizedAnnotationMarqueeBounds,
  type PdfDrawingNormalizedBounds,
  type PdfDrawingViewportSize,
} from '@/lib/pdf-drawing-geometry'
import type { PdfDrawingAnnotation } from '@/lib/types'
import { cn } from '@/lib/utils'

const CARD_GAP_PX = 8
const CARD_ESTIMATE_HEIGHT_PX = 168
const CARD_MAX_WIDTH_PX = 320

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function visibleBoundsInOverlay(overlay: HTMLElement): {
  top: number
  left: number
  width: number
  height: number
} {
  const overlayRect = overlay.getBoundingClientRect()
  const scrollParent = overlay.closest('[data-pdf-scroll]')
  if (!(scrollParent instanceof HTMLElement)) {
    return { top: 0, left: 0, width: overlay.clientWidth, height: overlay.clientHeight }
  }

  const scrollRect = scrollParent.getBoundingClientRect()
  const top = Math.max(0, scrollRect.top - overlayRect.top)
  const left = Math.max(0, scrollRect.left - overlayRect.left)
  const bottom = Math.min(overlayRect.height, scrollRect.bottom - overlayRect.top)
  const right = Math.min(overlayRect.width, scrollRect.right - overlayRect.left)
  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}
const DICTATION_RING_COLOR = '#0EA5E9'
const DICTATION_RING_PAD_PX = 5
const PREVIEW_MAX_CHARS = 280

function boundsToPixelRect(
  bounds: PdfDrawingNormalizedBounds,
  viewport: PdfDrawingViewportSize,
): { left: number; top: number; width: number; height: number } {
  const topLeft = denormalizePoint({ x: bounds.x, y: bounds.y }, viewport)
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: bounds.width * viewport.width,
    height: bounds.height * viewport.height,
  }
}

function truncateDictationPreview(text: string, maxLength = PREVIEW_MAX_CHARS): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1)}…`
}

/** Animated dashed ring around the mark being dictated (BDA-252). */
export function DictationListeningRing({
  annotation,
  viewport,
}: {
  annotation: PdfDrawingAnnotation
  viewport: PdfDrawingViewportSize
}) {
  const bounds = normalizedAnnotationMarqueeBounds(annotation, viewport)
  const topLeft = denormalizePoint({ x: bounds.x, y: bounds.y }, viewport)
  const pad = DICTATION_RING_PAD_PX

  return (
    <rect
      x={topLeft.x - pad}
      y={topLeft.y - pad}
      width={bounds.width * viewport.width + pad * 2}
      height={bounds.height * viewport.height + pad * 2}
      fill="rgba(14, 165, 233, 0.06)"
      stroke={DICTATION_RING_COLOR}
      strokeWidth={2}
      strokeDasharray="7 5"
      rx={6}
      className="pointer-events-none animate-pulse"
    />
  )
}

/** Live or saved voice notation card — shadcn Card + Textarea (BDA-252/253). */
export function DictationDraftBubble({
  annotation,
  previewText,
  viewport,
  isListening = false,
  className,
}: {
  annotation: PdfDrawingAnnotation
  previewText: string
  viewport: PdfDrawingViewportSize
  isListening?: boolean
  className?: string
}) {
  const trimmed = previewText.trim()
  const hostRef = useRef<HTMLDivElement>(null)
  const bounds = normalizedAnnotationMarqueeBounds(annotation, viewport)
  const rect = boundsToPixelRect(bounds, viewport)
  const [placement, setPlacement] = useState(() => ({
    left: rect.left + rect.width / 2,
    top: rect.top < CARD_ESTIMATE_HEIGHT_PX + CARD_GAP_PX
      ? rect.top + rect.height + CARD_GAP_PX
      : rect.top - CARD_GAP_PX,
    placeBelow: rect.top < CARD_ESTIMATE_HEIGHT_PX + CARD_GAP_PX,
  }))

  useLayoutEffect(() => {
    const host = hostRef.current
    const overlay = host?.offsetParent
    if (!(host instanceof HTMLElement) || !(overlay instanceof HTMLElement)) return

    const visible = visibleBoundsInOverlay(overlay)
    const cardHeight = host.offsetHeight || CARD_ESTIMATE_HEIGHT_PX
    const cardWidth = Math.min(host.offsetWidth || CARD_MAX_WIDTH_PX, visible.width || CARD_MAX_WIDTH_PX)
    const spaceAbove = rect.top - visible.top
    const spaceBelow = visible.top + visible.height - (rect.top + rect.height)
    const placeBelow = spaceAbove < cardHeight + CARD_GAP_PX && spaceBelow >= spaceAbove

    const centerX = rect.left + rect.width / 2
    const minCenter = visible.left + cardWidth / 2 + CARD_GAP_PX
    const maxCenter = visible.left + visible.width - cardWidth / 2 - CARD_GAP_PX
    const left =
      minCenter <= maxCenter ? clamp(centerX, minCenter, maxCenter) : visible.left + visible.width / 2

    const unclampedTop = placeBelow ? rect.top + rect.height + CARD_GAP_PX : rect.top - CARD_GAP_PX
    const topEdge = placeBelow ? unclampedTop : unclampedTop - cardHeight
    const maxTop = visible.top + Math.max(0, visible.height - cardHeight) - CARD_GAP_PX
    const clampedTopEdge = clamp(topEdge, visible.top + CARD_GAP_PX, Math.max(visible.top + CARD_GAP_PX, maxTop))
    const top = placeBelow ? clampedTopEdge : clampedTopEdge + cardHeight

    setPlacement({ left, top, placeBelow })
  }, [rect.height, rect.left, rect.top, rect.width, trimmed, isListening, viewport.height, viewport.width])

  if (!trimmed && !isListening) return null

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute z-[2] w-[min(20rem,78%)]', className)}
      style={{
        left: placement.left,
        top: placement.top,
        transform: placement.placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
      }}
    >
      <Card className="border-border bg-surface shadow-panel gap-0 overflow-hidden rounded-xl border py-0">
        <CardHeader className="flex flex-row items-start gap-2.5 border-b border-border/70 px-3 py-2.5">
          <MicAudioLinesIcon
            className={cn('text-primary mt-0.5 size-4 shrink-0', isListening && 'animate-pulse')}
            aria-hidden
          />
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-sm font-semibold tracking-tight">Voice notation</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {isListening
                ? trimmed
                  ? 'Listening · release Space to save'
                  : 'Listening…'
                : 'Saved note'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-3 py-3">
          <div className="border-border/70 bg-muted/40 rounded-lg border px-0.5 py-0.5">
            <Textarea
              readOnly
              tabIndex={-1}
              aria-label="Voice notation"
              value={trimmed ? truncateDictationPreview(trimmed) : ''}
              placeholder="Speak to fill this note…"
              className="text-muted-foreground min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Corner indicator that a mark has a saved voice note (hover is handled on the drawing). */
export function VoiceNotationBadge({
  annotation,
  viewport,
}: {
  annotation: PdfDrawingAnnotation
  viewport: PdfDrawingViewportSize
}) {
  const voiceNote = annotation.voice_note?.trim()
  if (!voiceNote) return null

  const bounds = normalizedAnnotationMarqueeBounds(annotation, viewport)
  const rect = boundsToPixelRect(bounds, viewport)
  const size = 20
  const inset = 4

  return (
    <span
      className="pointer-events-none absolute z-[2] flex size-5 items-center justify-center"
      style={{
        left: rect.left + rect.width - size + inset,
        top: rect.top - inset,
      }}
      aria-hidden
    >
      <Badge
        variant="secondary"
        className="border-border/70 bg-surface text-foreground h-5 gap-0 px-1.5 shadow-sm"
      >
        <MicAudioLinesIcon className="size-3" aria-hidden />
      </Badge>
    </span>
  )
}

export type PdfDrawingDictationLayerProps = {
  annotations: PdfDrawingAnnotation[]
  viewport: PdfDrawingViewportSize
  dictationTargetId?: string | null
  dictationPreview?: string
  isDictating?: boolean
  hoveredVoiceNoteId?: string | null
}

/** HTML + SVG dictation affordances over the drawing overlay (BDA-252/253). */
export function PdfDrawingDictationLayer({
  annotations,
  viewport,
  dictationTargetId,
  dictationPreview = '',
  isDictating = false,
  hoveredVoiceNoteId = null,
}: PdfDrawingDictationLayerProps) {
  const dictationTarget =
    isDictating && dictationTargetId
      ? annotations.find((annotation) => annotation.annotation_id === dictationTargetId) ?? null
      : null

  const hoveredAnnotation =
    !isDictating && hoveredVoiceNoteId
      ? annotations.find((annotation) => annotation.annotation_id === hoveredVoiceNoteId) ?? null
      : null
  const hoveredNote = hoveredAnnotation?.voice_note?.trim() ?? ''

  const voiceNoteAnnotations = annotations.filter((annotation) => annotation.voice_note?.trim())

  if (!dictationTarget && !hoveredAnnotation && voiceNoteAnnotations.length === 0) {
    return null
  }

  return (
    <>
      {dictationTarget && isDictating ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[1]"
          width={viewport.width}
          height={viewport.height}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          aria-hidden
        >
          <DictationListeningRing annotation={dictationTarget} viewport={viewport} />
        </svg>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-[2]">
        {dictationTarget && isDictating ? (
          <DictationDraftBubble
            annotation={dictationTarget}
            previewText={dictationPreview}
            viewport={viewport}
            isListening
          />
        ) : null}

        {hoveredAnnotation && hoveredNote ? (
          <DictationDraftBubble
            annotation={hoveredAnnotation}
            previewText={hoveredNote}
            viewport={viewport}
          />
        ) : null}

        {voiceNoteAnnotations
          .filter(
            (annotation) =>
              annotation.annotation_id !== dictationTarget?.annotation_id &&
              annotation.annotation_id !== hoveredAnnotation?.annotation_id,
          )
          .map((annotation) => (
            <VoiceNotationBadge
              key={`voice-${annotation.annotation_id}`}
              annotation={annotation}
              viewport={viewport}
            />
          ))}
      </div>
    </>
  )
}
