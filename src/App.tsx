import { useEffect } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { runDuckdbHarness } from '@/services/duckdb-client'
import { runIngestHarness } from '@/services/ingest-router'
import { runLiteParseHarness, runLiteParseOcrHarness } from '@/services/liteparse-client'
import { runOcrHarness } from '@/services/ocr-client'
import { runSessionStoreHarness } from '@/store/session-store'

function App() {
  useEffect(() => {
    if (!import.meta.env.DEV) return

    void (async () => {
      try {
        runSessionStoreHarness()
        await runDuckdbHarness()
        await runLiteParseHarness()
        await runOcrHarness()
        await runLiteParseOcrHarness()
        await runIngestHarness()
      } catch (error) {
        console.error('[dev-harness]', error)
      }
    })()
  }, [])

  return <AppShell />
}

export default App
