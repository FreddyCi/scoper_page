import { useEffect } from 'react'

import { AppShell } from '@/components/layout/AppShell'
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
import { runScoperHarness } from '@/services/scoper-client'
import { runCreepProfileGridHarness, runCreepProfileUiHarness } from '@/services/creep-profile-ui-harness'
import { runResultsProfileGridHarness, runResultsProfileUiHarness } from '@/services/results-profile-ui-harness'
import { runCitationBridgeHarness, runCitationClickHarness } from '@/services/citation-bridge'
import { runBlockCommentsHarness } from '@/services/block-comments'
import { runDocumentRoleHarness } from '@/services/document-roles'
import { runDuckdbHarness } from '@/services/duckdb-client'
import { runImportPdfCommentsHarness } from '@/services/import-pdf-comments'
import {
  runIngestHarness,
  runMarkdownIngestHarness,
  runDocxIngestHarness,
  runXlsxIngestHarness,
} from '@/services/ingest-router'
import { runLiteParseHarness, runLiteParseOcrHarness } from '@/services/liteparse-client'
import { runOcrHarness } from '@/services/ocr-client'
import { runSessionStoreHarness } from '@/store/session-store'

function App() {
  useEffect(() => {
    void initScoperEcpEnvironment().catch((error) => {
      console.error('[ecp-init]', error)
    })
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    void (async () => {
      try {
        await runEcpEnvironmentHarness()
        runSessionStoreHarness()
        await runDuckdbHarness()
        await runBlockCommentsHarness()
        await runLiteParseHarness()
        await runOcrHarness()
        await runLiteParseOcrHarness()
        await runIngestHarness()
        await runMarkdownIngestHarness()
        await runDocxIngestHarness()
        await runXlsxIngestHarness()
        await runImportPdfCommentsHarness()
        await runCompareScopeHarness()
        await runDocumentRoleHarness()
        await runBuildRfpProfilesHarness()
        await runScoperHarness()
        await runDemoExtensionsHarness()
        await runEcpAgentRunHarness()
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
        runCreepProfileUiHarness()
        runCreepProfileGridHarness()
      } catch (error) {
        console.error('[dev-harness]', error)
      }
    })()
  }, [])

  return <AppShell />
}

export default App
