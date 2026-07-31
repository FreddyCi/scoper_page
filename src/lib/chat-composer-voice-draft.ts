/** Combine pre-mic composer text with the live voice segment (BDA-190). */
export function mergeComposerVoiceDraft(preMicText: string, voiceSegment: string): string {
  const voice = voiceSegment.trim()
  if (!voice) return preMicText
  if (!preMicText.trim()) return voice
  if (/\s$/.test(preMicText)) return `${preMicText}${voice}`
  return `${preMicText} ${voice}`
}

/** Dev harness — composer voice draft merge (BDA-190). */
export function runChatComposerVoiceDraftHarness(): void {
  const cases: { pre: string; voice: string; expected: string }[] = [
    { pre: 'Check the ', voice: 'indemnity clause', expected: 'Check the indemnity clause' },
    { pre: 'Hello', voice: 'world', expected: 'Hello world' },
    { pre: '', voice: 'find the clause', expected: 'find the clause' },
    { pre: 'Keep this', voice: '', expected: 'Keep this' },
    { pre: 'Trailing space ', voice: 'more', expected: 'Trailing space more' },
  ]

  for (const { pre, voice, expected } of cases) {
    const actual = mergeComposerVoiceDraft(pre, voice)
    if (actual !== expected) {
      throw new Error(
        `runChatComposerVoiceDraftHarness: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      )
    }
  }
}
