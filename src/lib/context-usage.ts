import {
  CHARS_PER_TOKEN_ESTIMATE,
  checkContextThreshold,
  estimateTokensFromChars,
  getPageContextConfig,
  type ContextThresholdTier,
  type PageContextConfig,
} from '@/lib/page-context-manager'

export type ContextUsageSegmentKind =
  | 'system'
  | 'ecp_tool'
  | 'rfp_label'
  | 'handoff'
  | 'active_turn'
  | 'reserved'

export type ContextUsageSegment = {
  kind: ContextUsageSegmentKind
  label: string
  chars: number
  tokens: number
}

export type ContextUsageSnapshot = {
  segments: Partial<Record<Exclude<ContextUsageSegmentKind, 'reserved'>, number>>
}

export type ContextUsageResult = {
  percentFull: number
  totalTokens: number
  totalChars: number
  contextSize: number
  tier: ContextThresholdTier
  segments: ContextUsageSegment[]
}

export const CONTEXT_USAGE_SEGMENT_LABELS: Record<ContextUsageSegmentKind, string> = {
  system: 'System instructions',
  ecp_tool: 'ECP / tool retrieval',
  rfp_label: 'RFP document context',
  handoff: 'Proposal handoff',
  active_turn: 'Active turn',
  reserved: 'Reserved for generation',
}

const ACCOUNTABLE_SEGMENT_ORDER: Exclude<ContextUsageSegmentKind, 'reserved'>[] = [
  'system',
  'ecp_tool',
  'rfp_label',
  'handoff',
  'active_turn',
]

export function createEmptyContextUsageSegments(): Record<
  Exclude<ContextUsageSegmentKind, 'reserved'>,
  number
> {
  return {
    system: 0,
    ecp_tool: 0,
    rfp_label: 0,
    handoff: 0,
    active_turn: 0,
  }
}

export type ComputeContextUsageOptions = {
  config?: PageContextConfig
  effectiveMaxSeqLen?: number | null
}

/**
 * Breakdown of KV window fill for Context Usage UI (BDA-169).
 * Uses the same chars÷4 heuristic as {@link checkContextThreshold}.
 */
export function computeContextUsage(
  snapshot: ContextUsageSnapshot,
  options: ComputeContextUsageOptions = {},
): ContextUsageResult {
  const config = options.config ?? getPageContextConfig(options.effectiveMaxSeqLen ?? null)

  const segments: ContextUsageSegment[] = []
  let totalChars = 0

  for (const kind of ACCOUNTABLE_SEGMENT_ORDER) {
    const chars = snapshot.segments[kind] ?? 0
    if (chars <= 0) continue
    totalChars += chars
    segments.push({
      kind,
      label: CONTEXT_USAGE_SEGMENT_LABELS[kind],
      chars,
      tokens: estimateTokensFromChars(chars),
    })
  }

  const totalTokens = estimateTokensFromChars(totalChars)
  const reservedTokens = Math.max(0, config.contextSize - totalTokens)

  if (reservedTokens > 0) {
    segments.push({
      kind: 'reserved',
      label: CONTEXT_USAGE_SEGMENT_LABELS.reserved,
      chars: reservedTokens * CHARS_PER_TOKEN_ESTIMATE,
      tokens: reservedTokens,
    })
  }

  const percentFull =
    config.contextSize > 0
      ? Math.min(100, Math.round((totalTokens / config.contextSize) * 1000) / 10)
      : 0

  return {
    percentFull,
    totalTokens,
    totalChars,
    contextSize: config.contextSize,
    tier: checkContextThreshold(totalChars, config),
    segments,
  }
}

/** Dev harness — segment accounting (BDA-169) */
export function runContextUsageHarness(): void {
  const config = getPageContextConfig(8192)
  const snapshot: ContextUsageSnapshot = {
    segments: {
      system: 800,
      ecp_tool: 120,
      rfp_label: 200,
      handoff: 1600,
      active_turn: 6400,
    },
  }

  const usage = computeContextUsage(snapshot, { config })
  const accountableTokens = usage.segments
    .filter((segment) => segment.kind !== 'reserved')
    .reduce((sum, segment) => sum + segment.tokens, 0)

  if (accountableTokens !== usage.totalTokens) {
    throw new Error('runContextUsageHarness: segment token sum mismatch')
  }
  if (accountableTokens > config.contextSize) {
    throw new Error('runContextUsageHarness: accountable tokens exceed context size')
  }

  const expectedPercent = Math.round((usage.totalTokens / config.contextSize) * 1000) / 10
  if (usage.percentFull !== expectedPercent) {
    throw new Error(
      `runContextUsageHarness: percentFull expected ${expectedPercent}, got ${usage.percentFull}`,
    )
  }

  if (usage.tier !== checkContextThreshold(usage.totalChars, config)) {
    throw new Error('runContextUsageHarness: tier should match checkContextThreshold')
  }

  const reserved = usage.segments.find((segment) => segment.kind === 'reserved')
  if (!reserved || reserved.tokens !== config.contextSize - usage.totalTokens) {
    throw new Error('runContextUsageHarness: reserved segment mismatch')
  }
}
