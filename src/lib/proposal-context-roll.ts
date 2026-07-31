import { getScoperClient } from '@/services/scoper-client'

/** RFP package classification — aligned with future `proposal-package-classifier` (BDA-156). */
export type ProposalPackageKind = 'solicitation' | 'contract_framework' | 'unknown'

export type ProposalHandoffSectionRef = {
  volumeId: string
  sectionId: string
  title: string
}

export type ProposalCompletedSection = ProposalHandoffSectionRef & {
  summary: string
}

export type ProposalHandoffState = {
  activeGoal: string
  completedSections: ProposalCompletedSection[]
  /** Rolling section headlines (max {@link PROPOSAL_TOPIC_MEMORY_MAX}). */
  topicMemory: string[]
  pendingSections: ProposalHandoffSectionRef[]
  packageKind: ProposalPackageKind
  /** Validation or generation failures — do not repeat in later sections. */
  doNotRepeat: string[]
}

export const PROPOSAL_TOPIC_MEMORY_MAX = 4

export function truncateTopicMemory(bullets: string[]): string[] {
  if (bullets.length <= PROPOSAL_TOPIC_MEMORY_MAX) {
    return bullets
  }
  return bullets.slice(-PROPOSAL_TOPIC_MEMORY_MAX)
}

export function createEmptyProposalHandoff(input: {
  activeGoal: string
  pendingSections: ProposalHandoffSectionRef[]
  packageKind?: ProposalPackageKind
}): ProposalHandoffState {
  return {
    activeGoal: input.activeGoal,
    completedSections: [],
    topicMemory: [],
    pendingSections: [...input.pendingSections],
    packageKind: input.packageKind ?? 'unknown',
    doNotRepeat: [],
  }
}

export function applySectionCompletion(
  handoff: ProposalHandoffState,
  completed: ProposalCompletedSection,
): ProposalHandoffState {
  const topicLine = `${completed.title}: ${completed.summary}`.trim()
  return {
    ...handoff,
    completedSections: [...handoff.completedSections, completed],
    pendingSections: handoff.pendingSections.filter(
      (section) =>
        !(
          section.volumeId === completed.volumeId && section.sectionId === completed.sectionId
        ),
    ),
    topicMemory: truncateTopicMemory([
      ...handoff.topicMemory,
      ...(topicLine ? [topicLine] : []),
    ]),
  }
}

export function recordProposalHandoffFailure(
  handoff: ProposalHandoffState,
  message: string,
): ProposalHandoffState {
  const trimmed = message.trim()
  if (!trimmed) {
    return handoff
  }
  return {
    ...handoff,
    doNotRepeat: [...handoff.doNotRepeat, trimmed],
  }
}

function formatBulletList(items: string[], emptyLabel: string): string {
  if (items.length === 0) {
    return `  ${emptyLabel}`
  }
  return items.map((item) => `  • ${item}`).join('\n')
}

function formatCompletedSections(completed: ProposalCompletedSection[]): string {
  if (completed.length === 0) {
    return '  (none yet)'
  }
  return completed
    .map(
      (section) =>
        `  • ${section.title} (${section.volumeId}/${section.sectionId}): ${section.summary}`,
    )
    .join('\n')
}

function formatPendingSections(pending: ProposalHandoffSectionRef[]): string {
  if (pending.length === 0) {
    return '  (none)'
  }
  return pending
    .map((section) => `  • ${section.title} (${section.volumeId}/${section.sectionId})`)
    .join('\n')
}

export type BuildProposalHandoffBlockOpts = {
  estimatedTokensSoFar?: number
}

/**
 * Studio-shaped handoff markdown for a fresh KV window between proposal sections.
 * @see scoper_studio/services/bun-server/src/utils/managed-llm-session.ts `buildHandoffBlock`
 */
export function buildProposalHandoffBlock(
  handoff: ProposalHandoffState,
  chunkIndex: number,
  opts?: BuildProposalHandoffBlockOpts,
): string {
  const tokensLabel =
    opts?.estimatedTokensSoFar != null
      ? ` | ~${opts.estimatedTokensSoFar.toLocaleString()} tokens so far`
      : ''

  const goal = handoff.activeGoal.trim() || '(not yet established)'
  const topicSummary =
    handoff.topicMemory.length > 0
      ? handoff.topicMemory.map((line) => `  • ${line}`).join('\n')
      : '  (no topic memory yet)'

  return [
    `[PROPOSAL CONTEXT HANDOFF — Roll ${chunkIndex}${tokensLabel}]`,
    `Package: ${handoff.packageKind}. Before writing the next section, read each block:`,
    '',
    '1. ACTIVE GOAL',
    `   ${goal}`,
    '',
    '2. COMPLETED SECTIONS — already written; do not duplicate this content',
    formatCompletedSections(handoff.completedSections),
    '',
    '3. PENDING SECTIONS — still required in this proposal run',
    formatPendingSections(handoff.pendingSections),
    '',
    '4. DO NOT REPEAT — prior failures or rejected patterns',
    formatBulletList(handoff.doNotRepeat, '(none)'),
    '',
    '5. TOPIC MEMORY — treat as lived context for consistency',
    topicSummary,
    '',
    'Write only the requested section. Do not output other volumes or writer instructions.',
    '---',
  ].join('\n')
}

/**
 * Micro roll between sections: clear KV cache; caller injects {@link buildProposalHandoffBlock} on the next send.
 */
export function rollProposalContext(
  resetConversation: () => void = () => {
    getScoperClient().resetConversation()
  },
): void {
  resetConversation()
}

/** Dev harness — handoff block + roll hook (BDA-154) */
export function runProposalContextRollHarness(): void {
  let resetCalls = 0
  const handoff = createEmptyProposalHandoff({
    activeGoal: 'Draft complete proposal volumes for the attached RFP',
    packageKind: 'solicitation',
    pendingSections: [
      { volumeId: 'vol-1', sectionId: 's-1', title: 'Executive Summary' },
      { volumeId: 'vol-1', sectionId: 's-2', title: 'Insurance' },
    ],
  })

  const withFailure = recordProposalHandoffFailure(
    handoff,
    'Do not paste placeholder "[TBD]" compliance tables',
  )

  const afterFirst = applySectionCompletion(withFailure, {
    volumeId: 'vol-1',
    sectionId: 's-1',
    title: 'Executive Summary',
    summary: 'Summarized approach and win themes.',
  })

  if (afterFirst.completedSections.length !== 1 || afterFirst.pendingSections.length !== 1) {
    throw new Error('runProposalContextRollHarness: section completion patch failed')
  }
  if (afterFirst.topicMemory.length !== 1) {
    throw new Error('runProposalContextRollHarness: expected topic memory entry')
  }

  let rolling = afterFirst
  for (let index = 0; index < 6; index += 1) {
    rolling = applySectionCompletion(rolling, {
      volumeId: 'vol-1',
      sectionId: `s-extra-${index}`,
      title: `Section ${index}`,
      summary: 'Done.',
    })
  }
  if (rolling.topicMemory.length !== PROPOSAL_TOPIC_MEMORY_MAX) {
    throw new Error(
      `runProposalContextRollHarness: topic memory cap expected ${PROPOSAL_TOPIC_MEMORY_MAX}, got ${rolling.topicMemory.length}`,
    )
  }

  const block = buildProposalHandoffBlock(rolling, 2, { estimatedTokensSoFar: 1200 })
  const required = [
    'ACTIVE GOAL',
    'COMPLETED SECTIONS',
    'PENDING SECTIONS',
    'DO NOT REPEAT',
    'TOPIC MEMORY',
    'Draft complete proposal',
    'placeholder',
    'Executive Summary',
    'Insurance',
  ]
  for (const snippet of required) {
    if (!block.includes(snippet)) {
      throw new Error(`runProposalContextRollHarness: handoff block missing "${snippet}"`)
    }
  }

  rollProposalContext(() => {
    resetCalls += 1
  })
  if (resetCalls !== 1) {
    throw new Error('runProposalContextRollHarness: expected single resetConversation call')
  }

  if (truncateTopicMemory(['a', 'b', 'c', 'd', 'e']).length !== PROPOSAL_TOPIC_MEMORY_MAX) {
    throw new Error('runProposalContextRollHarness: truncateTopicMemory failed')
  }
}
