import {
  checkContextThreshold,
  type ContextThresholdTier,
  getPageContextConfig,
  type PageContextConfig,
} from '@/lib/page-context-manager'
import {
  computeContextUsage,
  createEmptyContextUsageSegments,
  type ContextUsageResult,
  type ContextUsageSegmentKind,
} from '@/lib/context-usage'

export class ProposalContextOverflowError extends Error {
  readonly name = 'ProposalContextOverflowError'

  readonly charsUsed: number

  readonly contextSize: number

  constructor(charsUsed: number, contextSize: number) {
    super(proposalContextHardLimitMessage(charsUsed, contextSize))
    this.charsUsed = charsUsed
    this.contextSize = contextSize
  }
}

export type ProposalContextTrackerSnapshot = {
  proposalContextCharsUsed: number
  contextSize: number
  tier: ContextThresholdTier
}

export type CreateProposalContextTrackerOptions = {
  /** From `getScoperClient().getState().maxSeqLen` after engine load. */
  effectiveMaxSeqLen?: number | null
  /** Test harness override (e.g. tiny contextSize). */
  config?: PageContextConfig
}

export function proposalContextHardLimitMessage(
  charsUsed: number,
  contextSize: number,
): string {
  const windowLabel = contextSize >= 8192 ? '8K' : '4K'
  return (
    `This section prompt exceeds the on-device context window (~${windowLabel}). ` +
    'Narrow the RFP scope or regenerate after the model finishes loading. ' +
    `(~${Math.round(charsUsed / 4).toLocaleString()} / ${contextSize.toLocaleString()} tokens estimated.)`
  )
}

/**
 * Tracks characters charged to the current proposal KV window (resets on sectional roll).
 * Uses the same chars÷4 token heuristic as {@link checkContextThreshold}.
 */
export class ProposalContextTracker {
  private proposalContextCharsUsed = 0

  private segmentChars = createEmptyContextUsageSegments()

  private readonly config: PageContextConfig

  constructor(options: CreateProposalContextTrackerOptions = {}) {
    this.config =
      options.config ?? getPageContextConfig(options.effectiveMaxSeqLen ?? null)
  }

  getConfig(): PageContextConfig {
    return this.config
  }

  getSnapshot(): ProposalContextTrackerSnapshot {
    return {
      proposalContextCharsUsed: this.proposalContextCharsUsed,
      contextSize: this.config.contextSize,
      tier: checkContextThreshold(this.proposalContextCharsUsed, this.config),
    }
  }

  getContextUsage(): ContextUsageResult {
    return computeContextUsage({ segments: { ...this.segmentChars } }, { config: this.config })
  }

  /** Clear after {@link rollProposalContext} between sections. */
  reset(): void {
    this.proposalContextCharsUsed = 0
    this.segmentChars = createEmptyContextUsageSegments()
  }

  recordChars(charCount: number): ContextThresholdTier {
    if (charCount > 0) {
      this.proposalContextCharsUsed += charCount
    }
    return checkContextThreshold(this.proposalContextCharsUsed, this.config)
  }

  recordSegment(kind: ContextUsageSegmentKind, text: string | number): ContextThresholdTier {
    if (kind === 'reserved') {
      return this.getSnapshot().tier
    }
    const chars = typeof text === 'number' ? text : text.length
    if (chars <= 0) {
      return checkContextThreshold(this.proposalContextCharsUsed, this.config)
    }
    this.segmentChars[kind] += chars
    return this.recordChars(chars)
  }

  recordText(text: string): ContextThresholdTier {
    return this.recordSegment('active_turn', text)
  }

  /**
   * Throws {@link ProposalContextOverflowError} when usage is above the hard roll threshold.
   * Call after assembling the full section/volume prompt, before `scoper.send`.
   */
  assertNotHard(): void {
    const { proposalContextCharsUsed, contextSize, tier } = this.getSnapshot()
    if (tier === 'hard') {
      throw new ProposalContextOverflowError(proposalContextCharsUsed, contextSize)
    }
  }
}

export function createProposalContextTracker(
  options?: CreateProposalContextTrackerOptions,
): ProposalContextTracker {
  return new ProposalContextTracker(options)
}

/** Dev harness — hard-tier abort (BDA-155) */
export function runProposalContextTrackerHarness(): void {
  const tinyConfig = getPageContextConfig(4096)
  const tracker = createProposalContextTracker({
    config: { ...tinyConfig, contextSize: 400, hardRollThreshold: 0.85 },
  })

  tracker.recordSegment('system', 'x'.repeat(100))
  tracker.assertNotHard()

  tracker.recordSegment('active_turn', 'y'.repeat(1400))
  let threw = false
  try {
    tracker.assertNotHard()
  } catch (error) {
    threw = error instanceof ProposalContextOverflowError
  }
  if (!threw) {
    throw new Error('runProposalContextTrackerHarness: expected hard-tier overflow')
  }

  const usage = tracker.getContextUsage()
  if (usage.totalChars !== tracker.getSnapshot().proposalContextCharsUsed) {
    throw new Error('runProposalContextTrackerHarness: usage chars should match tracker total')
  }

  tracker.reset()
  if (tracker.getSnapshot().proposalContextCharsUsed !== 0) {
    throw new Error('runProposalContextTrackerHarness: reset did not clear chars')
  }
  if (tracker.getContextUsage().totalTokens !== 0) {
    throw new Error('runProposalContextTrackerHarness: reset should clear segment usage')
  }
  tracker.assertNotHard()

  const sized = createProposalContextTracker({ effectiveMaxSeqLen: 8192 })
  if (sized.getConfig().contextSize !== 8192) {
    throw new Error('runProposalContextTrackerHarness: 8K config not wired')
  }
}
