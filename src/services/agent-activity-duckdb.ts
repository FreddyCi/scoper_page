import type { AgentActivityEntry, AgentActivityKind } from '@/lib/agent-activity'
import { AGENT_ACTIVITY_LOG_MAX } from '@/lib/agent-activity'
import type { ShareTableRow } from '@/lib/share-table'
import { getDuckdbClient } from '@/services/duckdb-client'

type AgentActivityRow = {
  activity_id: string
  kind: string
  label: string
  detail: string | null
  logged_at: string
  shimmer: number
}

const VALID_KINDS = new Set<AgentActivityKind>([
  'status',
  'ecp',
  'section_write',
  'separator',
  'compacting',
  'soft_recall',
  'error',
])

function rowToEntry(row: AgentActivityRow): AgentActivityEntry {
  const kind = VALID_KINDS.has(row.kind as AgentActivityKind)
    ? (row.kind as AgentActivityKind)
    : 'status'
  return {
    id: row.activity_id,
    kind,
    label: row.label,
    detail: row.detail ?? undefined,
    at: row.logged_at,
    shimmer: row.shimmer === 1 ? true : undefined,
  }
}

/** Persist one agent activity row (fire-and-forget safe). */
export async function insertAgentActivityEntry(entry: AgentActivityEntry): Promise<void> {
  const client = await getDuckdbClient()
  await client.query(
    `INSERT OR REPLACE INTO agent_activity_log
      (activity_id, kind, label, detail, logged_at, shimmer)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.kind,
      entry.label,
      entry.detail ?? null,
      entry.at,
      entry.shimmer ? 1 : 0,
    ],
  )
}

/** Load recent agent activity for History / session hydrate. */
export async function fetchAgentActivityLog(limit = AGENT_ACTIVITY_LOG_MAX): Promise<AgentActivityEntry[]> {
  const client = await getDuckdbClient()
  const rows = (await client.query(
    `SELECT activity_id, kind, label, detail, logged_at, shimmer
     FROM agent_activity_log
     ORDER BY logged_at ASC
     LIMIT ?`,
    [limit],
  )) as AgentActivityRow[]

  if (rows.length <= AGENT_ACTIVITY_LOG_MAX) {
    return rows.map(rowToEntry)
  }

  return rows.slice(-AGENT_ACTIVITY_LOG_MAX).map(rowToEntry)
}

/** Trim oldest rows beyond cap. */
export async function trimAgentActivityLogInDuckdb(max = AGENT_ACTIVITY_LOG_MAX): Promise<void> {
  const client = await getDuckdbClient()
  await client.query(
    `DELETE FROM agent_activity_log
     WHERE activity_id NOT IN (
       SELECT activity_id FROM agent_activity_log ORDER BY logged_at DESC LIMIT ?
     )`,
    [max],
  )
}

export async function clearAgentActivityLogInDuckdb(): Promise<void> {
  const client = await getDuckdbClient()
  await client.query('DELETE FROM agent_activity_log')
}

export function agentActivityEntriesFromShareRows(rows: ShareTableRow[]): AgentActivityEntry[] {
  return rows.map((row) => {
    const kind = VALID_KINDS.has(String(row.kind) as AgentActivityKind)
      ? (String(row.kind) as AgentActivityKind)
      : 'status'
    const loggedAt = row.logged_at ?? row.at
    return {
      id: String(row.activity_id),
      kind,
      label: String(row.label),
      detail: row.detail != null && String(row.detail).length > 0 ? String(row.detail) : undefined,
      at: String(loggedAt),
      shimmer: row.shimmer === 1 || row.shimmer === '1' ? true : undefined,
    }
  })
}

/** Dev harness — agent activity DuckDB round-trip */
export async function runAgentActivityDuckdbHarness(): Promise<void> {
  await clearAgentActivityLogInDuckdb()

  const entry: AgentActivityEntry = {
    id: 'act-harness-1',
    kind: 'ecp',
    label: 'find_clause',
    detail: 'Insurance requirements',
    at: new Date().toISOString(),
  }

  await insertAgentActivityEntry(entry)
  const loaded = await fetchAgentActivityLog()
  if (!loaded.some((row) => row.id === entry.id && row.kind === 'ecp')) {
    throw new Error('runAgentActivityDuckdbHarness: expected persisted entry')
  }

  await clearAgentActivityLogInDuckdb()
  const afterClear = await fetchAgentActivityLog()
  if (afterClear.length !== 0) {
    throw new Error('runAgentActivityDuckdbHarness: clear failed')
  }
}
