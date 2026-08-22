import { create } from 'zustand'

import {
  isScoutJourneyId,
  type ScoutExportFlags,
  type ScoutJourneyId,
  type ScoutPersistedSnapshot,
} from '@/lib/scout/types'

export const SCOUT_STORAGE_KEY = 'scoper.scout.v1'

export type ScoutState = ScoutPersistedSnapshot & {
  startJourney: (journeyId: ScoutJourneyId) => void
  advanceStep: () => void
  setStepIndex: (index: number) => void
  completeJourney: () => void
  dismissScout: () => void
  setPanelOpen: (open: boolean) => void
  setAwaitingManualContinue: (awaiting: boolean) => void
  markExportTriggered: (patch: Partial<ScoutExportFlags>) => void
  resetScoutProgress: () => void
  hydrateFromPersisted: (snapshot: ScoutPersistedSnapshot) => void
}

const DEFAULT_EXPORT_FLAGS: ScoutExportFlags = {}

export function createDefaultScoutSnapshot(): ScoutPersistedSnapshot {
  return {
    activeJourney: null,
    stepIndex: 0,
    completedJourneys: [],
    panelOpen: false,
    dismissed: false,
    awaitingManualContinue: false,
    exportTriggered: { ...DEFAULT_EXPORT_FLAGS },
  }
}

function normalizeExportFlags(value: unknown): ScoutExportFlags {
  if (!value || typeof value !== 'object') return { ...DEFAULT_EXPORT_FLAGS }
  const raw = value as Record<string, unknown>
  return {
    matrixCsv: raw.matrixCsv === true ? true : undefined,
    proposalMarkdown: raw.proposalMarkdown === true ? true : undefined,
    takeoffCsv: raw.takeoffCsv === true ? true : undefined,
  }
}

function normalizeCompletedJourneys(value: unknown): ScoutJourneyId[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<ScoutJourneyId>()
  const next: ScoutJourneyId[] = []
  for (const item of value) {
    if (!isScoutJourneyId(item) || seen.has(item)) continue
    seen.add(item)
    next.push(item)
  }
  return next
}

/** Parse JSON from localStorage into a safe snapshot (BDA-277). */
export function parseScoutPersistedSnapshot(raw: string | null): ScoutPersistedSnapshot {
  const defaults = createDefaultScoutSnapshot()
  if (!raw) return defaults

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const activeJourney = isScoutJourneyId(parsed.activeJourney) ? parsed.activeJourney : null
    const stepIndex =
      typeof parsed.stepIndex === 'number' && Number.isFinite(parsed.stepIndex) && parsed.stepIndex >= 0
        ? Math.floor(parsed.stepIndex)
        : 0

    return {
      activeJourney,
      stepIndex,
      completedJourneys: normalizeCompletedJourneys(parsed.completedJourneys),
      panelOpen: parsed.panelOpen === true,
      dismissed: parsed.dismissed === true,
      awaitingManualContinue: parsed.awaitingManualContinue === true,
      exportTriggered: normalizeExportFlags(parsed.exportTriggered),
    }
  } catch {
    return defaults
  }
}

export function readScoutPersistedSnapshot(): ScoutPersistedSnapshot {
  try {
    return parseScoutPersistedSnapshot(localStorage.getItem(SCOUT_STORAGE_KEY))
  } catch {
    return createDefaultScoutSnapshot()
  }
}

export function writeScoutPersistedSnapshot(snapshot: ScoutPersistedSnapshot): void {
  try {
    localStorage.setItem(SCOUT_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // localStorage unavailable (private mode, quota, etc.)
  }
}

function pickPersisted(state: ScoutState): ScoutPersistedSnapshot {
  return {
    activeJourney: state.activeJourney,
    stepIndex: state.stepIndex,
    completedJourneys: state.completedJourneys,
    panelOpen: state.panelOpen,
    dismissed: state.dismissed,
    awaitingManualContinue: state.awaitingManualContinue,
    exportTriggered: state.exportTriggered,
  }
}

function persistScoutState(state: ScoutState): void {
  writeScoutPersistedSnapshot(pickPersisted(state))
}

function withPersist(
  set: (partial: Partial<ScoutState> | ((state: ScoutState) => Partial<ScoutState>)) => void,
  get: () => ScoutState,
  partial: Partial<ScoutState> | ((state: ScoutState) => Partial<ScoutState>),
): void {
  set(partial)
  persistScoutState(get())
}

const hydrated = readScoutPersistedSnapshot()

export const useScoutStore = create<ScoutState>((set, get) => ({
  ...hydrated,

  startJourney: (journeyId) => {
    withPersist(set, get, {
      activeJourney: journeyId,
      stepIndex: 0,
      panelOpen: true,
      awaitingManualContinue: false,
      exportTriggered: { ...DEFAULT_EXPORT_FLAGS },
    })
  },

  advanceStep: () => {
    withPersist(set, get, (state) => ({
      stepIndex: state.stepIndex + 1,
      awaitingManualContinue: false,
    }))
  },

  setStepIndex: (index) => {
    withPersist(set, get, {
      stepIndex: Math.max(0, Math.floor(index)),
      awaitingManualContinue: false,
    })
  },

  completeJourney: () => {
    withPersist(set, get, (state) => {
      const journey = state.activeJourney
      const completedJourneys =
        journey && !state.completedJourneys.includes(journey)
          ? [...state.completedJourneys, journey]
          : state.completedJourneys

      return {
        activeJourney: null,
        stepIndex: 0,
        completedJourneys,
        awaitingManualContinue: false,
        exportTriggered: { ...DEFAULT_EXPORT_FLAGS },
      }
    })
  },

  dismissScout: () => {
    withPersist(set, get, {
      dismissed: true,
      panelOpen: false,
    })
  },

  setPanelOpen: (open) => {
    withPersist(set, get, { panelOpen: open })
  },

  setAwaitingManualContinue: (awaiting) => {
    withPersist(set, get, { awaitingManualContinue: awaiting })
  },

  markExportTriggered: (patch) => {
    withPersist(set, get, (state) => ({
      exportTriggered: {
        ...state.exportTriggered,
        ...patch,
      },
    }))
  },

  resetScoutProgress: () => {
    withPersist(set, get, {
      ...createDefaultScoutSnapshot(),
      dismissed: get().dismissed,
    })
  },

  hydrateFromPersisted: (snapshot) => {
    set({
      ...createDefaultScoutSnapshot(),
      ...snapshot,
      exportTriggered: normalizeExportFlags(snapshot.exportTriggered),
      completedJourneys: normalizeCompletedJourneys(snapshot.completedJourneys),
    })
  },
}))

export function selectActiveScoutJourney(state: ScoutState): ScoutJourneyId | null {
  return state.activeJourney
}

export function selectScoutPanelOpen(state: ScoutState): boolean {
  return state.panelOpen
}

export function selectScoutStepIndex(state: ScoutState): number {
  return state.stepIndex
}

export function selectScoutDismissed(state: ScoutState): boolean {
  return state.dismissed
}

export function selectIsScoutJourneyComplete(
  state: ScoutState,
  journeyId: ScoutJourneyId,
): boolean {
  return state.completedJourneys.includes(journeyId)
}

export function selectScoutExportTriggered(state: ScoutState): ScoutExportFlags {
  return state.exportTriggered
}

/** Sync scout store when another tab updates localStorage (BDA-277). */
export function subscribeScoutStorageSync(): () => void {
  if (typeof window === 'undefined') return () => undefined

  function onStorage(event: StorageEvent) {
    if (event.key !== SCOUT_STORAGE_KEY) return
    useScoutStore.getState().hydrateFromPersisted(parseScoutPersistedSnapshot(event.newValue))
  }

  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}

/** Dev harness — scout store actions + persistence round-trip (BDA-277). */
export function runScoutStoreHarness(): void {
  const store = useScoutStore.getState()
  store.resetScoutProgress()
  store.setPanelOpen(false)

  store.startJourney('evaluate_rfp')
  let state = useScoutStore.getState()
  if (state.activeJourney !== 'evaluate_rfp' || state.stepIndex !== 0 || !state.panelOpen) {
    throw new Error('runScoutStoreHarness: startJourney failed')
  }

  store.advanceStep()
  store.advanceStep()
  if (useScoutStore.getState().stepIndex !== 2) {
    throw new Error('runScoutStoreHarness: advanceStep failed')
  }

  store.setAwaitingManualContinue(true)
  if (!useScoutStore.getState().awaitingManualContinue) {
    throw new Error('runScoutStoreHarness: setAwaitingManualContinue failed')
  }

  store.markExportTriggered({ matrixCsv: true })
  if (!useScoutStore.getState().exportTriggered.matrixCsv) {
    throw new Error('runScoutStoreHarness: markExportTriggered failed')
  }

  const serialized = JSON.stringify(pickPersisted(useScoutStore.getState()))
  writeScoutPersistedSnapshot(parseScoutPersistedSnapshot(serialized))
  const reloaded = readScoutPersistedSnapshot()
  if (reloaded.activeJourney !== 'evaluate_rfp' || reloaded.stepIndex !== 2) {
    throw new Error('runScoutStoreHarness: persistence round-trip failed')
  }

  store.completeJourney()
  state = useScoutStore.getState()
  if (state.activeJourney != null || !state.completedJourneys.includes('evaluate_rfp')) {
    throw new Error('runScoutStoreHarness: completeJourney failed')
  }

  store.dismissScout()
  if (!useScoutStore.getState().dismissed || useScoutStore.getState().panelOpen) {
    throw new Error('runScoutStoreHarness: dismissScout failed')
  }

  store.resetScoutProgress()
  state = useScoutStore.getState()
  if (state.activeJourney != null || state.completedJourneys.length > 0) {
    throw new Error('runScoutStoreHarness: resetScoutProgress failed')
  }
  if (!state.dismissed) {
    throw new Error('runScoutStoreHarness: resetScoutProgress should preserve dismissed')
  }

  try {
    localStorage.removeItem(SCOUT_STORAGE_KEY)
  } catch {
    // ignore
  }
  useScoutStore.getState().hydrateFromPersisted(createDefaultScoutSnapshot())
}
