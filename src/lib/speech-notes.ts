/** Append dictated text to existing notes (single space between segments). */
export function appendSpeechTranscript(existing: string, transcript: string): string {
  const chunk = transcript.trim()
  if (!chunk) return existing
  const base = existing.trimEnd()
  if (!base) return chunk
  return `${base} ${chunk}`
}

export interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: { isFinal: boolean; [index: number]: { transcript: string } }
  }
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike

export function getSpeechRecognitionCtor(
  win: Window & { webkitSpeechRecognition?: SpeechRecognitionCtor },
): SpeechRecognitionCtor | null {
  const w = win as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Browser speech support in a secure context (Web Speech API). */
export function speechNotesAvailable(
  win: Window & { webkitSpeechRecognition?: SpeechRecognitionCtor },
): boolean {
  if (!win.isSecureContext) {
    return false
  }
  return getSpeechRecognitionCtor(win) != null
}

export function finalTranscriptsFromEvent(event: SpeechRecognitionEventLike): string {
  const parts: string[] = []
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i]
    if (result?.isFinal) {
      const text = result[0]?.transcript?.trim()
      if (text) parts.push(text)
    }
  }
  return parts.join(' ')
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`runSpeechNotesHarness failed: ${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

/** Dev harness — append + availability + final transcript extraction (BDA-247). */
export function runSpeechNotesHarness(): void {
  assertEqual(appendSpeechTranscript('Hello', 'world'), 'Hello world', 'append with space')
  assertEqual(appendSpeechTranscript('', '  note  '), 'note', 'empty existing returns transcript only')
  assertEqual(appendSpeechTranscript('Hi', '   '), 'Hi', 'ignores empty transcript')

  assertEqual(
    speechNotesAvailable({ isSecureContext: true } as Window),
    false,
    'requires speech API',
  )
  assertEqual(
    speechNotesAvailable({ isSecureContext: false } as Window),
    false,
    'requires secure context',
  )

  const withStandardApi = {
    isSecureContext: true,
    SpeechRecognition: class {},
  } as Window & { SpeechRecognition: SpeechRecognitionCtor }
  assertEqual(speechNotesAvailable(withStandardApi), true, 'standard SpeechRecognition ctor')

  const withWebkitApi = {
    isSecureContext: true,
    webkitSpeechRecognition: class {},
  } as Window & { webkitSpeechRecognition: SpeechRecognitionCtor }
  assertEqual(speechNotesAvailable(withWebkitApi), true, 'webkitSpeechRecognition ctor')

  const event: SpeechRecognitionEventLike = {
    resultIndex: 1,
    results: {
      length: 3,
      0: { isFinal: true, 0: { transcript: 'skip' } },
      1: { isFinal: true, 0: { transcript: 'hello' } },
      2: { isFinal: false, 0: { transcript: 'interim' } },
    },
  }
  assertEqual(finalTranscriptsFromEvent(event), 'hello', 'final segments from result index')
}
