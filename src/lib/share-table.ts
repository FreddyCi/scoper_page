import type { WorkspaceMode, WorkspaceView } from '@/lib/types'

/** Share pack format version — bump when payload shape changes. */
export const SHARE_PACK_VERSION = 2 as const

export type SharePackVersion = typeof SHARE_PACK_VERSION

/** DuckDB tables included in a workspace share pack. */
export type ShareTableId =
  | 'documents'
  | 'blocks'
  | 'comments'
  | 'results_profiles'
  | 'profile_criteria'
  | 'scope_flags'
  | 'proposal_profiles'
  | 'proposal_volumes'
  | 'proposal_volume_sections'

export type ShareTableRow = Record<string, string | number | null>

/** Registry entry mapping a DuckDB table to export/import behavior. */
export type ShareTableDefinition = {
  id: ShareTableId
  tableName: string
  columns: readonly string[]
  /** Lower values import first (respects logical dependencies). */
  importOrder: number
  selectSql: string
}

export const SHARE_TABLE_REGISTRY: readonly ShareTableDefinition[] = [
  {
    id: 'documents',
    tableName: 'documents',
    columns: ['doc_id', 'filename', 'mime', 'role', 'uploaded_at'],
    importOrder: 1,
    selectSql: `SELECT doc_id, filename, mime, role, uploaded_at FROM documents ORDER BY doc_id`,
  },
  {
    id: 'blocks',
    tableName: 'blocks',
    columns: [
      'block_id',
      'doc_id',
      'page_num',
      'section_path',
      'text',
      'x',
      'y',
      'width',
      'height',
    ],
    importOrder: 2,
    selectSql: `SELECT block_id, doc_id, page_num, section_path, text, x, y, width, height
                FROM blocks ORDER BY doc_id, block_id`,
  },
  {
    id: 'results_profiles',
    tableName: 'results_profiles',
    columns: ['profile_id', 'mode', 'doc_id', 'verdict', 'subject_json', 'summary'],
    importOrder: 3,
    selectSql: `SELECT profile_id, mode, doc_id, verdict, subject_json, summary
                FROM results_profiles ORDER BY profile_id`,
  },
  {
    id: 'profile_criteria',
    tableName: 'profile_criteria',
    columns: ['profile_id', 'criterion_id', 'status', 'label', 'detail', 'block_id'],
    importOrder: 4,
    selectSql: `SELECT profile_id, criterion_id, status, label, detail, block_id
                FROM profile_criteria ORDER BY profile_id, criterion_id`,
  },
  {
    id: 'scope_flags',
    tableName: 'scope_flags',
    columns: [
      'flag_id',
      'baseline_doc_id',
      'candidate_doc_id',
      'flag_type',
      'severity',
      'summary',
      'block_ids',
    ],
    importOrder: 5,
    selectSql: `SELECT flag_id, baseline_doc_id, candidate_doc_id, flag_type, severity, summary, block_ids
                FROM scope_flags ORDER BY baseline_doc_id, candidate_doc_id, flag_id`,
  },
  {
    id: 'comments',
    tableName: 'comments',
    columns: ['comment_id', 'block_id', 'text', 'author_initials', 'created_at'],
    importOrder: 6,
    selectSql: `SELECT comment_id, block_id, text, author_initials, created_at
                FROM comments ORDER BY created_at, comment_id`,
  },
  {
    id: 'proposal_profiles',
    tableName: 'proposal_profiles',
    columns: [
      'profile_id',
      'rfp_doc_id',
      'summary',
      'built_at',
      'package_kind',
      'package_warnings_json',
    ],
    importOrder: 7,
    selectSql: `SELECT profile_id, rfp_doc_id, summary, built_at, package_kind, package_warnings_json
                FROM proposal_profiles ORDER BY profile_id`,
  },
  {
    id: 'proposal_volumes',
    tableName: 'proposal_volumes',
    columns: [
      'profile_id',
      'volume_id',
      'title',
      'requirement_summary',
      'solicitation_refs_json',
      'body_markdown',
      'status',
      'error_message',
      'edited',
      'edited_at',
      'generation_progress_json',
      'analysis_refs_json',
    ],
    importOrder: 8,
    selectSql: `SELECT profile_id, volume_id, title, requirement_summary, solicitation_refs_json,
                       body_markdown, status, error_message, edited, edited_at,
                       generation_progress_json, analysis_refs_json
                FROM proposal_volumes ORDER BY profile_id, volume_id`,
  },
  {
    id: 'proposal_volume_sections',
    tableName: 'proposal_volume_sections',
    columns: [
      'profile_id',
      'volume_id',
      'section_id',
      'title',
      'find_clause_query',
      'status',
      'body_markdown',
      'error_message',
      'edited',
      'edited_at',
      'citations_json',
    ],
    importOrder: 9,
    selectSql: `SELECT profile_id, volume_id, section_id, title, find_clause_query, status,
                       body_markdown, error_message, edited, edited_at, citations_json
                FROM proposal_volume_sections
                ORDER BY profile_id, volume_id, section_id`,
  },
] as const

export function getShareTableById(id: ShareTableId): ShareTableDefinition {
  const definition = SHARE_TABLE_REGISTRY.find((entry) => entry.id === id)
  if (!definition) {
    throw new Error(`Unknown share table: ${id}`)
  }
  return definition
}

export function getShareTablesInImportOrder(): ShareTableDefinition[] {
  return [...SHARE_TABLE_REGISTRY].sort((a, b) => a.importOrder - b.importOrder)
}

export function getShareTablesInClearOrder(): ShareTableDefinition[] {
  return [...SHARE_TABLE_REGISTRY].sort((a, b) => b.importOrder - a.importOrder)
}

/** Session/UI fields stored alongside DuckDB rows (chat state excluded). */
export type ShareSessionManifest = {
  version: SharePackVersion
  exported_at: string
  /** Import maps legacy `scope_creep` → `proposal`. */
  mode: WorkspaceMode | 'scope_creep'
  evaluationDocId: string | null
  evaluationBaselineProfileId: string | null
  companyContext: string
  reviewerName: string
  activeDocId: string | null
  workspaceView: WorkspaceView
  proposalRequirementsProfileId: string | null
}

/** Raw document bytes bundled with the share pack. */
export type ShareDocumentPayload = {
  doc_id: string
  filename: string
  mime: string
  sha256: string
  data_base64: string
}

/** Decrypted share pack before encryption wrapper is applied. */
export type SharePackPayload = {
  manifest: ShareSessionManifest
  tables: Record<ShareTableId, ShareTableRow[]>
  documents: ShareDocumentPayload[]
}

export type SharePackExportSummary = {
  shareId: string
  keyBase64Url: string
  tableCounts: Record<ShareTableId, number>
  documentCount: number
  encryptedBytes: Uint8Array
}
