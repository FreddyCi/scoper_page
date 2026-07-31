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

/** Max activity rows rendered at the bottom of the agent transcript (BDA-173). */
export const AGENT_ACTIVITY_TRANSCRIPT_TAIL = 24

export function shouldShowAgentActivityStrip(state: {
  chatGenerating: boolean
  proposalGenerating: boolean
  contextPhase: ContextPhase
}): boolean {
  return (
    state.chatGenerating ||
    state.proposalGenerating ||
    state.contextPhase === 'compacting'
  )
}

export function tailAgentActivityLog(
  log: AgentActivityEntry[],
  max = AGENT_ACTIVITY_TRANSCRIPT_TAIL,
): AgentActivityEntry[] {
  if (log.length <= max) return log
  return log.slice(-max)
}

export function buildFallbackAgentActivityEntries(state: {
  chatGenerating: boolean
  proposalGenerating: boolean
  contextPhase: ContextPhase
}): AgentActivityEntry[] {
  if (state.contextPhase === 'compacting') {
    return [
      {
        id: 'fallback-compacting',
        kind: 'compacting',
        at: '',
        label: state.proposalGenerating
          ? 'Compacting proposal context'
          : 'Compacting conversation',
        shimmer: true,
      },
    ]
  }

  if (state.proposalGenerating) {
    return [
      {
        id: 'fallback-proposal-generate',
        kind: 'status',
        at: '',
        label: 'Generating proposal volumes…',
        shimmer: true,
      },
    ]
  }

  if (state.chatGenerating) {
    return [
      {
        id: 'fallback-chat-generate',
        kind: 'status',
        at: '',
        label: 'Generating…',
        shimmer: true,
      },
    ]
  }

  return []
}

export function resolveAgentActivityTranscriptEntries(
  log: AgentActivityEntry[],
  state: {
    chatGenerating: boolean
    proposalGenerating: boolean
    contextPhase: ContextPhase
  },
): AgentActivityEntry[] {
  const tail = tailAgentActivityLog(log)
  if (tail.length > 0) return tail
  return buildFallbackAgentActivityEntries(state)
}

export function agentActivityEntryUsesStatusRole(kind: AgentActivityKind): boolean {
  return (
    kind === 'status' ||
    kind === 'compacting' ||
    kind === 'soft_recall'
  )
}

export function agentActivityEntryShimmer(entry: AgentActivityEntry): boolean {
  if (entry.shimmer === true) return true
  return entry.kind === 'compacting' || entry.kind === 'soft_recall'
}

/** Dev harness — transcript tail + fallbacks (BDA-173) */
export function runAgentActivityTranscriptHarness(): void {
  if (!shouldShowAgentActivityStrip({ chatGenerating: true, proposalGenerating: false, contextPhase: 'idle' })) {
    throw new Error('runAgentActivityTranscriptHarness: chatGenerating should show strip')
  }
  if (
    shouldShowAgentActivityStrip({
      chatGenerating: false,
      proposalGenerating: false,
      contextPhase: 'find_clause',
    })
  ) {
    throw new Error('runAgentActivityTranscriptHarness: find_clause alone should not show strip')
  }

  const log = Array.from({ length: 30 }, (_, index) => ({
    id: `e-${index}`,
    kind: 'status' as const,
    label: `Row ${index}`,
    at: new Date().toISOString(),
  }))
  if (tailAgentActivityLog(log).length !== AGENT_ACTIVITY_TRANSCRIPT_TAIL) {
    throw new Error('runAgentActivityTranscriptHarness: tail length mismatch')
  }

  const fallback = buildFallbackAgentActivityEntries({
    chatGenerating: false,
    proposalGenerating: true,
    contextPhase: 'generating',
  })
  if (fallback.length !== 1 || !fallback[0]?.label.includes('proposal')) {
    throw new Error('runAgentActivityTranscriptHarness: proposal fallback missing')
  }

  const compacting = buildFallbackAgentActivityEntries({
    chatGenerating: false,
    proposalGenerating: true,
    contextPhase: 'compacting',
  })
  if (compacting[0]?.label !== 'Compacting proposal context') {
    throw new Error('runAgentActivityTranscriptHarness: compacting fallback mismatch')
  }
}
