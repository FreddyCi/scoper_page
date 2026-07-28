import { getDuckdbClient } from '@/services/duckdb-client'
import type { CitationRef, ScopeCreepFlag, ScopeCreepProfile, ScopeCreepSeverity } from '@/lib/types'
import { blockToCitation } from '@/lib/types'

type ScopeFlagRow = {
  flag_id: string
  baseline_doc_id: string
  candidate_doc_id: string
  flag_type: string
  severity: string
  summary: string
  block_ids: string | null
}

function parseBlockIds(raw: string | null): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return raw.split(',').map((id) => id.trim()).filter(Boolean)
  }
}

async function hydrateEvidence(blockIds: string[]): Promise<CitationRef[]> {
  if (blockIds.length === 0) return []

  const duckdb = await getDuckdbClient()
  const placeholders = blockIds.map(() => '?').join(', ')
  const rows = await duckdb.query<{
    block_id: string
    doc_id: string
    page_num: number | null
    text: string
    x: number | null
    y: number | null
    width: number | null
    height: number | null
  }>(
    `SELECT block_id, doc_id, page_num, text, x, y, width, height
     FROM blocks WHERE block_id IN (${placeholders})`,
    blockIds,
  )

  const byId = new Map(rows.map((row) => [row.block_id, row]))
  const evidence: CitationRef[] = []

  for (const blockId of blockIds) {
    const row = byId.get(blockId)
    if (!row) continue

    evidence.push(
      blockToCitation({
        block_id: row.block_id,
        doc_id: row.doc_id,
        page_num: row.page_num ?? undefined,
        text: row.text,
        x: row.x ?? undefined,
        y: row.y ?? undefined,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
      }),
    )
  }

  return evidence
}

export async function clearScopeFlagsForPair(
  baselineDocId: string,
  candidateDocId: string,
): Promise<void> {
  const duckdb = await getDuckdbClient()
  await duckdb.query(
    `DELETE FROM scope_flags
     WHERE baseline_doc_id = ? AND candidate_doc_id = ?`,
    [baselineDocId, candidateDocId],
  )
}

export async function persistScopeCreepProfile(profile: ScopeCreepProfile): Promise<void> {
  const duckdb = await getDuckdbClient()
  await clearScopeFlagsForPair(profile.baseline_doc_id, profile.candidate_doc_id)

  for (const flag of profile.flags) {
    const blockIds = flag.evidence.map((citation) => citation.block_id)
    await duckdb.query(
      `INSERT OR REPLACE INTO scope_flags
        (flag_id, baseline_doc_id, candidate_doc_id, flag_type, severity, summary, block_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        flag.id,
        profile.baseline_doc_id,
        profile.candidate_doc_id,
        flag.flag_type,
        flag.severity,
        flag.summary,
        JSON.stringify(blockIds),
      ],
    )
  }
}

export async function fetchScopeCreepProfiles(): Promise<ScopeCreepProfile[]> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<ScopeFlagRow>(
    `SELECT flag_id, baseline_doc_id, candidate_doc_id, flag_type, severity, summary, block_ids
     FROM scope_flags
     ORDER BY baseline_doc_id, candidate_doc_id, flag_id`,
  )

  const grouped = new Map<string, ScopeCreepProfile>()

  for (const row of rows) {
    const pairKey = `${row.baseline_doc_id}::${row.candidate_doc_id}`
    let profile = grouped.get(pairKey)

    if (!profile) {
      profile = {
        profile_id: `creep-${row.baseline_doc_id}-${row.candidate_doc_id}`,
        baseline_doc_id: row.baseline_doc_id,
        candidate_doc_id: row.candidate_doc_id,
        verdict: 'aligned',
        flags: [],
        summary: '',
      }
      grouped.set(pairKey, profile)
    }

    const evidence = await hydrateEvidence(parseBlockIds(row.block_ids))
    profile.flags.push({
      id: row.flag_id,
      flag_type: row.flag_type,
      severity: row.severity as ScopeCreepSeverity,
      summary: row.summary,
      evidence,
    })
  }

  for (const profile of grouped.values()) {
    profile.verdict = verdictFromFlags(profile.flags)
    profile.summary = buildProfileSummary(profile)
  }

  return [...grouped.values()]
}

function verdictFromFlags(flags: ScopeCreepFlag[]): ScopeCreepProfile['verdict'] {
  if (flags.some((flag) => flag.severity === 'high')) return 'creep'
  if (flags.some((flag) => flag.severity === 'medium') || flags.length >= 2) {
    return 'possible_creep'
  }
  if (flags.length > 0) return 'possible_creep'
  return 'aligned'
}

function buildProfileSummary(profile: ScopeCreepProfile): string {
  if (profile.flags.length === 0) {
    return 'No scope drift flags detected between the baseline and change documents.'
  }

  const high = profile.flags.filter((flag) => flag.severity === 'high').length
  const medium = profile.flags.filter((flag) => flag.severity === 'medium').length

  if (high > 0) {
    return `Found ${profile.flags.length} scope flag${profile.flags.length === 1 ? '' : 's'} including ${high} high-severity item${high === 1 ? '' : 's'}. Review evidence citations before sign-off.`
  }

  if (medium > 0) {
    return `Found ${profile.flags.length} possible scope drift flag${profile.flags.length === 1 ? '' : 's'} with ${medium} medium-severity signal${medium === 1 ? '' : 's'}.`
  }

  return `Found ${profile.flags.length} low-severity scope note${profile.flags.length === 1 ? '' : 's'} between baseline and change documents.`
}

export async function countScopeFlags(): Promise<number> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<{ count: number }>(
    'SELECT COUNT(*)::INTEGER AS count FROM scope_flags',
  )
  return rows[0]?.count ?? 0
}
