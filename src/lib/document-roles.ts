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
  supporting: 'Reference material (excluded from comparison)',
  unknown: 'Role not set — tag before scope analysis',
}

export function isDocumentRole(value: unknown): value is DocumentRole {
  return typeof value === 'string' && DOCUMENT_ROLES.includes(value as DocumentRole)
}
