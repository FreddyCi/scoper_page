import { MicAudioLinesIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  denormalizePoint,
  normalizedAnnotationMarqueeBounds,
  type PdfDrawingNormalizedBounds,
  type PdfDrawingViewportSize,
} from '@/lib/pdf-drawing-geometry'
import type { PdfDrawingAnnotation } from '@/lib/types'
import { cn } from '@/lib/utils'

const DICTATION_RING_COLOR = '#0EA5E9'
const DICTATION_RING_PAD_PX = 5
const PREVIEW_MAX_CHARS = 96

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

/** Live dictation preview bubble — shadcn Bubble + sound-wave pulse (BDA-252). */
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
  const displayText = trimmed || (isListening ? 'Listening…' : '')
  if (!displayText) return null

  const bounds = normalizedAnnotationMarqueeBounds(annotation, viewport)
  const rect = boundsToPixelRect(bounds, viewport)
  const centerX = rect.left + rect.width / 2

  return (
    <div
      className={cn('pointer-events-none absolute z-[2] max-w-[min(18rem,75%)]', className)}
      style={{
        left: centerX,
        top: Math.max(4, rect.top - 8),
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div
        className={cn(
          'bg-card text-card-foreground pointer-events-none max-w-full rounded-md border px-3 py-2 shadow-md',
        )}
      >
        <div className="flex items-start gap-2 text-sm leading-snug">
          <MicAudioLinesIcon
            className={cn(
              'text-primary mt-0.5 size-4 shrink-0',
              isListening && 'animate-pulse',
            )}
            aria-hidden
          />
          <p
            className={cn(
              'min-w-[8rem]',
              trimmed ? 'whitespace-pre-wrap' : 'text-muted-foreground italic',
            )}
          >
            {trimmed ? truncateDictationPreview(trimmed, 160) : displayText}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Saved voice notation indicator — shadcn Badge + Tooltip (BDA-253). */
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
    <Tooltip>
      <TooltipTrigger
        delay={200}
        render={
          <span
            className="pointer-events-auto absolute z-[2] flex size-5 items-center justify-center"
            style={{
              left: rect.left + rect.width - size + inset,
              top: rect.top - inset,
            }}
            aria-label="Voice notation"
          >
            <Badge
              variant="secondary"
              className="border-primary/25 bg-primary/10 text-primary pointer-events-auto h-5 gap-0 px-1.5 shadow-sm ring-2 ring-card"
            >
              <MicAudioLinesIcon className="size-3" aria-hidden />
            </Badge>
          </span>
        }
      />
      <TooltipContent side="top" align="end" className="max-w-[18rem] text-left">
        <span className="text-background/75 block text-[10px] font-semibold tracking-wide uppercase">
          Voice notation
        </span>
        <span className="mt-1 block font-normal leading-snug">{voiceNote}</span>
      </TooltipContent>
    </Tooltip>
  )
}

export type PdfDrawingDictationLayerProps = {
  annotations: PdfDrawingAnnotation[]
  viewport: PdfDrawingViewportSize
  dictationTargetId?: string | null
  dictationPreview?: string
  isDictating?: boolean
}

/** HTML + SVG dictation affordances over the drawing overlay (BDA-252/253). */
export function PdfDrawingDictationLayer({
  annotations,
  viewport,
  dictationTargetId,
  dictationPreview = '',
  isDictating = false,
}: PdfDrawingDictationLayerProps) {
  const dictationTarget =
    isDictating && dictationTargetId
      ? annotations.find((annotation) => annotation.annotation_id === dictationTargetId) ?? null
      : null

  const voiceNoteAnnotations = annotations.filter((annotation) => annotation.voice_note?.trim())

  if (!dictationTarget && voiceNoteAnnotations.length === 0) {
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

        {voiceNoteAnnotations
          .filter(
            (annotation) =>
              !dictationTarget || annotation.annotation_id !== dictationTarget.annotation_id,
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
