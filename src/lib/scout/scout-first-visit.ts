import type { ScoutJourneyId } from '@/lib/scout/types'
import {
  SCOUT_STORAGE_KEY,
  createDefaultScoutSnapshot,
  readScoutPersistedSnapshot,
  useScoutStore,
  writeScoutPersistedSnapshot,
} from '@/store/scout-store'
import { useSessionStore } from '@/store/session-store'

export type ScoutFirstVisitContext = {
  dismissed: boolean
  panelOpen: boolean
  activeJourney: ScoutJourneyId | null
  documentCount: number
  hasShareLink: boolean
}

/** Whether this browser profile has ever persisted Scout state (BDA-298). */
export function hasScoutPersistedProfile(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(SCOUT_STORAGE_KEY) != null
  } catch {
    return false
  }
}

/** True when the welcome panel should auto-open on load — once per profile, landing only (BDA-298). */
export function shouldAutoOpenScoutWelcomePanel(context: ScoutFirstVisitContext): boolean {
  if (context.dismissed) return false
  if (hasScoutPersistedProfile()) return false
  if (context.documentCount > 0) return false
  if (context.hasShareLink) return false
  if (context.activeJourney != null) return false
  if (context.panelOpen) return false
  return true
}

/** Dev harness — first-visit auto-open predicates (BDA-298). */
export function runScoutFirstVisitHarness(): void {
  try {
    localStorage.removeItem(SCOUT_STORAGE_KEY)
  } catch {
    // ignore
  }

  const base: ScoutFirstVisitContext = {
    dismissed: false,
    panelOpen: false,
    activeJourney: null,
    documentCount: 0,
    hasShareLink: false,
  }

  if (!shouldAutoOpenScoutWelcomePanel(base)) {
    throw new Error('runScoutFirstVisitHarness: fresh profile should auto-open')
  }

  if (shouldAutoOpenScoutWelcomePanel({ ...base, dismissed: true })) {
    throw new Error('runScoutFirstVisitHarness: dismissed should block auto-open')
  }

  if (shouldAutoOpenScoutWelcomePanel({ ...base, documentCount: 1 })) {
    throw new Error('runScoutFirstVisitHarness: ingested docs should block auto-open')
  }

  if (shouldAutoOpenScoutWelcomePanel({ ...base, hasShareLink: true })) {
    throw new Error('runScoutFirstVisitHarness: share deep link should block auto-open')
  }

  try {
    localStorage.removeItem(SCOUT_STORAGE_KEY)
  } catch {
    // ignore
  }

  useSessionStore.getState().resetSession()
  useScoutStore.getState().hydrateFromPersisted(createDefaultScoutSnapshot())

  if (hasScoutPersistedProfile()) {
    throw new Error('runScoutFirstVisitHarness: expected no scout storage before auto-open')
  }

  if (
    !shouldAutoOpenScoutWelcomePanel({
      dismissed: useScoutStore.getState().dismissed,
      panelOpen: useScoutStore.getState().panelOpen,
      activeJourney: useScoutStore.getState().activeJourney,
      documentCount: useSessionStore.getState().documents.length,
      hasShareLink: false,
    })
  ) {
    throw new Error('runScoutFirstVisitHarness: store defaults should qualify for auto-open')
  }

  useScoutStore.getState().setPanelOpen(true)
  if (!hasScoutPersistedProfile()) {
    throw new Error('runScoutFirstVisitHarness: auto-open should persist scout profile')
  }

  if (
    shouldAutoOpenScoutWelcomePanel({
      dismissed: false,
      panelOpen: false,
      activeJourney: null,
      documentCount: 0,
      hasShareLink: false,
    })
  ) {
    throw new Error('runScoutFirstVisitHarness: should not auto-open after profile persisted')
  }

  useScoutStore.getState().dismissScout()
  const dismissedSnapshot = readScoutPersistedSnapshot()
  if (!dismissedSnapshot.dismissed) {
    throw new Error('runScoutFirstVisitHarness: dismiss should persist dismissed flag')
  }

  if (
    shouldAutoOpenScoutWelcomePanel({
      dismissed: dismissedSnapshot.dismissed,
      panelOpen: dismissedSnapshot.panelOpen,
      activeJourney: dismissedSnapshot.activeJourney,
      documentCount: 0,
      hasShareLink: false,
    })
  ) {
    throw new Error('runScoutFirstVisitHarness: dismissed profile should not auto-open on reload')
  }

  try {
    localStorage.removeItem(SCOUT_STORAGE_KEY)
  } catch {
    // ignore
  }
  useScoutStore.getState().hydrateFromPersisted(createDefaultScoutSnapshot())
  writeScoutPersistedSnapshot(createDefaultScoutSnapshot())
}
