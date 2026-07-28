import { buildRichAssistantReply } from '@/lib/chat-stub'
import type { ChatMessage as AppChatMessage } from '@/lib/types'
import type { ChatMessage as ScoperChatMessage } from '@/lib/scoper-protocol'
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

function applyStubAssistantReply(assistantId: string, prompt: string) {
  const state = useSessionStore.getState()
  const rich = buildRichAssistantReply({
    prompt,
    mode: state.mode,
    documents: state.documents,
    activeDocId: state.activeDocId,
  })

  useSessionStore.getState().finalizeAssistantMessage(assistantId, {
    text: rich.paragraphs[0] ?? 'Ready to help with your documents.',
    rich,
  })
}

async function runScoperTurn(assistantId: string, messages: AppChatMessage[]) {
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

  useSessionStore.getState().finalizeAssistantMessage(assistantId, {
    text: result.text,
  })
  useSessionStore.getState().setChatModelStatus('ready')
}

/** Run one chat turn — Scoper stream when available, rich stub fallback otherwise (BDA-051) */
export async function runChatAgentTurn(prompt: string): Promise<void> {
  const trimmed = prompt.trim()
  if (!trimmed) return

  const { assistantMessage } = useSessionStore.getState().beginChatTurn(trimmed)
  const messages = useSessionStore.getState().chatMessages

  try {
    await runScoperTurn(assistantMessage.id, messages)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[chat-agent] falling back to stub reply', error)
    }
    applyStubAssistantReply(assistantMessage.id, trimmed)
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
