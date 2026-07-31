import {
  getScoperMaxSeqLenFromEnv,
  type ScoperMaxSeqLen,
} from '@/lib/scoper-model'

/**
 * Page app unified context window (UCW) policy — 8K physical KV by default.
 * Port of Studio threshold logic only; no server-side roll persistence.
 *
 * @see scoper_studio/services/bun-server/src/utils/context-manager.ts
 */

export type ContextThresholdTier = 'none' | 'soft' | 'hard'

export interface PageContextConfig {
  /** Fraction of contextSize at which soft recall fires. */
  softRecallThreshold: number
  /** Fraction of contextSize at which a hard KV roll fires. */
  hardRollThreshold: number
  /** Physical KV-cache size in tokens (matches effective Scoper maxSeqLen). */
  contextSize: number
}

export const PAGE_CONTEXT_SOFT_RECALL_THRESHOLD = 0.55
export const PAGE_CONTEXT_HARD_ROLL_THRESHOLD = 0.85

/** ~4 characters per token heuristic (matches Studio). */
export const CHARS_PER_TOKEN_ESTIMATE = 4

export function estimateTokensFromChars(charsUsed: number): number {
  return Math.round(charsUsed / CHARS_PER_TOKEN_ESTIMATE)
}

export function resolvePageContextSize(
  effectiveMaxSeqLen: number | null | undefined,
): ScoperMaxSeqLen {
  if (effectiveMaxSeqLen === 4096 || effectiveMaxSeqLen === 8192) {
    return effectiveMaxSeqLen
  }
  return getScoperMaxSeqLenFromEnv()
}

export function createPageContextConfig(contextSize: number): PageContextConfig {
  return {
    softRecallThreshold: PAGE_CONTEXT_SOFT_RECALL_THRESHOLD,
    hardRollThreshold: PAGE_CONTEXT_HARD_ROLL_THRESHOLD,
    contextSize,
  }
}

/** UCW config from env default or an explicit effective maxSeqLen (e.g. after 4K fallback). */
export function getPageContextConfig(
  effectiveMaxSeqLen?: number | null,
): PageContextConfig {
  return createPageContextConfig(resolvePageContextSize(effectiveMaxSeqLen))
}

/** Env-based default (`getScoperMaxSeqLenFromEnv()`). */
export const PAGE_CONTEXT_CONFIG: PageContextConfig = getPageContextConfig()

/**
 * Compact ASCII KV progress bar for logs and debug UI.
 * Example: `[████████░░░░░░░░] 50%`
 */
export function kvBar(used: number, total: number): string {
  const pct = total > 0 ? used / total : 0
  const filled = Math.round(pct * 16)
  return `[${'█'.repeat(filled)}${'░'.repeat(16 - filled)}] ${Math.round(pct * 100)}%`
}

export function contextUsageRatio(charsUsed: number, config: PageContextConfig): number {
  const tokensUsed = estimateTokensFromChars(charsUsed)
  return config.contextSize > 0 ? tokensUsed / config.contextSize : 0
}

/**
 * Checks how full the context window is and returns which tier to activate.
 *
 * @param charsUsed Running character count in the KV window (prompt + cache).
 */
export function checkContextThreshold(
  charsUsed: number,
  config: PageContextConfig = PAGE_CONTEXT_CONFIG,
): ContextThresholdTier {
  const ratio = contextUsageRatio(charsUsed, config)

  if (ratio > config.hardRollThreshold) return 'hard'
  if (ratio > config.softRecallThreshold) return 'soft'
  return 'none'
}

/** Dev harness — UCW thresholds and kvBar (BDA-153) */
export function runPageContextManagerHarness(): void {
  const config8k = createPageContextConfig(8192)
  const config4k = createPageContextConfig(4096)

  const softChars8k = Math.ceil(config8k.contextSize * config8k.softRecallThreshold * CHARS_PER_TOKEN_ESTIMATE) + 1
  const hardChars8k = Math.ceil(config8k.contextSize * config8k.hardRollThreshold * CHARS_PER_TOKEN_ESTIMATE) + 1

  if (checkContextThreshold(0, config8k) !== 'none') {
    throw new Error('runPageContextManagerHarness: empty context should be none')
  }
  if (checkContextThreshold(softChars8k, config8k) !== 'soft') {
    throw new Error('runPageContextManagerHarness: expected soft tier above 55% on 8K')
  }
  if (checkContextThreshold(hardChars8k, config8k) !== 'hard') {
    throw new Error('runPageContextManagerHarness: expected hard tier above 85% on 8K')
  }

  if (getPageContextConfig(4096).contextSize !== 4096) {
    throw new Error('runPageContextManagerHarness: 4K fallback config size mismatch')
  }
  if (getPageContextConfig(8192).contextSize !== 8192) {
    throw new Error('runPageContextManagerHarness: 8K config size mismatch')
  }

  const bar = kvBar(4096, 8192)
  if (!bar.includes('50%') || !bar.includes('█')) {
    throw new Error(`runPageContextManagerHarness: unexpected kvBar output: ${bar}`)
  }

  const softChars4k = Math.ceil(config4k.contextSize * config4k.softRecallThreshold * CHARS_PER_TOKEN_ESTIMATE) + 1
  if (checkContextThreshold(softChars4k, config4k) !== 'soft') {
    throw new Error('runPageContextManagerHarness: expected soft tier on 4K config')
  }
}
