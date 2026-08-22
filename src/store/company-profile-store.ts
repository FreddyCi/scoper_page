import { create } from 'zustand'

import {
  createEmptyCompanyProfile,
  parsePersistedCompanyProfile,
  type CompanyProfile,
} from '@/lib/company-profile/schema'

export const COMPANY_PROFILE_STORAGE_KEY = 'scoper.company-profile.v1'

export type CompanyProfilePersistedSnapshot = {
  profile: CompanyProfile
  completedAt: string | null
  onboardingStep: string | null
  /** First-visit prompt dismissed without completing onboarding (BDA-308). */
  onboardingPromptDismissed: boolean
}

export type CompanyProfileResumeState = {
  onboardingStep: string | null
  profile?: Partial<CompanyProfile>
}

export type CompanyProfileState = CompanyProfilePersistedSnapshot & {
  /** Transient — questionnaire dialog open (not persisted). */
  onboardingDialogOpen: boolean
  saveProfile: (profile: CompanyProfile) => void
  updatePartialProfile: (patch: Partial<CompanyProfile>) => void
  setOnboardingResumeState: (state: CompanyProfileResumeState) => void
  clearCompanyProfile: () => void
  markOnboardingComplete: (profile?: CompanyProfile) => void
  hydrateFromPersisted: (snapshot: CompanyProfilePersistedSnapshot) => void
  openCompanyOnboardingDialog: () => void
  closeCompanyOnboardingDialog: () => void
  dismissOnboardingPrompt: () => void
}

export function createDefaultCompanyProfileSnapshot(): CompanyProfilePersistedSnapshot {
  return {
    profile: createEmptyCompanyProfile(),
    completedAt: null,
    onboardingStep: null,
    onboardingPromptDismissed: false,
  }
}

function normalizeCompletedAt(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeOnboardingStep(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeOnboardingPromptDismissed(value: unknown): boolean {
  return value === true
}

/** Parse JSON from localStorage into a safe snapshot (BDA-305). */
export function parseCompanyProfilePersistedSnapshot(
  raw: string | null,
): CompanyProfilePersistedSnapshot {
  const defaults = createDefaultCompanyProfileSnapshot()
  if (!raw) return defaults

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      profile: parsePersistedCompanyProfile(parsed.profile),
      completedAt: normalizeCompletedAt(parsed.completedAt),
      onboardingStep: normalizeOnboardingStep(parsed.onboardingStep),
      onboardingPromptDismissed: normalizeOnboardingPromptDismissed(parsed.onboardingPromptDismissed),
    }
  } catch {
    return defaults
  }
}

export function readCompanyProfilePersistedSnapshot(): CompanyProfilePersistedSnapshot {
  try {
    return parseCompanyProfilePersistedSnapshot(localStorage.getItem(COMPANY_PROFILE_STORAGE_KEY))
  } catch {
    return createDefaultCompanyProfileSnapshot()
  }
}

export function writeCompanyProfilePersistedSnapshot(snapshot: CompanyProfilePersistedSnapshot): void {
  try {
    localStorage.setItem(COMPANY_PROFILE_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // localStorage unavailable (private mode, quota, etc.)
  }
}

function pickPersisted(state: CompanyProfileState): CompanyProfilePersistedSnapshot {
  return {
    profile: state.profile,
    completedAt: state.completedAt,
    onboardingStep: state.onboardingStep,
    onboardingPromptDismissed: state.onboardingPromptDismissed,
  }
}

function persistCompanyProfileState(state: CompanyProfileState): void {
  writeCompanyProfilePersistedSnapshot(pickPersisted(state))
}

function withPersist(
  set: (
    partial:
      | Partial<CompanyProfileState>
      | ((state: CompanyProfileState) => Partial<CompanyProfileState>),
  ) => void,
  get: () => CompanyProfileState,
  partial:
    | Partial<CompanyProfileState>
    | ((state: CompanyProfileState) => Partial<CompanyProfileState>),
): void {
  set(partial)
  persistCompanyProfileState(get())
}

const hydrated = readCompanyProfilePersistedSnapshot()

export const useCompanyProfileStore = create<CompanyProfileState>((set, get) => ({
  ...hydrated,
  onboardingDialogOpen: false,

  saveProfile: (profile) => {
    withPersist(set, get, { profile: parsePersistedCompanyProfile(profile) })
  },

  updatePartialProfile: (patch) => {
    withPersist(set, get, (state) => ({
      profile: {
        ...state.profile,
        ...patch,
      },
    }))
  },

  setOnboardingResumeState: ({ onboardingStep, profile }) => {
    withPersist(set, get, (state) => ({
      onboardingStep: normalizeOnboardingStep(onboardingStep),
      profile: profile ? { ...state.profile, ...profile } : state.profile,
      completedAt: null,
    }))
  },

  clearCompanyProfile: () => {
    withPersist(set, get, createDefaultCompanyProfileSnapshot())
  },

  markOnboardingComplete: (profile) => {
    withPersist(set, get, (state) => ({
      profile: profile ? parsePersistedCompanyProfile(profile) : state.profile,
      completedAt: new Date().toISOString(),
      onboardingStep: null,
      onboardingPromptDismissed: false,
    }))
    set({ onboardingDialogOpen: false })
  },

  hydrateFromPersisted: (snapshot) => {
    set({
      ...createDefaultCompanyProfileSnapshot(),
      ...snapshot,
      profile: parsePersistedCompanyProfile(snapshot.profile),
      completedAt: normalizeCompletedAt(snapshot.completedAt),
      onboardingStep: normalizeOnboardingStep(snapshot.onboardingStep),
      onboardingPromptDismissed: normalizeOnboardingPromptDismissed(snapshot.onboardingPromptDismissed),
      onboardingDialogOpen: false,
    })
  },

  openCompanyOnboardingDialog: () => {
    set({ onboardingDialogOpen: true })
  },

  closeCompanyOnboardingDialog: () => {
    set({ onboardingDialogOpen: false })
  },

  dismissOnboardingPrompt: () => {
    withPersist(set, get, { onboardingPromptDismissed: true })
    set({ onboardingDialogOpen: false })
  },
}))

export function selectCompanyProfile(state: CompanyProfileState): CompanyProfile {
  return state.profile
}

export function selectHasCompletedOnboarding(state: CompanyProfileState): boolean {
  return state.completedAt != null
}

/** Sync company profile store when another tab updates localStorage (BDA-305). */
export function subscribeCompanyProfileStorageSync(): () => void {
  if (typeof window === 'undefined') return () => undefined

  function onStorage(event: StorageEvent) {
    if (event.key !== COMPANY_PROFILE_STORAGE_KEY) return
    useCompanyProfileStore
      .getState()
      .hydrateFromPersisted(parseCompanyProfilePersistedSnapshot(event.newValue))
  }

  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}

function sampleProfile(): CompanyProfile {
  return {
    legalName: 'Pro-Bel Enterprises Limited',
    role: 'subcontractor',
    tradeDiscipline: 'fall-protection',
    serviceGeography: 'regional',
    headcountBand: '51-200',
    certifications: ['em385', 'iso-9001'],
    insuranceLimit: '5m-10m',
    bondingCapacity: '1m-5m',
    differentiators: 'EM 385 compliant safety program and documented rescue plans',
    freeformNotes: 'Serving DPR-class GC partners on commercial envelope work.',
  }
}

/** Dev harness — company profile store persistence round-trip (BDA-305). */
export function runCompanyProfileStoreHarness(): void {
  const store = useCompanyProfileStore.getState()
  store.clearCompanyProfile()

  let state = useCompanyProfileStore.getState()
  if (selectHasCompletedOnboarding(state) || state.onboardingStep != null) {
    throw new Error('runCompanyProfileStoreHarness: clear should reset snapshot')
  }
  if (state.profile.legalName !== '') {
    throw new Error('runCompanyProfileStoreHarness: clear should reset profile')
  }

  store.setOnboardingResumeState({
    onboardingStep: 'tradeDiscipline',
    profile: { legalName: 'Draft Co', role: 'subcontractor' },
  })

  state = useCompanyProfileStore.getState()
  if (state.onboardingStep !== 'tradeDiscipline') {
    throw new Error('runCompanyProfileStoreHarness: onboardingStep not saved')
  }
  if (state.profile.legalName !== 'Draft Co' || state.profile.role !== 'subcontractor') {
    throw new Error('runCompanyProfileStoreHarness: partial resume profile not merged')
  }

  const profile = sampleProfile()
  store.saveProfile(profile)

  state = useCompanyProfileStore.getState()
  if (state.profile.legalName !== profile.legalName || state.profile.certifications.length !== 2) {
    throw new Error('runCompanyProfileStoreHarness: saveProfile failed')
  }
  if (selectHasCompletedOnboarding(state)) {
    throw new Error('runCompanyProfileStoreHarness: saveProfile should not mark complete')
  }

  store.updatePartialProfile({ headcountBand: '11-50', freeformNotes: 'Updated notes' })
  if (useCompanyProfileStore.getState().profile.headcountBand !== '11-50') {
    throw new Error('runCompanyProfileStoreHarness: updatePartialProfile failed')
  }

  const serialized = JSON.stringify(pickPersisted(useCompanyProfileStore.getState()))
  writeCompanyProfilePersistedSnapshot(parseCompanyProfilePersistedSnapshot(serialized))
  const reloaded = readCompanyProfilePersistedSnapshot()

  if (reloaded.profile.legalName !== profile.legalName) {
    throw new Error('runCompanyProfileStoreHarness: persistence round-trip failed')
  }
  if (reloaded.profile.freeformNotes !== 'Updated notes') {
    throw new Error('runCompanyProfileStoreHarness: persisted partial update missing')
  }

  store.markOnboardingComplete()
  state = useCompanyProfileStore.getState()
  if (!selectHasCompletedOnboarding(state) || state.onboardingStep != null) {
    throw new Error('runCompanyProfileStoreHarness: markOnboardingComplete failed')
  }
  if (!state.completedAt) {
    throw new Error('runCompanyProfileStoreHarness: completedAt not set')
  }
  if (state.onboardingPromptDismissed) {
    throw new Error('runCompanyProfileStoreHarness: complete should clear dismissed flag')
  }

  store.dismissOnboardingPrompt()
  if (!useCompanyProfileStore.getState().onboardingPromptDismissed) {
    throw new Error('runCompanyProfileStoreHarness: dismissOnboardingPrompt failed')
  }

  store.clearCompanyProfile()
  state = useCompanyProfileStore.getState()
  if (selectHasCompletedOnboarding(state) || state.profile.legalName !== '') {
    throw new Error('runCompanyProfileStoreHarness: clear after complete failed')
  }
  if (state.onboardingPromptDismissed) {
    throw new Error('runCompanyProfileStoreHarness: clear should reset onboardingPromptDismissed')
  }

  try {
    localStorage.removeItem(COMPANY_PROFILE_STORAGE_KEY)
  } catch {
    // ignore
  }
  useCompanyProfileStore.getState().hydrateFromPersisted(createDefaultCompanyProfileSnapshot())
}
