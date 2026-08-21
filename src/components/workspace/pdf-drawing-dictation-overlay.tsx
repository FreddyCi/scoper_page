import { MicAudioLinesIcon, Minimize2Icon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  denormalizePoint,
  normalizedAnnotationMarqueeBounds,
  type PdfDrawingNormalizedBounds,
  type PdfDrawingViewportSize,
} from '@/lib/pdf-drawing-geometry'
import type { PdfDrawingAnnotation } from '@/lib/types'
import { cn } from '@/lib/utils'

const CARD_GAP_PX = 8
const CARD_ESTIMATE_HEIGHT_PX = 188
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
  editable = false,
  speechNotesAvailable = true,
  onSave,
  onDictateHoldStart,
  onDictateHoldEnd,
  onMinimize,
  onExpand,
  onPointerEnter,
  onPointerLeave,
  className,
}: {
  annotation: PdfDrawingAnnotation
  previewText: string
  viewport: PdfDrawingViewportSize
  isListening?: boolean
  editable?: boolean
  speechNotesAvailable?: boolean
  onSave?: (value: string) => void
  onDictateHoldStart?: () => void
  onDictateHoldEnd?: () => void
  onMinimize?: () => void
  onExpand?: () => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  className?: string
}) {
  const trimmed = previewText.trim()
  const hostRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(previewText)
  const bounds = normalizedAnnotationMarqueeBounds(annotation, viewport)
  const rect = boundsToPixelRect(bounds, viewport)
  const [placement, setPlacement] = useState(() => ({
    left: rect.left + rect.width / 2,
    top: rect.top < CARD_ESTIMATE_HEIGHT_PX + CARD_GAP_PX
      ? rect.top + rect.height + CARD_GAP_PX
      : rect.top - CARD_GAP_PX,
    placeBelow: rect.top < CARD_ESTIMATE_HEIGHT_PX + CARD_GAP_PX,
  }))

  useEffect(() => {
    if (isListening) return
    setDraft(previewText)
  }, [isListening, previewText])

  const displayValue = isListening ? previewText : draft

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
  }, [displayValue, isListening, rect.height, rect.left, rect.top, rect.width, viewport.height, viewport.width])

  if (!trimmed && !isListening && !editable) return null

  const hideCard = () => {
    if (editable && !isListening && onSave && draft.trim() !== previewText.trim()) {
      onSave(draft)
    }
    if (isListening) onDictateHoldEnd?.()
    onMinimize?.()
  }

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-auto absolute z-[3] w-[min(20rem,78%)]', className)}
      style={{
        left: placement.left,
        top: placement.top,
        transform: placement.placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={
        !editable && !isListening && onExpand
          ? (event) => {
              event.stopPropagation()
              onExpand()
            }
          : undefined
      }
    >
      <Card className="border-border bg-surface shadow-panel gap-0 overflow-hidden rounded-xl border py-0">
        <CardHeader className="flex flex-row items-start gap-2.5 border-b border-border/70 px-3 py-2.5">
          <MicAudioLinesIcon
            className={cn('text-primary mt-0.5 size-4 shrink-0', isListening && 'animate-pulse')}
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <CardTitle className="text-sm font-semibold tracking-tight">Voice notation</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {isListening
                ? trimmed
                  ? 'Listening · release to save'
                  : 'Listening…'
                : editable
                  ? 'Type to edit, or hold the sound-wave button to dictate'
                  : 'Hover to read · click to edit'}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {editable && onDictateHoldStart ? (
              <Button
                type="button"
                size="icon-xs"
                variant={isListening ? 'default' : 'ghost'}
                aria-label="Hold to dictate this notation"
                disabled={!speechNotesAvailable}
                className={cn('shrink-0', isListening && 'ring-1 ring-primary/50')}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  event.preventDefault()
                  event.stopPropagation()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  onDictateHoldStart()
                }}
                onPointerUp={(event) => {
                  event.stopPropagation()
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }
                  onDictateHoldEnd?.()
                }}
                onPointerCancel={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }
                  onDictateHoldEnd?.()
                }}
              >
                <MicAudioLinesIcon className={cn('size-3.5', isListening && 'animate-pulse')} />
              </Button>
            ) : null}
            <Tooltip>
              <TooltipTrigger
                delay={300}
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Hide notation"
                    onClick={(event) => {
                      event.stopPropagation()
                      hideCard()
                    }}
                  >
                    <Minimize2Icon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                Hide notation · hover the mark to read it again
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="px-3 py-3">
          {editable || isListening ? (
            <div className="border-border/70 bg-muted/40 rounded-lg border px-0.5 py-0.5">
              <Textarea
                readOnly={!editable || isListening}
                tabIndex={editable && !isListening ? 0 : -1}
                aria-label="Voice notation"
                value={displayValue}
                placeholder="Type a note, or hold Space to dictate…"
                className="text-foreground min-h-24 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                  if (!editable || isListening || !onSave) return
                  if (draft.trim() === previewText.trim()) return
                  onSave(draft)
                }}
              />
            </div>
          ) : (
            <p className="text-foreground max-h-32 overflow-auto text-sm leading-relaxed whitespace-pre-wrap">
              {displayValue}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Corner indicator that a mark has a saved voice note (hover is handled on the drawing). */
export function VoiceNotationBadge({
  annotation,
  viewport,
  onOpen,
  onPointerEnter,
  onPointerLeave,
}: {
  annotation: PdfDrawingAnnotation
  viewport: PdfDrawingViewportSize
  onOpen?: () => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}) {
  const voiceNote = annotation.voice_note?.trim()
  if (!voiceNote) return null

  const bounds = normalizedAnnotationMarqueeBounds(annotation, viewport)
  const rect = boundsToPixelRect(bounds, viewport)
  const size = 20
  const inset = 4

  return (
    <span
      className="pointer-events-auto absolute z-[2] flex size-5 items-center justify-center"
      style={{
        left: rect.left + rect.width - size + inset,
        top: rect.top - inset,
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Tooltip>
        <TooltipTrigger
          delay={300}
          render={
            <button
              type="button"
              aria-label="Show voice notation"
              className="flex size-5 items-center justify-center"
              onClick={(event) => {
                event.stopPropagation()
                onOpen?.()
              }}
            >
              <Badge
                variant="secondary"
                className="border-border/70 bg-surface text-foreground h-5 gap-0 px-1.5 shadow-sm"
              >
                <MicAudioLinesIcon className="size-3" aria-hidden />
              </Badge>
            </button>
          }
        />
        <TooltipContent side="top">Hover to read · click to edit</TooltipContent>
      </Tooltip>
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
  speechNotesAvailable?: boolean
  onSaveNote?: (annotationId: string, voiceNote: string) => void
  onDictateHoldStart?: (annotationId: string) => void
  onDictateHoldEnd?: () => void
  onHoverCardEnter?: () => void
  onHoverCardLeave?: () => void
  onSuppressHover?: (annotationId: string) => void
}

/** HTML + SVG dictation affordances over the drawing overlay (BDA-252/253). */
export function PdfDrawingDictationLayer({
  annotations,
  viewport,
  dictationTargetId,
  dictationPreview = '',
  isDictating = false,
  hoveredVoiceNoteId = null,
  speechNotesAvailable = true,
  onSaveNote,
  onDictateHoldStart,
  onDictateHoldEnd,
  onHoverCardEnter,
  onHoverCardLeave,
  onSuppressHover,
}: PdfDrawingDictationLayerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [badgeHoverId, setBadgeHoverId] = useState<string | null>(null)
  const wasDictatingRef = useRef(isDictating)

  useEffect(() => {
    if (wasDictatingRef.current && !isDictating) {
      setExpandedId(null)
    }
    wasDictatingRef.current = isDictating
  }, [isDictating])

  const dictationTarget =
    isDictating && dictationTargetId
      ? annotations.find((annotation) => annotation.annotation_id === dictationTargetId) ?? null
      : null

  const hoverId = !isDictating ? hoveredVoiceNoteId ?? badgeHoverId : null

  const expandedAnnotation =
    !isDictating && expandedId
      ? annotations.find((annotation) => annotation.annotation_id === expandedId) ?? null
      : null

  const hoveredAnnotation =
    !isDictating && hoverId && hoverId !== expandedId
      ? annotations.find((annotation) => annotation.annotation_id === hoverId) ?? null
      : null

  const editorAnnotation = dictationTarget ?? expandedAnnotation ?? hoveredAnnotation
  const editorIsListening = Boolean(dictationTarget && isDictating)
  const editorIsEditable = Boolean(
    editorAnnotation && !editorIsListening && expandedAnnotation?.annotation_id === editorAnnotation.annotation_id && onSaveNote,
  )
  const editorPreview =
    editorIsListening
      ? dictationPreview
      : editorAnnotation?.voice_note ?? ''

  const voiceNoteAnnotations = annotations.filter((annotation) => annotation.voice_note?.trim())

  const hideEditor = (annotationId: string) => {
    setExpandedId(null)
    setBadgeHoverId((current) => (current === annotationId ? null : current))
    onSuppressHover?.(annotationId)
    onHoverCardLeave?.()
  }

  if (!editorAnnotation && voiceNoteAnnotations.length === 0) {
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
        {editorAnnotation ? (
          <DictationDraftBubble
            annotation={editorAnnotation}
            previewText={editorPreview}
            viewport={viewport}
            isListening={editorIsListening}
            editable={editorIsEditable}
            speechNotesAvailable={speechNotesAvailable}
            onSave={
              onSaveNote
                ? (value) => onSaveNote(editorAnnotation.annotation_id, value)
                : undefined
            }
            onDictateHoldStart={
              onDictateHoldStart
                ? () => onDictateHoldStart(editorAnnotation.annotation_id)
                : undefined
            }
            onDictateHoldEnd={onDictateHoldEnd}
            onMinimize={() => hideEditor(editorAnnotation.annotation_id)}
            onExpand={
              editorIsEditable || editorIsListening
                ? undefined
                : () => {
                    setExpandedId(editorAnnotation.annotation_id)
                  }
            }
            onPointerEnter={onHoverCardEnter}
            onPointerLeave={onHoverCardLeave}
          />
        ) : null}

        {voiceNoteAnnotations
          .filter((annotation) => annotation.annotation_id !== editorAnnotation?.annotation_id)
          .map((annotation) => (
            <VoiceNotationBadge
              key={`voice-${annotation.annotation_id}`}
              annotation={annotation}
              viewport={viewport}
              onOpen={() => {
                setExpandedId(annotation.annotation_id)
              }}
              onPointerEnter={() => {
                setBadgeHoverId(annotation.annotation_id)
                onHoverCardEnter?.()
              }}
              onPointerLeave={() => {
                setBadgeHoverId((current) =>
                  current === annotation.annotation_id ? null : current,
                )
                onHoverCardLeave?.()
              }}
            />
          ))}
      </div>
    </>
  )
}
