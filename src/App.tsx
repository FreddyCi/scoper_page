import { useEffect } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { runSessionStoreHarness } from '@/store/session-store'

function App() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      runSessionStoreHarness()
    }
  }, [])

  return <AppShell />
}

export default App
