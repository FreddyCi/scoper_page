/**
 * Shared shall / must detector — scope creep (`compare-scope`) and compliance matrix extract.
 * Recreate via `obligationPattern()` or use `countObligationMatches` so the `g` flag does not leak `lastIndex`.
 */
export const OBLIGATION_SOURCE = String.raw`\b(shall|must|will\s+provide|required\s+to)\b`

export function obligationPattern(): RegExp {
  return new RegExp(OBLIGATION_SOURCE, 'gi')
}

export function countObligationMatches(text: string): number {
  return text.match(obligationPattern())?.length ?? 0
}

export function hasObligation(text: string): boolean {
  return obligationPattern().test(text)
}
