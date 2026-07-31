import { runWhisperProtocolHarness } from '@/lib/whisper-protocol'
import { runChatVoiceCaptureHarness } from '@/services/chat-voice-capture'
import { runProposalHistoryHarness } from '@/lib/proposal-history'
import { runProposalSectionFindClauseHarness } from '@/lib/proposal-section-find-clause'
import { runProposalSetupQualityGatesHarness } from '@/lib/proposal-setup-quality-gates'
import { runProposalVolumeSectionTypesHarness } from '@/lib/proposal-volume-section'
import { runProposalExportQualityHarness } from '@/lib/proposal-export-quality'
import { runProposalContextQualityHarness } from '@/lib/proposal-context-quality'
import { runProposalPackageClassifierHarness } from '@/lib/proposal-package-classifier'
import { runAgentActivityHarness, runAgentActivityTranscriptHarness } from '@/lib/agent-activity'
import { runContextUsageHarness } from '@/lib/context-usage'
import { runMarkerShimmerHarness } from '@/components/ui/marker'
import { runShimmerHarness } from '@/components/ui/shimmer'
import { runAgentActivityStoreHarness } from '@/services/agent-activity-store-harness'
import { runAgentActivityMarkersHarness } from '@/services/agent-activity-markers-harness'
import { runAgentActivityEmissionsHarness } from '@/services/agent-activity-bridge'
import { runPageContextManagerHarness } from '@/lib/page-context-manager'
import { runProposalContextRollHarness } from '@/lib/proposal-context-roll'
import { runProposalContextTrackerHarness } from '@/lib/proposal-context-tracker'
import { runAssembleProposalMarkdownHarness } from '@/lib/assemble-proposal-markdown'
import { runDeriveProposalSectionsHarness } from '@/services/derive-proposal-sections'
import { runBuildProposalRfpProfilePackageHarness } from '@/services/build-proposal-rfp-profile'
import { runChatStubProposalHarness } from '@/lib/chat-stub'
import { runCommandIngestProposalLandingHarness } from '@/lib/post-ingest-mode-effects'
import { runProposalPostIngestHarness } from '@/lib/proposal-post-ingest'
import { runProposalPromptsHarness } from '@/lib/proposal-prompts'
import { runProposalReadinessHarness } from '@/lib/proposal-readiness'
import { runProposalStoreGeneratePreflightHarness } from '@/services/proposal-store-generate-harness'
import { runProposalSectionEcpHarness } from '@/services/proposal-volume-ecp'
import { runProposalGenerationHarness } from '@/services/proposal-generation-harness'
import { runProposalPanelSetupHarness } from '@/services/proposal-panel-setup-harness'
import { runProposalRfpProfileHarness } from '@/services/proposal-rfp-profile-harness'

/** Sync proposal harnesses — no DuckDB ingest / ECP agent run required (BDA-150). */
export function runProposalUnitHarnesses(): void {
  runWhisperProtocolHarness()
  runChatVoiceCaptureHarness()
  runPageContextManagerHarness()
  runContextUsageHarness()
  runShimmerHarness()
  runMarkerShimmerHarness()
  runAgentActivityHarness()
  runAgentActivityTranscriptHarness()
  runAgentActivityEmissionsHarness()
  runProposalPackageClassifierHarness()
  runProposalContextQualityHarness()
  runProposalSetupQualityGatesHarness()
  runProposalExportQualityHarness()
  runProposalVolumeSectionTypesHarness()
  runProposalHistoryHarness()
  runProposalSectionFindClauseHarness()
  runProposalContextRollHarness()
  runProposalContextTrackerHarness()
  runProposalReadinessHarness()
  runBuildProposalRfpProfilePackageHarness()
  runDeriveProposalSectionsHarness()
  runProposalPostIngestHarness()
  runAssembleProposalMarkdownHarness()
  runProposalPromptsHarness()
  runChatStubProposalHarness()
  runProposalPanelSetupHarness()
}

/** Async proposal harnesses that need session + DuckDB state (BDA-150). */
export async function runProposalAsyncUnitHarnesses(): Promise<void> {
  runAgentActivityStoreHarness()
  runAgentActivityMarkersHarness()
  await runProposalStoreGeneratePreflightHarness()
  await runProposalSectionEcpHarness()
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
