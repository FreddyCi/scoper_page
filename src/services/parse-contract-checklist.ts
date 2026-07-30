/** One row from a Pro-Bel–style keyword checklist (Word / markdown). */
export type ContractChecklistItem = {
  id: string
  label: string
  /** Primary search phrases derived from the checklist line */
  searchTerms: string[]
  /** Exact substring the contract must contain (entity name checks) */
  mustContain?: string
  /** When true, contract should not contain the search terms */
  absenceCheck?: boolean
  /** Checklist expects amount/deferral review rather than a simple keyword hit */
  reviewKind?: 'contract_value' | 'liability_cap'
}

const CHECK_SPLIT = /(?=Check\s)/i

function slugId(index: number, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `check-${index}-${slug || 'item'}`
}

function extractQuotedStrings(text: string): string[] {
  const matches = [...text.matchAll(/[“"]([^”"]+)[”"]/g)]
  return matches.map((match) => match[1]?.trim()).filter(Boolean) as string[]
}

function termsFromLabel(label: string): string[] {
  const stripped = label
    .replace(/^Check\s+(for\s+)?/i, '')
    .replace(/^Check\s+/i, '')
    .replace(/\.(Check|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = stripped.match(/\b[a-zA-Z][a-zA-Z0-9'-]{2,}\b/g) ?? []
  const stop = new Set([
    'check',
    'for',
    'any',
    'language',
    'regarding',
    'about',
    'make',
    'sure',
    'that',
    'there',
    'not',
    'requirement',
    'have',
    'within',
    'specific',
    'from',
    'project',
    'site',
    'example',
    'and',
    'the',
    'are',
    'with',
    'must',
    'match',
    'value',
    'contract',
    'maximum',
    'or',
    'etc',
  ])

  const terms = words
    .map((word) => word.toLowerCase())
    .filter((word) => !stop.has(word))
    .slice(0, 8)

  return [...new Set(terms)]
}

function detectReviewKind(label: string): ContractChecklistItem['reviewKind'] {
  if (/check value of the contract/i.test(label)) return 'contract_value'
  if (/liability insurance/i.test(label) && /maximum/i.test(label)) return 'liability_cap'
  return undefined
}

function detectAbsence(label: string): boolean {
  return (
    /make sure that there is no/i.test(label) ||
    /no requirement to/i.test(label) ||
    (/check for any/i.test(label) && /buy america|buy american|locally|within \d+/i.test(label))
  )
}

/**
 * Parse a flattened checklist document (e.g. mammoth/docx blocks joined) into review items.
 */
export function parseContractChecklistText(raw: string): ContractChecklistItem[] {
  const normalized = raw.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const segments = normalized
    .split(CHECK_SPLIT)
    .map((part) => part.trim())
    .filter((part) => /^Check\s/i.test(part))

  return segments.map((segment, index) => {
    const label = segment.replace(/\s+/g, ' ').trim()
    const quoted = extractQuotedStrings(label)
    const mustMatch = /must match/i.test(label) ? quoted[0] : undefined
    const absenceCheck = detectAbsence(label)
    const reviewKind = detectReviewKind(label)

    let searchTerms = termsFromLabel(label)
    if (quoted.length > 0 && !mustMatch) {
      searchTerms = [...quoted.map((q) => q.toLowerCase()), ...searchTerms]
    }
    if (absenceCheck && searchTerms.length === 0) {
      if (/buy america|buy american/i.test(label)) {
        searchTerms = ['buy america', 'buy american']
      }
      if (/locally|mile radius|within \d+/i.test(label)) {
        searchTerms = ['locally sourced', 'mile radius', 'within 100']
      }
    }

    return {
      id: slugId(index, label),
      label,
      searchTerms: [...new Set(searchTerms)].slice(0, 10),
      mustContain: mustMatch,
      absenceCheck,
      reviewKind,
    }
  })
}
