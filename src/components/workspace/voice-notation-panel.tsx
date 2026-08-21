import { useEffect, useMemo, useState } from 'react'
import { MicAudioLinesIcon, MessageSquareXIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import type { PdfDrawingAnnotation } from '@/lib/types'
import { cn } from '@/lib/utils'

function markKindLabel(annotation: PdfDrawingAnnotation): string {
  switch (annotation.geometry.kind) {
    case 'stamp':
      return 'Window marker'
    case 'text':
      return annotation.text_body?.trim() || 'Text label'
    case 'rect':
      return 'Rectangle'
    case 'ellipse':
      return 'Ellipse'
    case 'stroke':
      return annotation.tool === 'highlighter' ? 'Highlight' : 'Stroke'
    default:
      return 'Mark'
  }
}

export type VoiceNotationPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageNumber: number
  annotations: PdfDrawingAnnotation[]
  selectedAnnotationId?: string | null
  onSelectAnnotation: (annotationId: string) => void
  onSaveNote: (annotationId: string, voiceNote: string) => void
  onClearNote: (annotationId: string) => void
  speechNotesAvailable?: boolean
  isDictating?: boolean
  dictationTargetId?: string | null
  dictationPreview?: string
  onDictateHoldStart: (annotationId: string) => void
  onDictateHoldEnd: () => void
}

function VoiceNotationEditorRow({
  annotation,
  selected,
  speechNotesAvailable,
  isDictating,
  livePreview,
  onSelect,
  onSave,
  onClear,
  onDictateHoldStart,
  onDictateHoldEnd,
}: {
  annotation: PdfDrawingAnnotation
  selected: boolean
  speechNotesAvailable: boolean
  isDictating: boolean
  livePreview?: string
  onSelect: () => void
  onSave: (value: string) => void
  onClear: () => void
  onDictateHoldStart: () => void
  onDictateHoldEnd: () => void
}) {
  const saved = annotation.voice_note ?? ''
  const [draft, setDraft] = useState(saved)

  useEffect(() => {
    if (isDictating) return
    setDraft(saved)
  }, [isDictating, saved])

  const displayValue = isDictating ? (livePreview ?? draft) : draft
  const canClear = Boolean(displayValue.trim())

  return (
    <Card
      size="sm"
      className={cn(
        'border-border bg-surface gap-0 overflow-hidden rounded-xl border py-0 shadow-sm',
        selected && 'ring-1 ring-primary/40',
      )}
    >
      <CardHeader className="flex flex-row items-start gap-2.5 border-b border-border/70 px-3 py-2.5">
        <span
          className="mt-1 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: annotation.color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <CardTitle className="text-sm font-semibold tracking-tight">
            {markKindLabel(annotation)}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            {isDictating
              ? 'Listening · release to save'
              : 'Type below, or hold the sound-wave button to dictate'}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            size="icon-xs"
            variant={isDictating ? 'default' : 'ghost'}
            aria-label="Hold to dictate this notation"
            disabled={!speechNotesAvailable}
            className={cn(isDictating && 'ring-1 ring-primary/50')}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              onSelect()
              onDictateHoldStart()
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              onDictateHoldEnd()
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              onDictateHoldEnd()
            }}
          >
            <MicAudioLinesIcon className={cn('size-3.5', isDictating && 'animate-pulse')} />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Clear voice notation"
            disabled={!canClear || isDictating}
            onClick={() => {
              setDraft('')
              onClear()
            }}
          >
            <MessageSquareXIcon className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 py-3">
        <div className="border-border/70 bg-muted/40 rounded-lg border px-0.5 py-0.5">
          <Textarea
            aria-label={`Voice notation for ${markKindLabel(annotation)}`}
            value={displayValue}
            readOnly={isDictating}
            placeholder="Type a note, or hold the sound-wave button to dictate…"
            className="text-muted-foreground min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            onFocus={() => onSelect()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (isDictating) return
              if (draft.trim() === saved.trim()) return
              onSave(draft)
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export function VoiceNotationPanel({
  open,
  onOpenChange,
  pageNumber,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onSaveNote,
  onClearNote,
  speechNotesAvailable = true,
  isDictating = false,
  dictationTargetId,
  dictationPreview,
  onDictateHoldStart,
  onDictateHoldEnd,
}: VoiceNotationPanelProps) {
  const listed = useMemo(() => {
    const withNotes = annotations.filter((annotation) => annotation.voice_note?.trim())
    const selected = selectedAnnotationId
      ? annotations.find((annotation) => annotation.annotation_id === selectedAnnotationId)
      : undefined
    if (selected && !withNotes.some((row) => row.annotation_id === selected.annotation_id)) {
      return [selected, ...withNotes]
    }
    return withNotes
  }, [annotations, selectedAnnotationId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md" showCloseButton>
        <SheetHeader className="border-border/70 border-b">
          <SheetTitle>Voice notations</SheetTitle>
          <SheetDescription>
            Page {pageNumber} · type to edit, or hold the sound-wave button / Space to dictate.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {listed.length === 0 ? (
            <Card
              size="sm"
              className="border-border bg-muted/30 gap-0 rounded-xl border py-0 shadow-none"
            >
              <CardHeader className="px-3 py-3">
                <CardTitle className="text-sm font-semibold">No notations yet</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Click a marker or shape on the plan, then type here or hold Space to dictate.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            listed.map((annotation) => {
              const dictatingThis =
                isDictating && dictationTargetId === annotation.annotation_id
              return (
                <VoiceNotationEditorRow
                  key={annotation.annotation_id}
                  annotation={annotation}
                  selected={selectedAnnotationId === annotation.annotation_id}
                  speechNotesAvailable={speechNotesAvailable}
                  isDictating={dictatingThis}
                  livePreview={dictatingThis ? dictationPreview : undefined}
                  onSelect={() => onSelectAnnotation(annotation.annotation_id)}
                  onSave={(value) => onSaveNote(annotation.annotation_id, value)}
                  onClear={() => onClearNote(annotation.annotation_id)}
                  onDictateHoldStart={() => onDictateHoldStart(annotation.annotation_id)}
                  onDictateHoldEnd={onDictateHoldEnd}
                />
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
