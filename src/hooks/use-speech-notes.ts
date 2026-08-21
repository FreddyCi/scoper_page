import { useCallback, useEffect, useRef, useState } from 'react'

import {
  finalTranscriptsFromEvent,
  getSpeechRecognitionCtor,
  speechNotesAvailable,
  type SpeechRecognitionLike,
} from '@/lib/speech-notes'

export type SpeechNotesStatus = 'idle' | 'listening' | 'error'

export type UseSpeechNotesOptions = {
  onTranscript: (text: string) => void
}

function speechRecognitionErrorMessage(error: string): string {
  if (error === 'not-allowed') {
    return 'Microphone permission was denied.'
  }
  if (error === 'service-not-allowed') {
    return 'Speech recognition is not available in this browser.'
  }
  return `Speech recognition error: ${error}`
}

/** Web Speech API dictation — hold-to-talk consumers call start/stop separately (BDA-248). */
export function useSpeechNotes({ onTranscript }: UseSpeechNotesOptions) {
  const [available] = useState(() =>
    typeof window !== 'undefined' ? speechNotesAvailable(window) : false,
  )
  const [status, setStatus] = useState<SpeechNotesStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setStatus('idle')
  }, [])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || !available) return
    if (recognitionRef.current) return

    const Ctor = getSpeechRecognitionCtor(window)
    if (!Ctor) return

    setErrorMessage(null)
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'

    recognition.onresult = (event) => {
      const text = finalTranscriptsFromEvent(event)
      if (text) onTranscriptRef.current(text)
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      setErrorMessage(speechRecognitionErrorMessage(event.error))
      setStatus('error')
      recognitionRef.current = null
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setStatus((previous) => (previous === 'listening' ? 'idle' : previous))
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setStatus('listening')
    } catch {
      setErrorMessage('Could not start speech recognition.')
      setStatus('error')
    }
  }, [available])

  const dismissError = useCallback(() => {
    setErrorMessage(null)
    setStatus('idle')
  }, [])

  return {
    available,
    status,
    isListening: status === 'listening',
    errorMessage,
    startListening,
    stopListening,
    dismissError,
  }
}
