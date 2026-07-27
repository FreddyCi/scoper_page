import { useEffect } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { runDuckdbHarness } from '@/services/duckdb-client'
import { runSessionStoreHarness } from '@/store/session-store'

function App() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      runSessionStoreHarness()
      void runDuckdbHarness().catch((error) => {
        console.error('[duckdb-harness]', error)
      })
    }
  }, [])

  return <AppShell />
}

export default App
