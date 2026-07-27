import { useEffect } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { runDuckdbHarness } from '@/services/duckdb-client'
import { runLiteParseHarness, runLiteParseOcrHarness } from '@/services/liteparse-client'
import { runOcrHarness } from '@/services/ocr-client'
import { runSessionStoreHarness } from '@/store/session-store'

function App() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      runSessionStoreHarness()
      void runDuckdbHarness().catch((error) => {
        console.error('[duckdb-harness]', error)
      })
      void runLiteParseHarness().catch((error) => {
        console.error('[liteparse-harness]', error)
      })
      void runOcrHarness().catch((error) => {
        console.error('[ocr-harness]', error)
      })
      void runLiteParseOcrHarness().catch((error) => {
        console.error('[liteparse-ocr-harness]', error)
      })
    }
  }, [])

  return <AppShell />
}

export default App
