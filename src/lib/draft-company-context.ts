/** Heuristic buyer-context draft until on-device generate is wired */
export function draftCompanyContext(focusAreas: string[] = []): string {
  const lines = [
    'Organization: Enterprise procurement team',
    'Industry: Public-sector IT services',
    'Must-haves: CMMI Level 3 · $2M general liability · fixed-fee pricing',
    'Deal-breakers: T&M-only proposals · offshore-only delivery',
    'Evaluation priority: Compliance and delivery certainty over lowest cost',
  ]

  if (focusAreas.length > 0) {
    lines.push(`RFP focus areas: ${focusAreas.join(', ')}`)
  }

  return lines.join('\n')
}
