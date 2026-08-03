import { useEffect, useState, type ReactNode } from 'react'

import { AppBootScreen } from '@/components/layout/AppBootScreen'
import { runDevBootstrapOnce } from '@/lib/dev-bootstrap'

type DevAppBootstrapProps = {
  children: ReactNode
  /** Runs once on mount in DEV (harness chain, etc.). */
  onBootstrap: () => Promise<void>
}

/**
 * In dev, run bootstrap before showing the shell so harnesses do not flash
 * proposal/RFP workspace state (ingest + proposal harnesses mutate the store).
 */
export function DevAppBootstrap({ children, onBootstrap }: DevAppBootstrapProps) {
  const [ready, setReady] = useState(!import.meta.env.DEV)

  useEffect(() => {
    if (!import.meta.env.DEV) return

    let cancelled = false

    void runDevBootstrapOnce(onBootstrap).then(() => {
      if (!cancelled) {
        setReady(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [onBootstrap])

  if (!ready) {
    return (
      <AppBootScreen
        message="Loading Scoper…"
        detail="Preparing workspace. Running local checks and loading browser models. This only happens in development."
      />
    )
  }

  return children
}
