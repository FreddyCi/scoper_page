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
  baseline: 'Original scope / SOW to compare against',
  change_request: 'Addendum or change request to evaluate',
  supporting: 'Reference context (included in search and scope analysis)',
  unknown: 'Role not set — tag before scope analysis',
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
