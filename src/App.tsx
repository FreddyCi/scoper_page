import { useCallback, useEffect } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { DevAppBootstrap } from '@/components/layout/DevAppBootstrap'
import { SharePackBootstrap } from '@/components/layout/SharePackBootstrap'
import {
  initScoperEcpEnvironment,
  runDemoExtensionsHarness,
  runEcpEnvironmentHarness,
} from '@/ecp/environment'
import { runEcpAgentRunHarness } from '@/ecp/agent-run'
import { runCompareScopeHarness } from '@/services/compare-scope'
import { runChatHistoryMarkersHarness } from '@/services/chat-history-harness'
import { runChatAgentHarness, runChatCitationChipHarness, runFindClauseAgentHarness } from '@/services/chat-agent'
import { runChatCitationsHarness } from '@/services/chat-citations'
import { runDocumentSearchHarness } from '@/services/document-search'
import { runFindClauseHarness } from '@/services/find-clause'
import { runBuildRfpProfilesHarness } from '@/services/build-rfp-profiles'
import {
  runComplianceMatrixAsyncHarnesses,
  runComplianceMatrixUnitHarnesses,
} from '@/services/compliance-matrix-dev-harnesses'
import { runContractKeywordReviewHarness } from '@/services/build-contract-keyword-review'
import {
  runChatVoiceAsyncHarnesses,
  runChatVoiceUnitHarnesses,
} from '@/services/chat-voice-dev-harnesses'
import {
  runProposalAsyncUnitHarnesses,
  runProposalIntegrationHarnesses,
  runProposalUnitHarnesses,
} from '@/services/proposal-dev-harnesses'
import { runScoperHarness } from '@/services/scoper-client'
import { runCreepProfileGridHarness, runCreepProfileUiHarness } from '@/services/creep-profile-ui-harness'
import { runResultsProfileGridHarness, runResultsProfileUiHarness } from '@/services/results-profile-ui-harness'
import { runCitationBridgeHarness, runCitationClickHarness } from '@/services/citation-bridge'
import { runBlockCommentsHarness } from '@/services/block-comments'
import {
  runDrawingMarkupAsyncHarnesses,
  runDrawingMarkupUnitHarnesses,
} from '@/services/drawing-markup-dev-harnesses'
import { runDocumentRoleHarness } from '@/services/document-roles'
import { runDuckdbHarness } from '@/services/duckdb-client'
import { runLoadSampleEvaluationHarness } from '@/services/load-sample-documents'
import { runLoadSampleMarkupHarness } from '@/services/load-sample-markup'
import { runLoadSampleProposalHarness } from '@/services/load-sample-proposal'
import { runImportPdfCommentsHarness } from '@/services/import-pdf-comments'
import {
  runIngestHarness,
  runMarkdownIngestHarness,
  runDocxIngestHarness,
  runXlsxIngestHarness,
} from '@/services/ingest-router'
import { runLiteParseHarness, runLiteParseOcrHarness } from '@/services/liteparse-client'
import { runOcrHarness } from '@/services/ocr-client'
import { runConvertPdfToContextHarness } from '@/services/convert-pdf-to-context-harness'
import { runExportPdfMarkdownHarness } from '@/services/export-pdf-markdown-harness'
import { runExportDocumentMarkdownHarness } from '@/services/export-document-markdown-harness'
import { runSharePackHarness } from '@/services/share-pack-harness'
import { exposeScoperDevGlobals, runScoperDevToolsHarness } from '@/lib/scoper-dev-tools'
import { runSessionStoreHarness } from '@/store/session-store'
import { runScoutStoreHarness, subscribeScoutStorageSync } from '@/store/scout-store'
import { runScoutRegistryHarness } from '@/lib/scout/registry-harness'
import { runScoutSessionGuardHarness } from '@/lib/scout/session-guard'
import { runScoutSpotlightGeometryHarness } from '@/lib/scout/spotlight-geometry'
import { runScoutPanelHarness } from '@/components/scout/ScoutPanel'
import { runScoutStepEngineHarness } from '@/lib/scout/scout-step-engine'
import { runScoutActionsHarness } from '@/lib/scout/actions-harness'
import { runScoutCompletionHarness } from '@/lib/scout/completion-harness'
import { runScoutJourneysHarness } from '@/lib/scout/journeys-harness'

function shouldRunLegacyCreepHarnesses(): boolean {
  return import.meta.env.VITE_RUN_CREEP_HARNESS === 'true'
}

function App() {
  useEffect(() => {
    exposeScoperDevGlobals()
    const unsubscribeScoutSync = subscribeScoutStorageSync()
    void initScoperEcpEnvironment().catch((error) => {
      console.error('[ecp-init]', error)
    })
    return unsubscribeScoutSync
  }, [])

  const runDevHarnessChain = useCallback(async () => {
    if (!import.meta.env.DEV) return

    try {
      runScoperDevToolsHarness()
      await runEcpEnvironmentHarness()
      runSessionStoreHarness()
      runScoutStoreHarness()
      runScoutRegistryHarness()
      runScoutJourneysHarness()
      runScoutCompletionHarness()
      runScoutPanelHarness()
      runScoutSpotlightGeometryHarness()
      runScoutSessionGuardHarness()
      runScoutStepEngineHarness()
      await runScoutActionsHarness()
      runProposalUnitHarnesses()
      runComplianceMatrixUnitHarnesses()
      runDrawingMarkupUnitHarnesses()
      runChatVoiceUnitHarnesses()
      await runProposalAsyncUnitHarnesses()
      await runDuckdbHarness()
      await runComplianceMatrixAsyncHarnesses()
      await runBlockCommentsHarness()
      await runDrawingMarkupAsyncHarnesses()
      await runLiteParseHarness()
      await runOcrHarness()
      await runLiteParseOcrHarness()
      await runIngestHarness()
      await runExportPdfMarkdownHarness()
      await runExportDocumentMarkdownHarness()
      await runConvertPdfToContextHarness()
      await runSharePackHarness()
      await runMarkdownIngestHarness()
      await runDocxIngestHarness()
      await runXlsxIngestHarness()
      await runImportPdfCommentsHarness()
      await runCompareScopeHarness()
      await runDocumentRoleHarness()
      await runBuildRfpProfilesHarness()
      await runContractKeywordReviewHarness()
      await runLoadSampleEvaluationHarness()
      await runLoadSampleProposalHarness()
      await runLoadSampleMarkupHarness()
      await runScoperHarness()
      await runChatVoiceAsyncHarnesses()
      await runDemoExtensionsHarness()
      await runEcpAgentRunHarness()
      await runProposalIntegrationHarnesses()
      await runChatAgentHarness()
      await runChatCitationsHarness()
      await runChatCitationChipHarness()
      await runDocumentSearchHarness()
      await runFindClauseHarness()
      await runFindClauseAgentHarness()
      runChatHistoryMarkersHarness()
      await runCitationBridgeHarness()
      await runCitationClickHarness()
      runResultsProfileUiHarness()
      runResultsProfileGridHarness()
      if (shouldRunLegacyCreepHarnesses()) {
        runCreepProfileUiHarness()
        runCreepProfileGridHarness()
      }
    } catch (error) {
      console.error('[dev-harness]', error)
    }
  }, [])

  return (
    <DevAppBootstrap onBootstrap={runDevHarnessChain}>
      <SharePackBootstrap>
        <AppShell />
      </SharePackBootstrap>
    </DevAppBootstrap>
  )
}

export default App
