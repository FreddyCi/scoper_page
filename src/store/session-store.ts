import { create } from 'zustand'

import type {
  CitationRef,
  DocumentMeta,
  DocumentRole,
  RfpResultsProfile,
  ScopeCreepProfile,
  WorkspaceMode,
  WorkspaceView,
} from '@/lib/types'

const CHAT_COLLAPSED_STORAGE_KEY = 'bda-chat-collapsed'

function readChatCollapsedPreference(): boolean {
  try {
    return sessionStorage.getItem(CHAT_COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeChatCollapsedPreference(collapsed: boolean) {
  try {
    sessionStorage.setItem(CHAT_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // sessionStorage unavailable (private mode, etc.)
  }
}

export type SessionState = {
  sessionName: string
  mode: WorkspaceMode
  documents: DocumentMeta[]
  profiles: RfpResultsProfile[]
  creepProfiles: ScopeCreepProfile[]
  selectedCitation: CitationRef | null
  chatCollapsed: boolean
  workspaceView: WorkspaceView
  activeDocId: string | null

  setSessionName: (name: string) => void
  setMode: (mode: WorkspaceMode) => void
  setDocuments: (documents: DocumentMeta[]) => void
  addDocument: (document: DocumentMeta) => void
  removeDocument: (docId: string) => void
  updateDocumentRole: (docId: string, role: DocumentRole) => void
  setProfiles: (profiles: RfpResultsProfile[]) => void
  setCreepProfiles: (profiles: ScopeCreepProfile[]) => void
  selectCitation: (citation: CitationRef | null) => void
  setChatCollapsed: (collapsed: boolean) => void
  toggleChatCollapsed: () => void
  setWorkspaceView: (view: WorkspaceView) => void
  setActiveDocId: (docId: string | null) => void
  resetSession: () => void
}

const initialState = {
  sessionName: 'Untitled session',
  mode: 'rfp' as WorkspaceMode,
  documents: [] as DocumentMeta[],
  profiles: [] as RfpResultsProfile[],
  creepProfiles: [] as ScopeCreepProfile[],
  selectedCitation: null as CitationRef | null,
  chatCollapsed: readChatCollapsedPreference(),
  workspaceView: 'landing' as WorkspaceView,
  activeDocId: null as string | null,
}

function resolveActiveDocId(
  documents: DocumentMeta[],
  preferredId: string | null,
): string | null {
  if (documents.length === 0) return null
  if (preferredId && documents.some((doc) => doc.doc_id === preferredId)) {
    return preferredId
  }
  return documents[0]?.doc_id ?? null
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  setSessionName: (sessionName) => set({ sessionName }),

  setMode: (mode) => set({ mode }),

  setDocuments: (documents) =>
    set((state) => ({
      documents,
      activeDocId: resolveActiveDocId(documents, state.activeDocId),
    })),

  addDocument: (document) =>
    set((state) => {
      const exists = state.documents.some((doc) => doc.doc_id === document.doc_id)
      const documents = exists
        ? state.documents.map((doc) =>
            doc.doc_id === document.doc_id ? document : doc,
          )
        : [...state.documents, document]

      return {
        documents,
        activeDocId: state.activeDocId ?? document.doc_id,
      }
    }),

  removeDocument: (docId) =>
    set((state) => {
      const documents = state.documents.filter((doc) => doc.doc_id !== docId)
      const profiles = state.profiles.filter((p) => p.source_doc_id !== docId)
      const creepProfiles = state.creepProfiles.filter(
        (p) => p.baseline_doc_id !== docId && p.candidate_doc_id !== docId,
      )
      const selectedCitation =
        state.selectedCitation?.doc_id === docId ? null : state.selectedCitation

      return {
        documents,
        profiles,
        creepProfiles,
        selectedCitation,
        activeDocId: resolveActiveDocId(
          documents,
          state.activeDocId === docId ? null : state.activeDocId,
        ),
        workspaceView: documents.length === 0 ? 'landing' : state.workspaceView,
      }
    }),

  updateDocumentRole: (docId, role) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.doc_id === docId ? { ...doc, role } : doc,
      ),
    })),

  setProfiles: (profiles) => set({ profiles }),

  setCreepProfiles: (creepProfiles) => set({ creepProfiles }),

  selectCitation: (citation) =>
    set({
      selectedCitation: citation,
      activeDocId: citation?.doc_id ?? get().activeDocId,
      workspaceView: citation ? 'split' : get().workspaceView,
    }),

  setChatCollapsed: (chatCollapsed) => {
    writeChatCollapsedPreference(chatCollapsed)
    set({ chatCollapsed })
  },

  toggleChatCollapsed: () =>
    set((state) => {
      const chatCollapsed = !state.chatCollapsed
      writeChatCollapsedPreference(chatCollapsed)
      return { chatCollapsed }
    }),

  setWorkspaceView: (workspaceView) => set({ workspaceView }),

  setActiveDocId: (activeDocId) => set({ activeDocId }),

  resetSession: () => {
    writeChatCollapsedPreference(false)
    set({ ...initialState, chatCollapsed: false })
  },
}))

/** Active document metadata, or null when none selected / empty session */
export function selectActiveDocument(state: SessionState): DocumentMeta | null {
  if (!state.activeDocId) return null
  return state.documents.find((doc) => doc.doc_id === state.activeDocId) ?? null
}

/** Profiles for the current workspace mode */
export function selectVisibleProfiles(
  state: SessionState,
): RfpResultsProfile[] | ScopeCreepProfile[] {
  return state.mode === 'rfp' ? state.profiles : state.creepProfiles
}

/** Whether the workspace should show the landing empty state */
export function selectShowLanding(state: SessionState): boolean {
  return state.workspaceView === 'landing' && state.documents.length === 0
}

/** Whether any documents are loaded */
export function selectHasDocuments(state: SessionState): boolean {
  return state.documents.length > 0
}

export function useActiveDocument() {
  return useSessionStore(selectActiveDocument)
}

export function useVisibleProfiles() {
  return useSessionStore(selectVisibleProfiles)
}

export function useShowLanding() {
  return useSessionStore(selectShowLanding)
}

export function useHasDocuments() {
  return useSessionStore(selectHasDocuments)
}

/**
 * Dev harness — assert store actions behave as expected.
 * Called from App in development; no-op in production builds.
 */
export function runSessionStoreHarness(): void {
  const store = useSessionStore.getState()
  store.resetSession()

  store.setMode('scope_creep')
  if (useSessionStore.getState().mode !== 'scope_creep') {
    throw new Error('setMode failed')
  }

  store.addDocument({
    doc_id: 'doc-1',
    filename: 'rfp.pdf',
    mime: 'application/pdf',
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  })

  const afterAdd = useSessionStore.getState()
  if (afterAdd.documents.length !== 1 || afterAdd.activeDocId !== 'doc-1') {
    throw new Error('addDocument failed')
  }

  store.selectCitation({
    doc_id: 'doc-1',
    block_id: 'block-1',
    excerpt: 'Sample clause',
  })

  const afterCite = useSessionStore.getState()
  if (
    afterCite.workspaceView !== 'split' ||
    afterCite.selectedCitation?.block_id !== 'block-1'
  ) {
    throw new Error('selectCitation failed')
  }

  store.toggleChatCollapsed()
  if (!useSessionStore.getState().chatCollapsed) {
    throw new Error('toggleChatCollapsed failed')
  }

  store.removeDocument('doc-1')
  const afterRemove = useSessionStore.getState()
  if (afterRemove.documents.length !== 0 || afterRemove.workspaceView !== 'landing') {
    throw new Error('removeDocument failed')
  }

  store.resetSession()
}
