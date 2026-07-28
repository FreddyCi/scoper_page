import { useEffect } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import {
  initScoperEcpEnvironment,
  runDemoExtensionsHarness,
  runEcpEnvironmentHarness,
} from '@/ecp/environment'
import { runChatAgentHarness, runChatCitationChipHarness, runFindClauseAgentHarness } from '@/services/chat-agent'
import { runChatCitationsHarness } from '@/services/chat-citations'
import { runDocumentSearchHarness } from '@/services/document-search'
import { runFindClauseHarness } from '@/services/find-clause'
import { runBuildRfpProfilesHarness } from '@/services/build-rfp-profiles'
import { runScoperHarness } from '@/services/scoper-client'
import { runResultsProfileGridHarness, runResultsProfileUiHarness } from '@/services/results-profile-ui-harness'
import { runCitationBridgeHarness, runCitationClickHarness } from '@/services/citation-bridge'
import { runDuckdbHarness } from '@/services/duckdb-client'
import { runIngestHarness } from '@/services/ingest-router'
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
        await runLiteParseHarness()
        await runOcrHarness()
        await runLiteParseOcrHarness()
        await runIngestHarness()
        await runBuildRfpProfilesHarness()
        await runScoperHarness()
        await runDemoExtensionsHarness()
        await runChatAgentHarness()
        await runChatCitationsHarness()
        await runChatCitationChipHarness()
        await runDocumentSearchHarness()
        await runFindClauseHarness()
        await runFindClauseAgentHarness()
        await runCitationBridgeHarness()
        await runCitationClickHarness()
        runResultsProfileUiHarness()
        runResultsProfileGridHarness()
      } catch (error) {
        console.error('[dev-harness]', error)
      }
    })()
  }, [])

  return <AppShell />
}

export default App
