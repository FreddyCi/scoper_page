import { runPageContextManagerHarness } from '@/lib/page-context-manager'
import { runAssembleProposalMarkdownHarness } from '@/lib/assemble-proposal-markdown'
import { runChatStubProposalHarness } from '@/lib/chat-stub'
import { runCommandIngestProposalLandingHarness } from '@/lib/post-ingest-mode-effects'
import { runProposalPostIngestHarness } from '@/lib/proposal-post-ingest'
import { runProposalPromptsHarness } from '@/lib/proposal-prompts'
import { runProposalReadinessHarness } from '@/lib/proposal-readiness'
import { runProposalGenerationHarness } from '@/services/proposal-generation-harness'
import { runProposalPanelSetupHarness } from '@/services/proposal-panel-setup-harness'
import { runProposalRfpProfileHarness } from '@/services/proposal-rfp-profile-harness'

/** Sync proposal harnesses — no DuckDB ingest / ECP agent run required (BDA-150). */
export function runProposalUnitHarnesses(): void {
  runPageContextManagerHarness()
  runProposalReadinessHarness()
  runProposalPostIngestHarness()
  runAssembleProposalMarkdownHarness()
  runProposalPromptsHarness()
  runChatStubProposalHarness()
  runProposalPanelSetupHarness()
}

/** Async proposal harnesses that need session + DuckDB state (BDA-150). */
export async function runProposalAsyncUnitHarnesses(): Promise<void> {
  await runCommandIngestProposalLandingHarness()
}

/**
 * Ingest + ECP-dependent proposal paths (BDA-117, BDA-119, BDA-127).
 * Call after DuckDB ingest and `runEcpAgentRunHarness`.
 */
export async function runProposalIntegrationHarnesses(): Promise<void> {
  await runProposalRfpProfileHarness()
  await runProposalGenerationHarness()
}
