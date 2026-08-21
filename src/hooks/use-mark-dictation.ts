import { useCallback, useMemo, useRef, useState } from 'react'

import { useSpeechNotes } from '@/hooks/use-speech-notes'
import { appendSpeechTranscript } from '@/lib/speech-notes'
import { isPdfMarkupShortcutTarget } from '@/lib/pdf-markup-tool-shortcuts'
import type { PdfDrawingAnnotation } from '@/lib/types'
import { isChatVoiceSessionActive } from '@/services/chat-voice-session'

export type MarkDictationStatus = 'idle' | 'listening' | 'error'

export type UseMarkDictationOptions = {
  markMode: boolean
  selectedAnnotationIds: readonly string[]
  annotations: PdfDrawingAnnotation[]
  updateMarkVoiceNote: (
    annotationId: string,
    voiceNote: string | null | undefined,
  ) => Promise<PdfDrawingAnnotation | null>
}

/** Merge an existing saved note with live dictation draft (BDA-249). */
export function mergeMarkDictationVoiceNote(
  existingVoiceNote: string | undefined,
  draftNote: string,
): string | undefined {
  const merged = appendSpeechTranscript(existingVoiceNote ?? '', draftNote)
  return merged.trim() || undefined
}

function isSpaceKeyboardEvent(event: KeyboardEvent): boolean {
  return event.key === ' ' || event.code === 'Space'
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `runMarkDictationMergeHarness failed: ${message} (expected ${String(expected)}, got ${String(actual)})`,
    )
  }
}

/** Dev harness — voice_note append merge on commit (BDA-249). */
export function runMarkDictationMergeHarness(): void {
  assertEqual(mergeMarkDictationVoiceNote(undefined, 'hello'), 'hello', 'draft only')
  assertEqual(
    mergeMarkDictationVoiceNote('North elevation', 'needs verification'),
    'North elevation needs verification',
    'append draft to existing',
  )
  assertEqual(
    mergeMarkDictationVoiceNote('North elevation', '   '),
    'North elevation',
    'ignore empty draft chunk',
  )
  assertEqual(mergeMarkDictationVoiceNote('', '   '), undefined, 'empty draft does not commit')
}

/** Hold-Space dictation orchestration for a single selected mark (BDA-249). */
export function useMarkDictation({
  markMode,
  selectedAnnotationIds,
  annotations,
  updateMarkVoiceNote,
}: UseMarkDictationOptions) {
  const [targetAnnotationId, setTargetAnnotationId] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const draftNoteRef = useRef(draftNote)
  draftNoteRef.current = draftNote

  const targetAnnotationIdRef = useRef(targetAnnotationId)
  targetAnnotationIdRef.current = targetAnnotationId

  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations

  const updateMarkVoiceNoteRef = useRef(updateMarkVoiceNote)
  updateMarkVoiceNoteRef.current = updateMarkVoiceNote

  const spaceActiveRef = useRef(false)
  const commitInFlightRef = useRef(false)

  const handleTranscript = useCallback((text: string) => {
    setDraftNote((previous) => appendSpeechTranscript(previous, text))
  }, [])

  const {
    available,
    status: speechStatus,
    isListening,
    errorMessage,
    startListening,
    stopListening,
    dismissError,
  } = useSpeechNotes({ onTranscript: handleTranscript })

  const commitDraft = useCallback(async (annotationId: string, draft: string) => {
    const draftTrimmed = draft.trim()
    if (!draftTrimmed || commitInFlightRef.current) return

    commitInFlightRef.current = true
    try {
      const existing = annotationsRef.current.find(
        (annotation) => annotation.annotation_id === annotationId,
      )?.voice_note
      const merged = mergeMarkDictationVoiceNote(existing, draftTrimmed)
      if (merged) {
        await updateMarkVoiceNoteRef.current(annotationId, merged)
      }
    } finally {
      commitInFlightRef.current = false
    }
  }, [])

  const resetDictationSession = useCallback(() => {
    spaceActiveRef.current = false
    setTargetAnnotationId(null)
    setDraftNote('')
  }, [])

  const finishDictation = useCallback(
    (annotationId: string | null) => {
      const target = annotationId ?? targetAnnotationIdRef.current
      const draft = draftNoteRef.current
      stopListening()
      resetDictationSession()
      if (target) {
        void commitDraft(target, draft)
      }
    },
    [commitDraft, resetDictationSession, stopListening],
  )

  const canStartDictation = useCallback(() => {
    if (!markMode || !available) return false
    if (selectedAnnotationIds.length !== 1) return false
    if (isPdfMarkupShortcutTarget(document.activeElement)) return false
    if (isChatVoiceSessionActive()) return false
    if (isListening || targetAnnotationIdRef.current) return false
    if (speechStatus === 'error') return false
    return true
  }, [available, isListening, markMode, selectedAnnotationIds.length, speechStatus])

  const canDictate = useMemo(() => {
    if (!markMode || !available) return false
    if (selectedAnnotationIds.length !== 1) return false
    if (isChatVoiceSessionActive()) return false
    if (isListening || targetAnnotationId) return false
    if (speechStatus === 'error') return false
    return true
  }, [
    available,
    isListening,
    markMode,
    selectedAnnotationIds.length,
    speechStatus,
    targetAnnotationId,
  ])

  const beginDictation = useCallback(() => {
    if (!canStartDictation()) return false

    const annotationId = selectedAnnotationIds[0]
    if (!annotationId) return false

    spaceActiveRef.current = true
    setTargetAnnotationId(annotationId)
    setDraftNote('')
    startListening()
    return true
  }, [canStartDictation, selectedAnnotationIds, startListening])

  const endDictation = useCallback(() => {
    if (!spaceActiveRef.current && !targetAnnotationIdRef.current) return
    finishDictation(targetAnnotationIdRef.current)
  }, [finishDictation])

  const handleSpaceKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isSpaceKeyboardEvent(event) || event.repeat) return false
      if (!canStartDictation()) return false

      const annotationId = selectedAnnotationIds[0]
      if (!annotationId) return false

      spaceActiveRef.current = true
      setTargetAnnotationId(annotationId)
      setDraftNote('')
      startListening()
      return true
    },
    [canStartDictation, selectedAnnotationIds, startListening],
  )

  const handleSpaceKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (!isSpaceKeyboardEvent(event)) return
      if (!spaceActiveRef.current && !targetAnnotationIdRef.current) return
      finishDictation(targetAnnotationIdRef.current)
    },
    [finishDictation],
  )

  const onSelectionChange = useCallback(
    (selectedIds: readonly string[]) => {
      const target = targetAnnotationIdRef.current
      if (!target || !isListening) return
      if (selectedIds.length === 1 && selectedIds[0] === target) return
      finishDictation(target)
    },
    [finishDictation, isListening],
  )

  const onWindowBlur = useCallback(() => {
    if (!spaceActiveRef.current && !isListening) return
    finishDictation(targetAnnotationIdRef.current)
  }, [finishDictation, isListening])

  const committedPreview = useMemo(() => {
    if (!targetAnnotationId) return undefined
    const existing = annotations.find(
      (annotation) => annotation.annotation_id === targetAnnotationId,
    )?.voice_note
    if (!existing && !draftNote.trim()) return undefined
    return mergeMarkDictationVoiceNote(existing, draftNote)
  }, [annotations, draftNote, targetAnnotationId])

  const status: MarkDictationStatus =
    speechStatus === 'error' ? 'error' : isListening ? 'listening' : 'idle'

  return {
    available,
    status,
    isDictating: isListening,
    canDictate,
    targetAnnotationId,
    draftNote,
    committedPreview,
    errorMessage,
    handleSpaceKeyDown,
    handleSpaceKeyUp,
    beginDictation,
    endDictation,
    onSelectionChange,
    onWindowBlur,
    dismissError,
  }
}
