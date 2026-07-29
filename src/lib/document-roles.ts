import type { DocumentRole } from '@/lib/types'

export const DOCUMENT_ROLES: DocumentRole[] = [
  'baseline',
  'change_request',
  'supporting',
  'unknown',
]

export const DOCUMENT_ROLE_LABELS: Record<DocumentRole, string> = {
  baseline: 'Baseline',
  change_request: 'Change',
  supporting: 'Supporting',
  unknown: 'Unknown',
}

export const DOCUMENT_ROLE_DESCRIPTIONS: Record<DocumentRole, string> = {
  baseline: 'Original scope or SOW — the reference you compare against',
  change_request: 'Proposed change or addendum to compare against baseline',
  supporting: 'Background material for search, chat, and analysis',
  unknown: 'Not categorized yet — set a role before comparing or qualifying',
}

/** Default role for newly ingested documents when none is stored yet */
export function defaultRoleForIngest(mime: string): DocumentRole {
  if (mime === 'text/markdown') {
    return 'supporting'
  }
  return 'unknown'
}

export function isDocumentRole(value: unknown): value is DocumentRole {
  return typeof value === 'string' && DOCUMENT_ROLES.includes(value as DocumentRole)
}
