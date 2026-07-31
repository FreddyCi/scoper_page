import type { ProposalSectionActivityEvent } from '@/lib/agent-activity'
import type { ContextPhase } from '@/lib/agent-activity'
import {
  createProposalContextTracker,
  type ProposalContextTracker,
} from '@/lib/proposal-context-tracker'
import { rollProposalContext } from '@/lib/proposal-context-roll'
import { getPageContextConfig } from '@/lib/page-context-manager'
import { useSessionStore } from '@/store/session-store'
import { getScoperClient } from '@/services/scoper-client'

function getActivityStore() {
  return useSessionStore.getState()
}

export function syncContextUsageFromTracker(tracker: ProposalContextTracker): void {
  getActivityStore().setContextUsageSnapshot(tracker.getContextUsage())
}

export function rollProposalContextWithActivity(
  tracker?: ProposalContextTracker,
  options: {
    label?: string
    resetConversation?: () => void
  } = {},
): void {
  const label =
    options.label ??
    (getActivityStore().proposalGenerating
      ? 'Compacting proposal context'
      : 'Compacting conversation')

  const store = getActivityStore()
  store.setContextPhase('compacting')
  store.pushAgentActivity({
    kind: 'compacting',
    label,
    shimmer: true,
  })

  rollProposalContext(options.resetConversation)
  tracker?.reset()
  if (tracker) {
    syncContextUsageFromTracker(tracker)
  }

  store.setContextPhase(
    store.proposalGenerating || store.chatGenerating ? 'generating' : 'idle',
  )
}

export function emitProposalSectionActivity(
  event: ProposalSectionActivityEvent,
  tracker?: ProposalContextTracker,
): void {
  const store = getActivityStore()
  const detail = event.sectionTitle

  switch (event.kind) {
    case 'roll':
      if (tracker) syncContextUsageFromTracker(tracker)
      break
    case 'find_clause':
      store.setContextPhase('find_clause')
      store.pushAgentActivity({
        kind: 'ecp',
        label: 'find_clause',
        detail: event.message ? `${detail} — ${event.message}` : detail,
      })
      if (tracker) syncContextUsageFromTracker(tracker)
      store.setContextPhase('generating')
      break
    case 'writing':
      store.setContextPhase('generating')
      store.pushAgentActivity({
        kind: 'section_write',
        label: 'Writing section',
        detail,
      })
      if (tracker) syncContextUsageFromTracker(tracker)
      break
    case 'validated':
      store.pushAgentActivity({
        kind: 'status',
        label: 'Validated section',
        detail,
      })
      if (tracker) syncContextUsageFromTracker(tracker)
      break
    case 'section_error':
      store.pushAgentActivity({
        kind: 'error',
        label: event.message ?? 'Section validation failed',
        detail,
      })
      if (tracker) syncContextUsageFromTracker(tracker)
      break
    default:
      break
  }
}

function notifyProposalSectionActivity(
  event: ProposalSectionActivityEvent,
  tracker: ProposalContextTracker,
  onSectionActivity?: (event: ProposalSectionActivityEvent) => void,
): void {
  emitProposalSectionActivity(event, tracker)
  onSectionActivity?.(event)
}

export function notifyProposalSectionRoll(
  event: Omit<ProposalSectionActivityEvent, 'kind'>,
  tracker: ProposalContextTracker,
  onSectionActivity?: (event: ProposalSectionActivityEvent) => void,
): void {
  rollProposalContextWithActivity(tracker)
  notifyProposalSectionActivity({ ...event, kind: 'roll' }, tracker, onSectionActivity)
}

export { notifyProposalSectionActivity }

let chatTurnTracker: ProposalContextTracker | null = null

export function getChatContextTracker(): ProposalContextTracker {
  if (!chatTurnTracker) {
    chatTurnTracker = createProposalContextTracker({
      effectiveMaxSeqLen: getScoperClient().getState().maxSeqLen,
    })
  }
  return chatTurnTracker
}

export function resetChatContextTracker(): ProposalContextTracker {
  chatTurnTracker = createProposalContextTracker({
    effectiveMaxSeqLen: getScoperClient().getState().maxSeqLen,
  })
  return chatTurnTracker
}

export function setChatContextPhase(phase: ContextPhase): void {
  getActivityStore().setContextPhase(phase)
}

export function emitChatFindClauseStart(query: string): void {
  const tracker = getChatContextTracker()
  tracker.recordSegment('ecp_tool', query)
  const store = getActivityStore()
  store.setContextPhase('find_clause')
  store.pushAgentActivity({
    kind: 'ecp',
    label: 'find_clause',
    detail: query.slice(0, 120),
  })
  syncContextUsageFromTracker(tracker)
}

export function emitChatFindClauseComplete(matchCount: number): void {
  const tracker = getChatContextTracker()
  getActivityStore().pushAgentActivity({
    kind: 'status',
    label: 'find_clause complete',
    detail: `${matchCount} match${matchCount === 1 ? '' : 'es'}`,
  })
  syncContextUsageFromTracker(tracker)
  setChatContextPhase('generating')
}

export function emitChatSoftRecallIfNeeded(tracker: ProposalContextTracker): void {
  if (tracker.getSnapshot().tier !== 'soft') return
  const store = getActivityStore()
  store.setContextPhase('soft_recall')
  store.pushAgentActivity({
    kind: 'soft_recall',
    label: 'Soft recall — trimming context',
    shimmer: true,
  })
  syncContextUsageFromTracker(tracker)
  store.setContextPhase('generating')
}

export function emitChatHardRollIfNeeded(tracker: ProposalContextTracker): boolean {
  if (tracker.getSnapshot().tier !== 'hard') return false
  rollProposalContextWithActivity(tracker, { label: 'Compacting conversation' })
  return true
}

export function recordChatTurnText(tracker: ProposalContextTracker, text: string): void {
  tracker.recordSegment('active_turn', text)
  emitChatSoftRecallIfNeeded(tracker)
  emitChatHardRollIfNeeded(tracker)
  syncContextUsageFromTracker(tracker)
}

/** Dev harness — proposal + chat activity emissions (BDA-174) */
export function runAgentActivityEmissionsHarness(): void {
  const store = getActivityStore()
  store.resetSession()

  store.setContextPhase('generating')
  useSessionStore.setState({ proposalGenerating: true })

  const tracker = createProposalContextTracker({ effectiveMaxSeqLen: 8192 })
  let resetCalls = 0

  notifyProposalSectionRoll(
    {
      volumeId: 'vol-1',
      sectionId: 'sec-1',
      sectionTitle: 'Insurance',
    },
    tracker,
  )

  notifyProposalSectionActivity(
    { kind: 'find_clause', volumeId: 'vol-1', sectionId: 'sec-1', sectionTitle: 'Insurance' },
    tracker,
  )
  notifyProposalSectionActivity(
    { kind: 'writing', volumeId: 'vol-1', sectionId: 'sec-1', sectionTitle: 'Insurance' },
    tracker,
  )
  notifyProposalSectionActivity(
    { kind: 'validated', volumeId: 'vol-1', sectionId: 'sec-1', sectionTitle: 'Insurance' },
    tracker,
  )

  const log = useSessionStore.getState().agentActivityLog
  const kinds = log.map((entry) => entry.kind)
  for (const required of ['compacting', 'ecp', 'section_write', 'status'] as const) {
    if (!kinds.includes(required)) {
      throw new Error(`runAgentActivityEmissionsHarness: missing log kind ${required}`)
    }
  }
  if (useSessionStore.getState().contextUsageSnapshot == null) {
    throw new Error('runAgentActivityEmissionsHarness: expected usage snapshot refresh')
  }

  rollProposalContextWithActivity(tracker, {
    resetConversation: () => {
      resetCalls += 1
    },
  })
  if (resetCalls !== 1) {
    throw new Error('runAgentActivityEmissionsHarness: expected roll reset hook')
  }

  store.resetSession()
  resetChatContextTracker()
  emitChatFindClauseStart('indemnification clause')
  emitChatFindClauseComplete(2)

  const chatLog = useSessionStore.getState().agentActivityLog
  if (!chatLog.some((entry) => entry.kind === 'ecp')) {
    throw new Error('runAgentActivityEmissionsHarness: chat find_clause emission missing')
  }

  const softTracker = createProposalContextTracker({
    config: {
      ...getPageContextConfig(4096),
      contextSize: 800,
      softRecallThreshold: 0.55,
      hardRollThreshold: 0.85,
    },
  })
  softTracker.recordSegment('active_turn', 'x'.repeat(1800))
  emitChatSoftRecallIfNeeded(softTracker)

  if (!useSessionStore.getState().agentActivityLog.some((entry) => entry.kind === 'soft_recall')) {
    throw new Error('runAgentActivityEmissionsHarness: expected soft_recall when tier is soft')
  }

  store.resetSession()
}
