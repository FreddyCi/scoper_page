import { useCallback, useEffect, useRef, useState } from 'react'

import { useSpeechNotes } from '@/hooks/use-speech-notes'
import { appendSpeechTranscript } from '@/lib/speech-notes'
import { isChatVoiceSessionActive } from '@/services/chat-voice-session'

export type UseCommentDraftDictationOptions = {
  draft: string
  onDraftChange: (value: string) => void
  /** When false, stops any active session (e.g. popover closed). */
  enabled?: boolean
}

/** Hold-to-talk dictation into a block-comment draft — does not persist until caller saves (BDA-082+). */
export function useCommentDraftDictation({
  draft,
  onDraftChange,
  enabled = true,
}: UseCommentDraftDictationOptions) {
  const [dictationChunk, setDictationChunk] = useState('')
  const draftRef = useRef(draft)
  draftRef.current = draft

  const dictationChunkRef = useRef(dictationChunk)
  dictationChunkRef.current = dictationChunk

  const onDraftChangeRef = useRef(onDraftChange)
  onDraftChangeRef.current = onDraftChange

  const handleTranscript = useCallback((text: string) => {
    setDictationChunk((previous) => appendSpeechTranscript(previous, text))
  }, [])

  const {
    available,
    isListening,
    errorMessage,
    startListening,
    stopListening,
    dismissError,
  } = useSpeechNotes({ onTranscript: handleTranscript })

  const stopAndMerge = useCallback(() => {
    const chunk = dictationChunkRef.current.trim()
    stopListening()
    setDictationChunk('')
    if (chunk) {
      onDraftChangeRef.current(appendSpeechTranscript(draftRef.current, chunk))
    }
  }, [stopListening])

  const beginDictation = useCallback(() => {
    if (!enabled || !available || isChatVoiceSessionActive() || isListening) {
      return false
    }
    setDictationChunk('')
    startListening()
    return true
  }, [available, enabled, isListening, startListening])

  useEffect(() => {
    if (enabled) return
    if (isListening || dictationChunkRef.current.trim()) {
      stopAndMerge()
    }
  }, [enabled, isListening, stopAndMerge])

  useEffect(() => {
    if (!isListening) return undefined

    function handleInterrupt() {
      stopAndMerge()
    }

    window.addEventListener('blur', handleInterrupt)
    document.addEventListener('visibilitychange', handleInterrupt)
    return () => {
      window.removeEventListener('blur', handleInterrupt)
      document.removeEventListener('visibilitychange', handleInterrupt)
    }
  }, [isListening, stopAndMerge])

  const speechNotesAvailable = enabled && available
  const displayDraft = isListening
    ? appendSpeechTranscript(draft, dictationChunk)
    : draft

  return {
    speechNotesAvailable,
    isDictating: isListening,
    dictationError: errorMessage,
    displayDraft,
    beginDictation,
    endDictation: stopAndMerge,
    dismissDictationError: dismissError,
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `runCommentDraftDictationHarness failed: ${message} (expected ${String(expected)}, got ${String(actual)})`,
    )
  }
}

/** Dev harness — merge dictated chunk into comment draft (mirrors mark dictation append). */
export function runCommentDraftDictationHarness(): void {
  assertEqual(
    appendSpeechTranscript('section 16 review', 'needs legal'),
    'section 16 review needs legal',
    'append dictated chunk to typed draft',
  )
  assertEqual(appendSpeechTranscript('', 'spoken note'), 'spoken note', 'dictation-only draft')
}
