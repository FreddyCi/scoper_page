import type { ChatContextAttachment } from '@/lib/types'
import { runAgentTurn } from '@/services/agent'
import { focusCitation } from '@/services/citation-bridge'
import { ingestFile } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

const KEYWORD_CHECK_PROMPT =
  /\b(run keyword check|keyword checklist|contract keyword check|check keywords)\b/i

/** Run one chat turn through the document agent loop (BDA-051/053) */
export async function runChatAgentTurn(
  prompt: string,
  contextAttachments: ChatContextAttachment[] = [],
): Promise<void> {
  const trimmed = prompt.trim()
  if (!trimmed) return

  const { assistantMessage } = useSessionStore.getState().beginChatTurn(trimmed, contextAttachments)

  try {
    if (KEYWORD_CHECK_PROMPT.test(trimmed)) {
      await useSessionStore.getState().runContractKeywordReview()
      const profile = useSessionStore.getState().contractReviewProfile
      const text = profile
        ? `${profile.summary} Open the Profiles view to step through each checklist row and citations.`
        : 'Upload a contract PDF (set as baseline) and a keyword checklist Word or markdown file (supporting role), then ask again.'
      useSessionStore.getState().finalizeAssistantMessage(assistantMessage.id, { text })
      return
    }

    await runAgentTurn(trimmed, {
      assistantId: assistantMessage.id,
      contextAttachments,
      onStreamDelta: (delta) => {
        useSessionStore.getState().appendAssistantText(assistantMessage.id, delta)
      },
    })
  } finally {
    useSessionStore.getState().setChatGenerating(false)
  }
}

/** Dev harness — user anchor + streaming or stub assistant message (BDA-051) */
export async function runChatAgentHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()

  await runChatAgentTurn('Harness smoke test')

  const afterChat = useSessionStore.getState()
  if (
    !afterChat.chatStarted ||
    afterChat.chatCollapsed ||
    afterChat.chatMessages.length < 2
  ) {
    throw new Error('runChatAgentHarness failed: expected chat messages')
  }

  const user = afterChat.chatMessages.find((message) => message.role === 'user')
  const assistant = afterChat.chatMessages.find((message) => message.role === 'assistant')

  if (!user?.text.includes('Harness smoke test')) {
    throw new Error('runChatAgentHarness failed: expected user anchor message')
  }

  if (!assistant?.text.trim()) {
    throw new Error('runChatAgentHarness failed: expected assistant content')
  }

  if (assistant.streaming) {
    throw new Error('runChatAgentHarness failed: assistant still streaming')
  }

  store.clearChat()
}

/** Dev harness — assistant citation chips open split view (BDA-052) */
export async function runChatCitationChipHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()

  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`runChatCitationChipHarness: failed to load sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const ingested = await ingestFile(new File([blob], 'minimal.pdf', { type: 'application/pdf' }), {
    ocrEnabled: false,
  })

  store.commitIngestResults([ingested])
  store.setWorkspaceView('landing')

  await runChatAgentTurn('@minimal summarize the uploaded document')

  const assistant = useSessionStore.getState().chatMessages.find((message) => message.role === 'assistant')
  const chips = assistant?.rich?.citationChips ?? []

  if (ingested.block_count > 0 && chips.length === 0) {
    throw new Error('runChatCitationChipHarness failed: expected citation chips on assistant message')
  }

  if (chips[0]) {
    focusCitation(chips[0])

    const afterFocus = useSessionStore.getState()
    if (afterFocus.workspaceView !== 'split') {
      throw new Error('runChatCitationChipHarness failed: chip click should open split view')
    }
    if (afterFocus.activeDocId !== chips[0].doc_id) {
      throw new Error('runChatCitationChipHarness failed: active doc should match chip citation')
    }
  }

  store.resetSession()
}

/** Dev harness — "find indemnification" returns cite chips + split highlight (BDA-053) */
export async function runFindClauseAgentHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()

  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`runFindClauseAgentHarness: failed to load sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const ingested = await ingestFile(new File([blob], 'minimal.pdf', { type: 'application/pdf' }), {
    ocrEnabled: false,
  })

  store.commitIngestResults([ingested])
  store.setWorkspaceView('landing')

  await runChatAgentTurn('find indemnification')

  const assistant = useSessionStore.getState().chatMessages.find((message) => message.role === 'assistant')
  const chips = assistant?.rich?.citationChips ?? []

  if (ingested.block_count > 0 && chips.length === 0) {
    throw new Error('runFindClauseAgentHarness failed: expected citation chips on assistant message')
  }

  if (!assistant?.text.trim()) {
    throw new Error('runFindClauseAgentHarness failed: expected assistant summary text')
  }

  if (chips[0]) {
    focusCitation(chips[0])

    const afterFocus = useSessionStore.getState()
    if (afterFocus.workspaceView !== 'split') {
      throw new Error('runFindClauseAgentHarness failed: chip click should open split view')
    }
    if (afterFocus.activeDocId !== chips[0].doc_id) {
      throw new Error('runFindClauseAgentHarness failed: active doc should match chip citation')
    }
  }

  store.resetSession()
}
