import { createContext, useContext, type ReactNode } from 'react'

import type { ScoutJourneyId } from '@/lib/scout/types'

export type ScoutContextValue = {
  activeJourney: ScoutJourneyId | null
  stepIndex: number
  panelOpen: boolean
  dismissed: boolean
  awaitingManualContinue: boolean
  hasActiveTour: boolean
  canResume: boolean
  togglePanel: () => void
  openPanel: () => void
  closePanel: () => void
  startJourney: (journeyId: ScoutJourneyId) => void
  dismissScout: () => void
}

const ScoutContext = createContext<ScoutContextValue | null>(null)

export function ScoutContextProvider({
  value,
  children,
}: {
  value: ScoutContextValue
  children: ReactNode
}) {
  return <ScoutContext.Provider value={value}>{children}</ScoutContext.Provider>
}

/** Scout coach state and controls for header launcher + panel (BDA-287). */
export function useScout(): ScoutContextValue {
  const context = useContext(ScoutContext)
  if (!context) {
    throw new Error('useScout must be used within ScoutProvider')
  }
  return context
}

/** Optional hook — returns null outside ScoutProvider (e.g. tests). */
export function useScoutOptional(): ScoutContextValue | null {
  return useContext(ScoutContext)
}
