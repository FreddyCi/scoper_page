const REVIEWER_NAME_STORAGE_KEY = 'bda-reviewer-name'

/** Derive 1–2 letter initials from a display name (e.g. "Christopher Kruger" → "CK") */
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase()
  }
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export function readReviewerNamePreference(): string {
  try {
    return sessionStorage.getItem(REVIEWER_NAME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeReviewerNamePreference(name: string): void {
  try {
    sessionStorage.setItem(REVIEWER_NAME_STORAGE_KEY, name)
  } catch {
    // sessionStorage unavailable
  }
}

export function reviewerInitialsFromName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return deriveInitials(trimmed)
}
