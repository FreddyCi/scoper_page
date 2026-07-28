import { resolveMentionedDocIds } from '@/lib/chat-mentions'
import { buildRichAssistantReply } from '@/lib/chat-stub'
import type { ChatMessage as AppChatMessage } from '@/lib/types'
import type { ChatMessage as ScoperChatMessage } from '@/lib/scoper-protocol'
import {
  buildAssistantRichContent,
  findChatCitations,
} from '@/services/chat-citations'
import { focusCitation } from '@/services/citation-bridge'
import { ingestFile } from '@/services/ingest-router'
import {
  getScoperClient,
  ScoperWebGpuUnavailableError,
} from '@/services/scoper-client'
import { useSessionStore } from '@/store/session-store'

function toScoperMessages(messages: AppChatMessage[]): ScoperChatMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.text.trim(),
    }))
    .filter((message) => message.content.length > 0)
}

function resolveCitationDocIds(prompt: string) {
  const state = useSessionStore.getState()
  const mentionedDocIds = resolveMentionedDocIds(prompt, state.documents)

  if (mentionedDocIds.length > 0) {
    return mentionedDocIds
  }

  if (state.activeDocId) {
    return [state.activeDocId]
  }

  return state.documents.map((doc) => doc.doc_id)
}

async function attachAssistantCitations(assistantId: string, prompt: string, text: string) {
  const state = useSessionStore.getState()
  const docIds = resolveCitationDocIds(prompt)
  const mentionedDocIds = resolveMentionedDocIds(prompt, state.documents)

  if (mentionedDocIds[0]) {
    useSessionStore.getState().setActiveDocId(mentionedDocIds[0])
  }

  const citationChips = await findChatCitations(prompt, state.documents, {
    docIds,
    limit: 3,
  })

  useSessionStore.getState().finalizeAssistantMessage(assistantId, {
    text,
    rich: buildAssistantRichContent(text, citationChips),
  })
}

async function applyStubAssistantReply(assistantId: string, prompt: string) {
  const state = useSessionStore.getState()
  const rich = buildRichAssistantReply({
    prompt,
    mode: state.mode,
    documents: state.documents,
    activeDocId: state.activeDocId,
  })

  const docIds = resolveCitationDocIds(prompt)
  const citationChips = await findChatCitations(prompt, state.documents, {
    docIds,
    limit: 3,
  })

  if (citationChips.length > 0) {
    rich.citationChips = citationChips
  }

  useSessionStore.getState().finalizeAssistantMessage(assistantId, {
    text: rich.paragraphs[0] ?? 'Ready to help with your documents.',
    rich,
  })
}

async function runScoperTurn(assistantId: string, messages: AppChatMessage[], prompt: string) {
  const scoper = getScoperClient()
  const env = await scoper.probeEnvironment()

  if (!env.webGpuAvailable) {
    throw new ScoperWebGpuUnavailableError(
      env.webGpuError ?? 'WebGPU is required for on-device chat.',
    )
  }

  if (scoper.getState().status !== 'ready') {
    useSessionStore.getState().setChatModelStatus('loading')
    await scoper.load()
    useSessionStore.getState().setChatModelStatus('ready')
  }

  useSessionStore.getState().setChatModelStatus('generating')

  const result = await scoper.send(toScoperMessages(messages), {
    onText: (delta) => {
      useSessionStore.getState().appendAssistantText(assistantId, delta)
    },
  })

  await attachAssistantCitations(assistantId, prompt, result.text)
  useSessionStore.getState().setChatModelStatus('ready')
}

/** Run one chat turn — Scoper stream when available, rich stub fallback otherwise (BDA-051/052) */
export async function runChatAgentTurn(prompt: string): Promise<void> {
  const trimmed = prompt.trim()
  if (!trimmed) return

  const { assistantMessage } = useSessionStore.getState().beginChatTurn(trimmed)
  const messages = useSessionStore.getState().chatMessages

  try {
    await runScoperTurn(assistantMessage.id, messages, trimmed)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[chat-agent] falling back to stub reply', error)
    }
    await applyStubAssistantReply(assistantMessage.id, trimmed)
    useSessionStore.getState().setChatModelStatus(
      error instanceof ScoperWebGpuUnavailableError ? 'unavailable' : 'ready',
    )
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
