const FILLER_WORD_PATTERN =
  /\b(?:um+|uh+|ah+|er+|hm+|hmm+|mmm+)\b(?:[,.])?(?=\s|$)/gi

/** Remove standalone speech fillers and normalize whitespace (BDA-186). */
export function cleanSpeechTranscript(text: string): string {
  if (!text.trim()) return ''

  let cleaned = text.replace(FILLER_WORD_PATTERN, ' ')
  cleaned = cleaned.replace(/\s{2,}/g, ' ')
  cleaned = cleaned.replace(/^\s+/, '').replace(/\s+$/, '')
  cleaned = cleaned.replace(/\s+([,.!?;:])/g, '$1')

  return cleaned
}

/** Dev harness — filler cleanup (BDA-186). */
export function runSpeechTranscriptCleanupHarness(): void {
  const cases: { input: string; expected: string }[] = [
    {
      input: 'um so uh find the indemnity clause',
      expected: 'so find the indemnity clause',
    },
    {
      input: 'Uh, ah, er — hmm start over',
      expected: '— start over',
    },
    {
      input: '  mmm   okay   mmm   got it  ',
      expected: 'okay got it',
    },
    {
      input: 'umbrella coverage and aha moment',
      expected: 'umbrella coverage and aha moment',
    },
    {
      input: 'The umbral shift is not a filler',
      expected: 'The umbral shift is not a filler',
    },
    {
      input: '',
      expected: '',
    },
  ]

  for (const { input, expected } of cases) {
    const actual = cleanSpeechTranscript(input)
    if (actual !== expected) {
      throw new Error(
        `runSpeechTranscriptCleanupHarness: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)} for input ${JSON.stringify(input)}`,
      )
    }
  }

  if (cleanSpeechTranscript('   ').length !== 0) {
    throw new Error('runSpeechTranscriptCleanupHarness: whitespace-only should be empty')
  }
}
