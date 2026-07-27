import { create } from 'zustand'

import type {
  CitationRef,
  ChatMessage,
  DocumentMeta,
  DocumentRole,
  IngestResult,
  RfpResultsProfile,
  ScopeCreepProfile,
  WorkspaceMode,
  WorkspaceView,
} from '@/lib/types'

const CHAT_COLLAPSED_STORAGE_KEY = 'bda-chat-collapsed'
const CHAT_STARTED_STORAGE_KEY = 'bda-chat-started'

function readChatStartedPreference(): boolean {
  try {
    return sessionStorage.getItem(CHAT_STARTED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeChatStartedPreference(started: boolean) {
  try {
    sessionStorage.setItem(CHAT_STARTED_STORAGE_KEY, started ? '1' : '0')
  } catch {
    // sessionStorage unavailable (private mode, etc.)
  }
}

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

function readInitialChatCollapsed(): boolean {
  if (!readChatStartedPreference()) return true
  return readChatCollapsedPreference()
}

/** Stub assistant line until bitgpu chat (BDA-051) */
function stubAssistantReply(prompt: string): string {
  if (/scope|creep|baseline|change/i.test(prompt)) {
    return 'I can compare baseline and change documents once files are ingested. Upload both sets to get started.'
  }

  return 'I found 12 evaluation criteria across sections 3.1–3.4. Three look like hard pass/fail requirements.'
}

export type SessionState = {
  sessionName: string
  mode: WorkspaceMode
  documents: DocumentMeta[]
  profiles: RfpResultsProfile[]
  creepProfiles: ScopeCreepProfile[]
  selectedCitation: CitationRef | null
  chatCollapsed: boolean
  chatStarted: boolean
  chatMessages: ChatMessage[]
  workspaceView: WorkspaceView
  activeDocId: string | null
  uploadPopupOpen: boolean
  ocrEnabled: boolean

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
  sendChatPrompt: (text: string) => void
  clearChat: () => void
  setWorkspaceView: (view: WorkspaceView) => void
  setActiveDocId: (docId: string | null) => void
  setUploadPopupOpen: (open: boolean) => void
  setOcrEnabled: (enabled: boolean) => void
  commitIngestResults: (results: IngestResult[]) => void
  resetSession: () => void
}

const initialState = {
  sessionName: 'Untitled session',
  mode: 'rfp' as WorkspaceMode,
  documents: [] as DocumentMeta[],
  profiles: [] as RfpResultsProfile[],
  creepProfiles: [] as ScopeCreepProfile[],
  selectedCitation: null as CitationRef | null,
  chatCollapsed: readInitialChatCollapsed(),
  chatStarted: readChatStartedPreference(),
  chatMessages: [] as ChatMessage[],
  workspaceView: 'landing' as WorkspaceView,
  activeDocId: null as string | null,
  uploadPopupOpen: false,
  ocrEnabled: true,
}

function workspaceViewAfterIngest(
  mode: WorkspaceMode,
  currentView: WorkspaceView,
  hadDocuments: boolean,
): WorkspaceView {
  if (currentView !== 'landing' && hadDocuments) {
    return currentView
  }
  return mode === 'rfp' ? 'profiles' : 'split'
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

  sendChatPrompt: (text) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const state = get()
    const isFirstPrompt = !state.chatStarted
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      created_at: new Date().toISOString(),
    }
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: stubAssistantReply(trimmed),
      created_at: new Date().toISOString(),
    }

    if (isFirstPrompt) {
      writeChatStartedPreference(true)
      writeChatCollapsedPreference(false)
    }

    set({
      chatStarted: true,
      chatCollapsed: isFirstPrompt ? false : state.chatCollapsed,
      chatMessages: [...state.chatMessages, userMessage, assistantMessage],
    })
  },

  clearChat: () => {
    writeChatStartedPreference(false)
    writeChatCollapsedPreference(true)
    set({
      chatStarted: false,
      chatCollapsed: true,
      chatMessages: [],
    })
  },

  setWorkspaceView: (workspaceView) => set({ workspaceView }),

  setActiveDocId: (activeDocId) => set({ activeDocId }),

  setUploadPopupOpen: (uploadPopupOpen) => set({ uploadPopupOpen }),

  setOcrEnabled: (ocrEnabled) => set({ ocrEnabled }),

  commitIngestResults: (results) =>
    set((state) => {
      if (results.length === 0) return state

      const hadDocuments = state.documents.length > 0
      let documents = [...state.documents]

      for (const result of results) {
        const document: DocumentMeta = {
          doc_id: result.doc_id,
          filename: result.filename,
          mime: result.mime,
          role: 'unknown',
          uploaded_at: new Date().toISOString(),
        }
        const index = documents.findIndex((doc) => doc.doc_id === document.doc_id)
        if (index >= 0) {
          documents[index] = document
        } else {
          documents.push(document)
        }
      }

      return {
        documents,
        activeDocId: results[0]?.doc_id ?? state.activeDocId,
        workspaceView: workspaceViewAfterIngest(state.mode, state.workspaceView, hadDocuments),
      }
    }),

  resetSession: () => {
    writeChatStartedPreference(false)
    writeChatCollapsedPreference(true)
    set({
      ...initialState,
      chatStarted: false,
      chatCollapsed: true,
      chatMessages: [],
    })
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

/** Dev-only sample documents for header tab UI (BDA-012) */
export function seedDevDocuments() {
  const store = useSessionStore.getState()
  if (store.documents.length > 0) return

  store.setDocuments([
    {
      doc_id: 'doc-rfp',
      filename: 'City-RFP-2026.pdf',
      mime: 'application/pdf',
      role: 'unknown',
      uploaded_at: new Date().toISOString(),
    },
    {
      doc_id: 'doc-bid-a',
      filename: 'Bidder-A-Response.pdf',
      mime: 'application/pdf',
      role: 'unknown',
      uploaded_at: new Date().toISOString(),
    },
    {
      doc_id: 'doc-bid-b',
      filename: 'Bidder-B-Response.pdf',
      mime: 'application/pdf',
      role: 'unknown',
      uploaded_at: new Date().toISOString(),
    },
  ])
  store.setActiveDocId('doc-rfp')
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

  const beforeToggle = useSessionStore.getState().chatCollapsed
  store.toggleChatCollapsed()
  if (useSessionStore.getState().chatCollapsed === beforeToggle) {
    throw new Error('toggleChatCollapsed failed')
  }

  store.sendChatPrompt('Harness smoke test')
  const afterChat = useSessionStore.getState()
  if (
    !afterChat.chatStarted ||
    afterChat.chatCollapsed ||
    afterChat.chatMessages.length < 2
  ) {
    throw new Error('sendChatPrompt failed')
  }

  store.clearChat()
  if (
    useSessionStore.getState().chatStarted ||
    !useSessionStore.getState().chatCollapsed
  ) {
    throw new Error('clearChat failed')
  }

  store.removeDocument('doc-1')
  const afterRemove = useSessionStore.getState()
  if (afterRemove.documents.length !== 0 || afterRemove.workspaceView !== 'landing') {
    throw new Error('removeDocument failed')
  }

  store.setMode('rfp')
  store.commitIngestResults([
    {
      doc_id: 'harness-ingest',
      filename: 'harness.pdf',
      mime: 'application/pdf',
      block_count: 3,
      ocr_used: false,
    },
  ])
  const afterIngest = useSessionStore.getState()
  if (
    afterIngest.documents.length !== 1 ||
    afterIngest.workspaceView !== 'profiles' ||
    afterIngest.activeDocId !== 'harness-ingest'
  ) {
    throw new Error('commitIngestResults failed')
  }

  store.resetSession()
}
