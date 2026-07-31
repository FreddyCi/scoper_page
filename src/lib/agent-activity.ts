import type { ContextUsageResult } from '@/lib/context-usage'

export type ContextPhase =
  | 'idle'
  | 'generating'
  | 'find_clause'
  | 'soft_recall'
  | 'compacting'

export type AgentActivityKind =
  | 'status'
  | 'ecp'
  | 'section_write'
  | 'separator'
  | 'compacting'
  | 'soft_recall'
  | 'error'

export type AgentActivityEntry = {
  id: string
  kind: AgentActivityKind
  label: string
  detail?: string
  at: string
  /** When true, render with {@link MarkerContent} `shimmer` / {@link MARKER_SHIMMER_CLASS} (BDA-172). */
  shimmer?: boolean
}

export const AGENT_ACTIVITY_LOG_MAX = 80

export type AgentActivitySlice = {
  agentActivityLog: AgentActivityEntry[]
  contextUsageSnapshot: ContextUsageResult | null
  contextPhase: ContextPhase
}

export function createAgentActivityInitialState(): AgentActivitySlice {
  return {
    agentActivityLog: [],
    contextUsageSnapshot: null,
    contextPhase: 'idle',
  }
}

export function clearAgentActivityState(): AgentActivitySlice {
  return createAgentActivityInitialState()
}

export function trimAgentActivityLog(entries: AgentActivityEntry[]): AgentActivityEntry[] {
  if (entries.length <= AGENT_ACTIVITY_LOG_MAX) {
    return entries
  }
  return entries.slice(-AGENT_ACTIVITY_LOG_MAX)
}

export function appendAgentActivityEntry(
  log: AgentActivityEntry[],
  entry: Omit<AgentActivityEntry, 'id' | 'at'> & { id?: string; at?: string },
): AgentActivityEntry[] {
  const next: AgentActivityEntry = {
    id: entry.id ?? `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? new Date().toISOString(),
    kind: entry.kind,
    label: entry.label,
    detail: entry.detail,
    shimmer: entry.shimmer,
  }
  return trimAgentActivityLog([...log, next])
}

/** Dev harness — activity log helpers (BDA-170) */
export function runAgentActivityHarness(): void {
  let log: AgentActivityEntry[] = []

  log = appendAgentActivityEntry(log, {
    kind: 'compacting',
    label: 'Compacting proposal context',
    shimmer: true,
  })
  log = appendAgentActivityEntry(log, {
    kind: 'ecp',
    label: 'find_clause',
    detail: 'Insurance requirements',
  })
  log = appendAgentActivityEntry(log, {
    kind: 'section_write',
    label: 'Writing section',
    detail: 'Insurance',
  })

  if (log.length !== 3) {
    throw new Error('runAgentActivityHarness: expected three entries')
  }

  for (let index = 0; index < AGENT_ACTIVITY_LOG_MAX + 5; index += 1) {
    log = appendAgentActivityEntry(log, {
      kind: 'status',
      label: `Status ${index}`,
    })
  }
  if (log.length !== AGENT_ACTIVITY_LOG_MAX) {
    throw new Error(`runAgentActivityHarness: expected cap ${AGENT_ACTIVITY_LOG_MAX}, got ${log.length}`)
  }

  const cleared = clearAgentActivityState()
  if (cleared.agentActivityLog.length !== 0 || cleared.contextPhase !== 'idle') {
    throw new Error('runAgentActivityHarness: clear should reset slice')
  }
}
