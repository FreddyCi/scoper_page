import { useEffect } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { runSessionStoreHarness, seedDevDocuments } from '@/store/session-store'

function App() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      runSessionStoreHarness()
      seedDevDocuments()
    }
  }, [])

  return <AppShell />
}

export default App
