import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import type {
  ChatActionProposal,
  ChatActionStatus,
  ChatContextAttachment,
  ChatSidebarTab,
  ChatThread,
  CitationRef,
  ChatMessage,
  DocumentMeta,
  DocumentRole,
  IngestResult,
  ProposalRequirementsProfile,
  RfpResultsProfile,
  ScopeCreepProfile,
  WorkspaceMode,
  WorkspaceView,
} from '@/lib/types'
import { createChatThreadSnapshot } from '@/lib/chat-history'
import {
  readReviewerNamePreference,
  writeReviewerNamePreference,
} from '@/lib/reviewer-profile'
import { runChatAgentTurn } from '@/services/chat-agent'
import { buildContractKeywordReview } from '@/services/build-contract-keyword-review'
import { buildRfpProfiles } from '@/services/build-rfp-profiles'
import {
  canAttachDocumentToChat,
  contextAttachmentsForDocuments,
  createDocumentContextAttachment,
  mergeContextAttachments,
} from '@/lib/chat-context'
import { clearBidderUploadPrompt, type UploadIntent } from '@/lib/upload-suggestions'
import { clearDocumentBytesCache, removeDocumentBytes } from '@/services/document-bytes-cache'
import { getProposalSetupState } from '@/lib/proposal-readiness'
import { assessProposalContextQuality } from '@/lib/proposal-context-quality'
import { createEmptyProposalHandoff, type ProposalHandoffState } from '@/lib/proposal-context-roll'
import { createProposalContextTracker } from '@/lib/proposal-context-tracker'
import { buildProposalRfpProfile } from '@/services/build-proposal-rfp-profile'
import {
  buildProposalVolume,
  buildProposalVolumes,
  patchProposalVolume,
  type BuildProposalVolumeBatchState,
} from '@/services/build-proposal-volumes'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import { syncContextUsageFromTracker } from '@/services/agent-activity-bridge'
import { ensureScoperEcpReadyBeforeAgentRun } from '@/ecp/environment'
import { getScoperClient } from '@/services/scoper-client'
import {
  appendAgentActivityEntry,
  clearAgentActivityState,
  createAgentActivityInitialState,
  type AgentActivityEntry,
  type ContextPhase,
} from '@/lib/agent-activity'
import type { ContextUsageResult } from '@/lib/context-usage'

const CHAT_COLLAPSED_STORAGE_KEY = 'bda-chat-collapsed'
const CHAT_STARTED_STORAGE_KEY = 'bda-chat-started'
const COMPANY_CONTEXT_STORAGE_KEY = 'bda-company-context'

function readCompanyContextPreference(): string {
  try {
    return sessionStorage.getItem(COMPANY_CONTEXT_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeCompanyContextPreference(value: string) {
  try {
    sessionStorage.setItem(COMPANY_CONTEXT_STORAGE_KEY, value)
  } catch {
    // sessionStorage unavailable
  }
}

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

function mapChatActions(
  messages: ChatMessage[],
  messageId: string,
  actionId: string,
  map: (action: ChatActionProposal) => ChatActionProposal,
): ChatMessage[] {
  return messages.map((message) => {
    if (message.id !== messageId || !message.rich?.actions) return message

    return {
      ...message,
      rich: {
        ...message.rich,
        actions: message.rich.actions.map((action) =>
          action.id === actionId ? map(action) : action,
        ),
      },
    }
  })
}

export type ChatModelStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'unavailable'

export type SessionState = {
  mode: WorkspaceMode
  documents: DocumentMeta[]
  profiles: RfpResultsProfile[]
  evaluationBaselineProfile: RfpResultsProfile | null
  evaluationDocId: string | null
  contractChecklistDocId: string | null
  contractReviewProfile: RfpResultsProfile | null
  companyContext: string
  reviewerName: string
  creepProfiles: ScopeCreepProfile[]
  proposalRequirementsProfile: ProposalRequirementsProfile | null
  /** Rolling UCW handoff between sectional turns; cleared at each generate batch (BDA-165). */
  proposalHandoffState: ProposalHandoffState | null
  proposalGenerating: boolean
  proposalGenerationError: string | null
  selectedCitation: CitationRef | null
  citationFocusSeq: number
  chatCollapsed: boolean
  chatStarted: boolean
  chatSidebarTab: ChatSidebarTab
  chatMessages: ChatMessage[]
  chatThreads: ChatThread[]
  chatFocusMessageId: string | null
  chatContextAttachments: ChatContextAttachment[]
  chatGenerating: boolean
  chatModelStatus: ChatModelStatus
  chatComposerSeed: string | null
  chatComposerSeedSeq: number
  workspaceView: WorkspaceView
  activeDocId: string | null
  uploadPopupOpen: boolean
  uploadIntent: UploadIntent
  ocrEnabled: boolean
  agentActivityLog: AgentActivityEntry[]
  contextUsageSnapshot: ContextUsageResult | null
  contextPhase: ContextPhase

  setMode: (mode: WorkspaceMode) => void
  setDocuments: (documents: DocumentMeta[]) => void
  addDocument: (document: DocumentMeta) => void
  removeDocument: (docId: string) => void
  updateDocumentRole: (docId: string, role: DocumentRole) => void
  setProfiles: (profiles: RfpResultsProfile[]) => void
  setEvaluationBaselineProfile: (profile: RfpResultsProfile | null) => void
  setEvaluationDocId: (docId: string | null) => void
  setContractChecklistDocId: (docId: string | null) => void
  setContractReviewProfile: (profile: RfpResultsProfile | null) => void
  runContractKeywordReview: () => Promise<void>
  setCompanyContext: (context: string) => void
  setReviewerName: (name: string) => void
  clearEvaluationSetup: () => void
  runRfpQualification: () => Promise<void>
  setProposalRequirementsProfile: (profile: ProposalRequirementsProfile | null) => void
  setProposalVolumeBody: (volumeId: string, markdown: string) => void
  clearProposalGeneration: () => void
  runProposalRequirementsProfile: () => Promise<void>
  runGenerateProposalVolumes: () => Promise<void>
  runGenerateProposalVolume: (volumeId: string) => Promise<void>
  setCreepProfiles: (profiles: ScopeCreepProfile[]) => void
  selectCitation: (citation: CitationRef | null) => void
  bumpCitationFocus: () => void
  setChatCollapsed: (collapsed: boolean) => void
  toggleChatCollapsed: () => void
  setChatSidebarTab: (tab: ChatSidebarTab) => void
  sendChatPrompt: (text: string) => void
  seedChatComposer: (text: string) => void
  clearChatComposerSeed: () => void
  setChatContextAttachments: (attachments: ChatContextAttachment[]) => void
  addChatContextDocument: (docId: string) => boolean
  removeChatContextAttachment: (id: string) => void
  beginChatTurn: (
    text: string,
    contextAttachments?: ChatContextAttachment[],
  ) => { userMessage: ChatMessage; assistantMessage: ChatMessage }
  appendAssistantText: (messageId: string, delta: string) => void
  finalizeAssistantMessage: (
    messageId: string,
    patch: Pick<ChatMessage, 'text' | 'rich'>,
  ) => void
  setChatGenerating: (generating: boolean) => void
  setChatModelStatus: (status: ChatModelStatus) => void
  updateChatAction: (
    messageId: string,
    actionId: string,
    patch: Pick<ChatActionProposal, 'title' | 'subtitle'>,
  ) => void
  setChatActionStatus: (
    messageId: string,
    actionId: string,
    status: ChatActionStatus,
  ) => void
  clearChat: () => void
  replayLastChatTurn: () => void
  startNewChat: () => void
  focusChatMessage: (messageId: string, threadId?: 'current' | string) => void
  clearChatFocusMessage: () => void
  setWorkspaceView: (view: WorkspaceView) => void
  setActiveDocId: (docId: string | null) => void
  setUploadPopupOpen: (open: boolean) => void
  openUploadPopup: (intent: UploadIntent) => void
  setOcrEnabled: (enabled: boolean) => void
  commitIngestResults: (results: IngestResult[]) => void
  resetSession: () => void
  pushAgentActivity: (
    entry: Omit<AgentActivityEntry, 'id' | 'at'> & { id?: string; at?: string },
  ) => void
  clearAgentActivity: () => void
  setContextPhase: (phase: ContextPhase) => void
  setContextUsageSnapshot: (snapshot: ContextUsageResult | null) => void
}

const initialState = {
  mode: 'rfp' as WorkspaceMode,
  documents: [] as DocumentMeta[],
  profiles: [] as RfpResultsProfile[],
  evaluationBaselineProfile: null as RfpResultsProfile | null,
  evaluationDocId: null as string | null,
  contractChecklistDocId: null as string | null,
  contractReviewProfile: null as RfpResultsProfile | null,
  companyContext: readCompanyContextPreference(),
  reviewerName: readReviewerNamePreference(),
  creepProfiles: [] as ScopeCreepProfile[],
  proposalRequirementsProfile: null as ProposalRequirementsProfile | null,
  proposalHandoffState: null as ProposalHandoffState | null,
  proposalGenerating: false,
  proposalGenerationError: null as string | null,
  selectedCitation: null as CitationRef | null,
  citationFocusSeq: 0,
  chatCollapsed: readInitialChatCollapsed(),
  chatStarted: readChatStartedPreference(),
  chatSidebarTab: 'agent' as ChatSidebarTab,
  chatMessages: [] as ChatMessage[],
  chatThreads: [] as ChatThread[],
  chatFocusMessageId: null as string | null,
  chatContextAttachments: [] as ChatContextAttachment[],
  chatGenerating: false,
  chatModelStatus: 'idle' as ChatModelStatus,
  chatComposerSeed: null as string | null,
  chatComposerSeedSeq: 0,
  workspaceView: 'landing' as WorkspaceView,
  activeDocId: null as string | null,
  uploadPopupOpen: false,
  uploadIntent: 'rfp' as UploadIntent,
  ocrEnabled: true,
  ...createAgentActivityInitialState(),
}

function workspaceViewAfterIngest(
  mode: WorkspaceMode,
  currentView: WorkspaceView,
  hadDocuments: boolean,
): WorkspaceView {
  if (mode === 'proposal') {
    return 'profiles'
  }
  if (currentView !== 'landing' && hadDocuments) {
    return currentView
  }
  return 'split'
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

  setMode: (mode) =>
    set((state) => {
      if (state.mode === mode) return state
      return {
        mode,
        proposalRequirementsProfile: null,
        proposalHandoffState: null,
        proposalGenerating: false,
        proposalGenerationError: null,
      }
    }),

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
      removeDocumentBytes(docId)
      const documents = state.documents.filter((doc) => doc.doc_id !== docId)
      const profiles = state.profiles.filter((p) => p.source_doc_id !== docId)
      const evaluationBaselineProfile =
        state.evaluationBaselineProfile?.source_doc_id === docId
          ? null
          : state.evaluationBaselineProfile
      const evaluationDocId = state.evaluationDocId === docId ? null : state.evaluationDocId
      const creepProfiles = state.creepProfiles.filter(
        (p) => p.baseline_doc_id !== docId && p.candidate_doc_id !== docId,
      )
      const proposalRequirementsProfile =
        state.proposalRequirementsProfile?.rfp_doc_id === docId ||
        state.evaluationDocId === docId
          ? null
          : state.proposalRequirementsProfile
      const proposalGenerationError =
        state.evaluationDocId === docId || state.proposalRequirementsProfile?.rfp_doc_id === docId
          ? null
          : state.proposalGenerationError
      const proposalGenerating =
        state.evaluationDocId === docId ? false : state.proposalGenerating
      const selectedCitation =
        state.selectedCitation?.doc_id === docId ? null : state.selectedCitation

      return {
        documents,
        profiles,
        evaluationBaselineProfile,
        evaluationDocId,
        creepProfiles,
        proposalRequirementsProfile,
        proposalGenerating,
        proposalGenerationError,
        selectedCitation,
        activeDocId: resolveActiveDocId(
          documents,
          state.activeDocId === docId ? null : state.activeDocId,
        ),
        workspaceView: documents.length === 0 ? 'landing' : state.workspaceView,
        chatContextAttachments: state.chatContextAttachments.filter(
          (item) => item.docId !== docId,
        ),
      }
    }),

  updateDocumentRole: (docId, role) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.doc_id === docId ? { ...doc, role } : doc,
      ),
    })),

  setProfiles: (profiles) => set({ profiles }),

  setEvaluationBaselineProfile: (evaluationBaselineProfile) => set({ evaluationBaselineProfile }),

  setEvaluationDocId: (evaluationDocId) => set({ evaluationDocId }),

  setCompanyContext: (companyContext) => {
    writeCompanyContextPreference(companyContext)
    set({ companyContext })
  },

  setReviewerName: (reviewerName) => {
    writeReviewerNamePreference(reviewerName)
    set({ reviewerName })
  },

  clearEvaluationSetup: () => {
    writeCompanyContextPreference('')
    set({
      companyContext: '',
      evaluationDocId: null,
      evaluationBaselineProfile: null,
      contractChecklistDocId: null,
      contractReviewProfile: null,
      profiles: [],
      proposalRequirementsProfile: null,
      proposalGenerating: false,
      proposalGenerationError: null,
    })
  },

  setContractChecklistDocId: (contractChecklistDocId) => set({ contractChecklistDocId }),

  setContractReviewProfile: (contractReviewProfile) => set({ contractReviewProfile }),

  runContractKeywordReview: async () => {
    const { documents, evaluationDocId, contractChecklistDocId } = get()

    const contractDocId =
      evaluationDocId ??
      documents.find((doc) => doc.role === 'baseline' && doc.mime === 'application/pdf')?.doc_id ??
      documents.find((doc) => doc.mime === 'application/pdf' && doc.role !== 'supporting')?.doc_id ??
      null

    const checklistDocId =
      contractChecklistDocId ??
      documents.find(
        (doc) =>
          doc.mime === 'text/markdown' ||
          doc.mime ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )?.doc_id ??
      null

    if (!contractDocId || !checklistDocId) return

    const profile = await buildContractKeywordReview(documents, {
      contractDocId,
      checklistDocId,
    })

    set({
      evaluationDocId: contractDocId,
      contractChecklistDocId: checklistDocId,
      contractReviewProfile: profile,
      workspaceView: 'profiles',
    })
  },

  runRfpQualification: async () => {
    const { mode, documents, evaluationDocId, companyContext } = get()
    if (mode === 'proposal') return
    if (documents.length === 0) return

    const resolvedEvaluationDocId =
      evaluationDocId ??
      documents.find((doc) => doc.role === 'baseline')?.doc_id ??
      null

    if (!resolvedEvaluationDocId) return

    const result = await buildRfpProfiles(documents, {
      evaluationDocId: resolvedEvaluationDocId,
      companyContext,
    })

    set({
      evaluationDocId: resolvedEvaluationDocId,
      evaluationBaselineProfile: result.baselineProfile,
      profiles: result.responseProfiles,
      workspaceView: 'profiles',
    })
  },

  setProposalRequirementsProfile: (proposalRequirementsProfile) =>
    set({ proposalRequirementsProfile }),

  setProposalVolumeBody: (volumeId, markdown) => {
    const profile = get().proposalRequirementsProfile
    if (!profile) return

    if (!profile.volumes.some((volume) => volume.id === volumeId)) return

    const editedAt = new Date().toISOString()
    set({
      proposalRequirementsProfile: patchProposalVolume(profile, volumeId, {
        bodyMarkdown: markdown,
        status: 'draft',
        edited: true,
        editedAt,
        errorMessage: undefined,
      }),
    })
  },

  clearProposalGeneration: () =>
    set({
      proposalHandoffState: null,
      proposalGenerating: false,
      proposalGenerationError: null,
    }),

  runProposalRequirementsProfile: async () => {
    const state = get()
    const setup = getProposalSetupState({
      documents: state.documents,
      evaluationDocId: state.evaluationDocId,
      companyContext: state.companyContext,
      proposalRequirementsProfile: state.proposalRequirementsProfile,
    })

    if (!setup.hasRfp || !setup.hasContext) return
    if (state.evaluationDocId == null) return

    set({ proposalGenerationError: null })

    try {
      const profile = await buildProposalRfpProfile(state.documents, {
        rfpDocId: state.evaluationDocId,
        companyContext: state.companyContext,
        baselineProfile: state.evaluationBaselineProfile,
      })

      if (!profile) {
        set({
          proposalRequirementsProfile: null,
          proposalGenerationError: 'Could not build a proposal profile from the RFP.',
        })
        return
      }

      set({
        proposalRequirementsProfile: profile,
        proposalGenerationError: null,
        workspaceView: 'profiles',
      })
    } catch (error) {
      set({
        proposalGenerationError:
          error instanceof Error ? error.message : 'Proposal profile build failed',
      })
    }
  },

  runGenerateProposalVolumes: async () => {
    const state = get()
    const setup = getProposalSetupState({
      documents: state.documents,
      evaluationDocId: state.evaluationDocId,
      companyContext: state.companyContext,
      proposalRequirementsProfile: state.proposalRequirementsProfile,
    })

    if (!setup.readyToGenerate || state.proposalGenerating || state.chatGenerating) return

    const profile = state.proposalRequirementsProfile
    if (!profile) return

    const contextQuality = assessProposalContextQuality(state.companyContext)
    if (!contextQuality.ok) {
      set({
        proposalGenerationError: contextQuality.warnings.join(' '),
        proposalHandoffState: null,
      })
      return
    }

    set({
      proposalGenerating: true,
      proposalGenerationError: null,
      proposalHandoffState: null,
      ...clearAgentActivityState(),
      contextPhase: 'generating',
    })

    try {
      await ensureScoperEcpReadyBeforeAgentRun()
      getScoperClient().resetConversation()

      await buildProposalVolumes({
        documents: state.documents,
        profile,
        companyContext: state.companyContext,
        onProfileUpdate: (updated) => set({ proposalRequirementsProfile: updated }),
        onHandoffUpdate: (handoff) => set({ proposalHandoffState: handoff }),
      })
    } catch (error) {
      set({
        proposalGenerationError:
          error instanceof Error ? error.message : 'Proposal volume generation failed',
      })
    } finally {
      set({ proposalGenerating: false, contextPhase: 'idle' })
    }
  },

  runGenerateProposalVolume: async (volumeId: string) => {
    const state = get()
    const setup = getProposalSetupState({
      documents: state.documents,
      evaluationDocId: state.evaluationDocId,
      companyContext: state.companyContext,
      proposalRequirementsProfile: state.proposalRequirementsProfile,
    })

    if (!setup.readyToGenerate || state.proposalGenerating || state.chatGenerating) return

    const profile = state.proposalRequirementsProfile
    if (!profile) return

    const volume = profile.volumes.find((entry) => entry.id === volumeId)
    if (!volume) {
      set({
        proposalGenerationError: `Unknown proposal volume (${volumeId}).`,
      })
      return
    }

    const volumeLabel = volume.title.trim() || volumeId

    const contextQuality = assessProposalContextQuality(state.companyContext)
    if (!contextQuality.ok) {
      set({
        proposalGenerationError: contextQuality.warnings.join(' '),
        proposalHandoffState: null,
      })
      return
    }

    set({
      proposalGenerating: true,
      proposalGenerationError: null,
      proposalHandoffState: null,
      ...clearAgentActivityState(),
      contextPhase: 'generating',
    })

    try {
      await ensureScoperEcpReadyBeforeAgentRun()
      getScoperClient().resetConversation()

      const rfpDoc = state.documents.find((doc) => doc.doc_id === profile.rfp_doc_id)
      if (!rfpDoc) {
        throw new Error('RFP document not found in session')
      }

      const blocks = await fetchDocumentBlocks(profile.rfp_doc_id)

      const batchState: BuildProposalVolumeBatchState = {
        handoff: createEmptyProposalHandoff({
          activeGoal:
            profile.summary.trim() ||
            'Draft complete proposal volumes for the attached RFP',
          packageKind: profile.packageKind,
          pendingSections: [],
        }),
        handoffChunkIndex: 0,
        contextTracker: createProposalContextTracker({
          effectiveMaxSeqLen: getScoperClient().getState().maxSeqLen,
        }),
        isolatedVolumeRun: true,
      }

      const updated = await buildProposalVolume(
        profile,
        volumeId,
        {
          blocks,
          rfpDoc,
          companyContext: state.companyContext,
          onProfileUpdate: (next) => set({ proposalRequirementsProfile: next }),
          onHandoffUpdate: (handoff) => set({ proposalHandoffState: handoff }),
        },
        batchState,
      )

      set({ proposalRequirementsProfile: updated })
      syncContextUsageFromTracker(batchState.contextTracker)
    } catch (error) {
      const base =
        error instanceof Error ? error.message : 'Proposal volume generation failed'
      set({
        proposalGenerationError: `${volumeLabel}: ${base}`,
      })
    } finally {
      set({ proposalGenerating: false, contextPhase: 'idle' })
    }
  },

  pushAgentActivity: (entry) =>
    set((state) => ({
      agentActivityLog: appendAgentActivityEntry(state.agentActivityLog, entry),
    })),

  clearAgentActivity: () => set(clearAgentActivityState()),

  setContextPhase: (contextPhase) => set({ contextPhase }),

  setContextUsageSnapshot: (contextUsageSnapshot) => set({ contextUsageSnapshot }),

  setCreepProfiles: (creepProfiles) => set({ creepProfiles }),

  selectCitation: (citation) =>
    set({
      selectedCitation: citation,
      activeDocId: citation?.doc_id ?? get().activeDocId,
      workspaceView: citation ? 'split' : get().workspaceView,
    }),

  bumpCitationFocus: () =>
    set((state) => ({
      citationFocusSeq: state.citationFocusSeq + 1,
    })),

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

  setChatSidebarTab: (chatSidebarTab) => set({ chatSidebarTab }),

  sendChatPrompt: (text) => {
    const { chatContextAttachments } = get()
    void runChatAgentTurn(text, chatContextAttachments)
  },

  seedChatComposer: (text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    writeChatCollapsedPreference(false)
    set((state) => ({
      chatComposerSeed: trimmed,
      chatComposerSeedSeq: state.chatComposerSeedSeq + 1,
      chatCollapsed: false,
      chatSidebarTab: 'agent',
      chatStarted: true,
    }))
  },

  clearChatComposerSeed: () => set({ chatComposerSeed: null }),

  setChatContextAttachments: (chatContextAttachments) => set({ chatContextAttachments }),

  addChatContextDocument: (docId) => {
    const doc = get().documents.find((item) => item.doc_id === docId)
    if (!doc || !canAttachDocumentToChat(doc)) return false

    writeChatCollapsedPreference(false)
    set((state) => ({
      chatContextAttachments: mergeContextAttachments(state.chatContextAttachments, [
        createDocumentContextAttachment(doc),
      ]),
      chatCollapsed: false,
      chatSidebarTab: 'agent',
      chatStarted: true,
    }))
    return true
  },

  removeChatContextAttachment: (id) =>
    set((state) => ({
      chatContextAttachments: state.chatContextAttachments.filter((item) => item.id !== id),
    })),

  beginChatTurn: (text, contextAttachments = []) => {
    const trimmed = text.trim()
    const state = get()
    const isFirstPrompt = !state.chatStarted
    const activeAttachments =
      contextAttachments.length > 0 ? contextAttachments : state.chatContextAttachments

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      contextAttachments:
        activeAttachments.length > 0 ? activeAttachments : undefined,
      created_at: new Date().toISOString(),
    }

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: '',
      streaming: true,
      created_at: new Date().toISOString(),
    }

    if (isFirstPrompt) {
      writeChatStartedPreference(true)
      writeChatCollapsedPreference(false)
    }

    set({
      chatStarted: true,
      chatCollapsed: isFirstPrompt ? false : state.chatCollapsed,
      chatGenerating: true,
      chatModelStatus: state.chatModelStatus === 'unavailable' ? 'unavailable' : 'generating',
      chatMessages: [...state.chatMessages, userMessage, assistantMessage],
    })

    return { userMessage, assistantMessage }
  },

  appendAssistantText: (messageId, delta) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((message) =>
        message.id === messageId ? { ...message, text: message.text + delta } : message,
      ),
    })),

  finalizeAssistantMessage: (messageId, patch) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((message) =>
        message.id === messageId
          ? { ...message, ...patch, streaming: false }
          : message,
      ),
    })),

  setChatGenerating: (chatGenerating) => set({ chatGenerating }),

  setChatModelStatus: (chatModelStatus) => set({ chatModelStatus }),

  updateChatAction: (messageId, actionId, patch) =>
    set((state) => ({
      chatMessages: mapChatActions(state.chatMessages, messageId, actionId, (action) => ({
        ...action,
        ...patch,
      })),
    })),

  setChatActionStatus: (messageId, actionId, status) =>
    set((state) => ({
      chatMessages: mapChatActions(state.chatMessages, messageId, actionId, (action) => ({
        ...action,
        status,
      })),
    })),

  clearChat: () => {
    writeChatStartedPreference(false)
    writeChatCollapsedPreference(true)
    getScoperClient().resetConversation()
    set({
      chatStarted: false,
      chatCollapsed: true,
      chatSidebarTab: 'agent',
      chatMessages: [],
      chatFocusMessageId: null,
      chatContextAttachments: [],
      chatGenerating: false,
      chatModelStatus: 'idle',
      ...clearAgentActivityState(),
    })
  },

  replayLastChatTurn: () => {
    const state = get()
    if (state.chatGenerating) return

    let lastUserIndex = -1
    for (let index = state.chatMessages.length - 1; index >= 0; index -= 1) {
      if (state.chatMessages[index]?.role === 'user') {
        lastUserIndex = index
        break
      }
    }
    if (lastUserIndex < 0) return

    const lastUser = state.chatMessages[lastUserIndex]
    const trimmed = lastUser.text.trim()
    if (!trimmed) return

    const priorMessages = state.chatMessages.slice(0, lastUserIndex)
    const attachments = lastUser.contextAttachments ?? []

    getScoperClient().resetConversation()
    set({
      chatMessages: priorMessages,
      chatFocusMessageId: null,
      chatContextAttachments: attachments.length > 0 ? [...attachments] : [],
      chatGenerating: false,
      chatModelStatus: state.chatModelStatus === 'unavailable' ? 'unavailable' : 'idle',
      chatSidebarTab: 'agent',
      chatStarted: true,
    })

    void runChatAgentTurn(trimmed, attachments)
  },

  startNewChat: () => {
    const state = get()
    if (state.chatGenerating) return

    const snapshot = createChatThreadSnapshot(state.chatMessages)
    const chatThreads = snapshot ? [...state.chatThreads, snapshot] : state.chatThreads

    getScoperClient().resetConversation()
    writeChatStartedPreference(chatThreads.length > 0)
    writeChatCollapsedPreference(false)

    set({
      chatThreads,
      chatMessages: [],
      chatFocusMessageId: null,
      chatContextAttachments: [],
      chatGenerating: false,
      chatModelStatus: state.chatModelStatus === 'unavailable' ? 'unavailable' : 'idle',
      chatSidebarTab: 'agent',
      chatStarted: chatThreads.length > 0,
      chatCollapsed: false,
      ...clearAgentActivityState(),
    })
  },

  focusChatMessage: (messageId, threadId = 'current') => {
    if (threadId !== 'current') {
      const state = get()
      const thread = state.chatThreads.find((item) => item.id === threadId)
      if (!thread) return

      let chatThreads = state.chatThreads.filter((item) => item.id !== threadId)
      const currentSnapshot = createChatThreadSnapshot(state.chatMessages)
      if (currentSnapshot) {
        chatThreads = [...chatThreads, currentSnapshot]
      }

      getScoperClient().resetConversation()
      writeChatStartedPreference(true)
      writeChatCollapsedPreference(false)

      set({
        chatThreads,
        chatMessages: thread.messages,
        chatFocusMessageId: messageId,
        chatSidebarTab: 'agent',
        chatStarted: true,
        chatCollapsed: false,
      })
      return
    }

    set({
      chatFocusMessageId: messageId,
      chatSidebarTab: 'agent',
      chatCollapsed: false,
    })
  },

  clearChatFocusMessage: () => set({ chatFocusMessageId: null }),

  setWorkspaceView: (workspaceView) => set({ workspaceView }),

  setActiveDocId: (activeDocId) => set({ activeDocId }),

  setUploadPopupOpen: (uploadPopupOpen) => set({ uploadPopupOpen }),

  openUploadPopup: (uploadIntent) => set({ uploadPopupOpen: true, uploadIntent }),

  setOcrEnabled: (ocrEnabled) => set({ ocrEnabled }),

  commitIngestResults: (results) =>
    set((state) => {
      if (results.length === 0) return state

      const hadDocuments = state.documents.length > 0
      let documents = [...state.documents]
      const ingestedDocuments: DocumentMeta[] = []

      for (const result of results) {
        const existing = documents.find((doc) => doc.doc_id === result.doc_id)
        const document: DocumentMeta = {
          doc_id: result.doc_id,
          filename: result.filename,
          mime: result.mime,
          role: result.role ?? existing?.role ?? 'unknown',
          uploaded_at: existing?.uploaded_at ?? new Date().toISOString(),
        }
        ingestedDocuments.push(document)
        const index = documents.findIndex((doc) => doc.doc_id === document.doc_id)
        if (index >= 0) {
          documents[index] = document
        } else {
          documents.push(document)
        }
      }

      const addedContextAttachments = contextAttachmentsForDocuments(ingestedDocuments)
      const chatContextAttachments =
        addedContextAttachments.length > 0
          ? mergeContextAttachments(state.chatContextAttachments, addedContextAttachments)
          : state.chatContextAttachments
      const addedContext = addedContextAttachments.length > 0

      if (addedContext && state.chatCollapsed) {
        writeChatCollapsedPreference(false)
      }

      return {
        documents,
        activeDocId: results[0]?.doc_id ?? state.activeDocId,
        workspaceView: workspaceViewAfterIngest(state.mode, state.workspaceView, hadDocuments),
        chatContextAttachments,
        chatCollapsed: addedContext ? false : state.chatCollapsed,
      }
    }),

  resetSession: () => {
    clearDocumentBytesCache()
    clearBidderUploadPrompt()
    writeChatStartedPreference(false)
    writeChatCollapsedPreference(true)
    writeCompanyContextPreference('')
    getScoperClient().resetConversation()
    get().clearProposalGeneration()
    set({
      ...initialState,
      companyContext: '',
      chatStarted: false,
      chatCollapsed: true,
      chatSidebarTab: 'agent',
      chatMessages: [],
      chatThreads: [],
      chatFocusMessageId: null,
      chatContextAttachments: [],
      chatGenerating: false,
      chatModelStatus: 'idle',
    })
  },
}))

/** Bidder/response docs eligible for qualification cards (excludes baseline + supporting) */
export function selectBidderResponseCount(state: SessionState): number {
  const { documents, evaluationDocId } = state
  return documents.filter(
    (doc) => doc.doc_id !== evaluationDocId && doc.role !== 'supporting',
  ).length
}

export function useBidderResponseCount() {
  return useSessionStore(selectBidderResponseCount)
}

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

/** Proposal mode tab — enabled after RFP qualification baseline exists, or when already in proposal mode (e.g. landing card). */
export function selectCanSwitchToProposalMode(state: SessionState): boolean {
  if (state.mode === 'proposal') return true
  return state.evaluationBaselineProfile != null
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

export function useRfpProfiles() {
  return useSessionStore(
    useShallow((state) => {
      if (!state.contractReviewProfile) return state.profiles
      return [state.contractReviewProfile, ...state.profiles]
    }),
  )
}

export function useCreepProfiles() {
  return useSessionStore((state) => state.creepProfiles)
}

export function selectProposalSetupState(state: SessionState) {
  return getProposalSetupState({
    documents: state.documents,
    evaluationDocId: state.evaluationDocId,
    companyContext: state.companyContext,
    proposalRequirementsProfile: state.proposalRequirementsProfile,
  })
}

export function useProposalSetupState() {
  return useSessionStore(useShallow(selectProposalSetupState))
}

export function useProposalRequirementsProfile() {
  return useSessionStore((state) => state.proposalRequirementsProfile)
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

  store.setMode('proposal')
  if (useSessionStore.getState().mode !== 'proposal') {
    throw new Error('setMode failed')
  }

  store.setProposalRequirementsProfile({
    profile_id: 'harness-proposal',
    rfp_doc_id: 'doc-rfp-placeholder',
    summary: 'Harness profile',
    built_at: new Date().toISOString(),
    packageKind: 'unknown',
    packageWarnings: [],
    volumes: [
      {
        id: 'vol-h',
        title: 'Technical',
        requirementSummary: 'Methodology',
        status: 'pending',
      },
    ],
  })
  useSessionStore.setState({
    proposalGenerating: true,
    proposalGenerationError: 'harness error',
  })

  store.setMode('rfp')
  const afterModeSwitch = useSessionStore.getState()
  if (
    afterModeSwitch.proposalRequirementsProfile != null ||
    afterModeSwitch.proposalGenerating ||
    afterModeSwitch.proposalGenerationError != null
  ) {
    throw new Error('setMode should clear proposal state')
  }

  store.setMode('proposal')
  if (useSessionStore.getState().mode !== 'proposal') {
    throw new Error('setMode back to proposal failed')
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
    afterIngest.workspaceView !== 'split' ||
    afterIngest.activeDocId !== 'harness-ingest'
  ) {
    throw new Error('commitIngestResults failed')
  }

  store.resetSession()
}
