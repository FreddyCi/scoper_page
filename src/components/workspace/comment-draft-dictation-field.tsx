import { MicAudioLinesIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCommentDraftDictation } from '@/hooks/use-comment-draft-dictation'
import { cn } from '@/lib/utils'

type CommentDraftDictationFieldProps = {
  draft: string
  onDraftChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  enabled?: boolean
  className?: string
}

/** Review-note composer with optional hold-to-dictate mic (mark voice notation pattern). */
export function CommentDraftDictationField({
  draft,
  onDraftChange,
  placeholder,
  disabled = false,
  enabled = true,
  className,
}: CommentDraftDictationFieldProps) {
  const {
    speechNotesAvailable,
    isDictating,
    dictationError,
    displayDraft,
    beginDictation,
    endDictation,
    dismissDictationError,
  } = useCommentDraftDictation({
    draft,
    onDraftChange,
    enabled: enabled && !disabled,
  })

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground min-w-0 flex-1 text-[11px] leading-snug">
          {isDictating
            ? 'Listening… release the mic to add speech to your note'
            : speechNotesAvailable
              ? 'Type below, or hold the sound-wave button to dictate'
              : 'Voice dictation requires HTTPS and Chrome or Edge speech support'}
        </p>
        <Button
          type="button"
          size="icon-xs"
          variant={isDictating ? 'default' : 'ghost'}
          aria-label="Hold to dictate review note"
          disabled={disabled || !speechNotesAvailable}
          className={cn('shrink-0', isDictating && 'ring-1 ring-primary/50')}
          onPointerDown={(event) => {
            if (event.button !== 0 || disabled) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            beginDictation()
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            endDictation()
          }}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            endDictation()
          }}
        >
          <MicAudioLinesIcon className={cn('size-3.5', isDictating && 'animate-pulse')} />
        </Button>
      </div>

      <div className="border-border/70 bg-muted/40 rounded-lg border px-0.5 py-0.5">
        <textarea
          value={displayDraft}
          readOnly={isDictating || disabled}
          placeholder={placeholder}
          rows={3}
          aria-label="Review note draft"
          className="text-foreground placeholder:text-muted-foreground min-h-20 w-full resize-none border-0 bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-0"
          onChange={(event) => onDraftChange(event.target.value)}
        />
      </div>

      {dictationError ? (
        <div className="flex items-start justify-between gap-2">
          <p className="text-destructive text-xs leading-relaxed">{dictationError}</p>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-muted-foreground h-auto shrink-0 px-1 py-0 text-[11px]"
            onClick={dismissDictationError}
          >
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  )
}
