import { resolveMentionedDocIds } from '@/lib/chat-mentions'
import { buildRichAssistantReply } from '@/lib/chat-stub'
import type { AssistantChatContent, ChatMessage as AppChatMessage, FindClauseResult } from '@/lib/types'
import type { ChatMessage as ScoperChatMessage } from '@/lib/scoper-protocol'
import { buildAssistantRichContent } from '@/services/chat-citations'
import { findClause } from '@/services/find-clause'
import {
  getScoperClient,
  ScoperWebGpuUnavailableError,
} from '@/services/scoper-client'
import { useSessionStore } from '@/store/session-store'

type AgentTurnHandlers = {
  assistantId: string
  onStreamDelta?: (delta: string) => void
}

function toScoperMessages(messages: AppChatMessage[]): ScoperChatMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.text.trim(),
    }))
    .filter((message) => message.content.length > 0)
}

function resolveCitationDocIds(prompt: string): string[] {
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

function applyMentionScope(prompt: string) {
  const mentionedDocIds = resolveMentionedDocIds(prompt, useSessionStore.getState().documents)
  if (mentionedDocIds[0]) {
    useSessionStore.getState().setActiveDocId(mentionedDocIds[0])
  }
}

function findClauseRichContent(text: string, findResult: FindClauseResult): AssistantChatContent {
  const citationChips = findResult.matches.map((match) => match.citation)
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    paragraphs: paragraphs.length > 0 ? paragraphs : [text],
    citationChips: citationChips.length > 0 ? citationChips : undefined,
  }
}

function finalizeFindClauseTurn(assistantId: string, text: string, findResult: FindClauseResult) {
  useSessionStore.getState().finalizeAssistantMessage(assistantId, {
    text,
    rich: findClauseRichContent(text, findResult),
  })
}

async function ensureScoperReady() {
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
}

function buildFindClauseScoperPrompt(prompt: string, findResult: FindClauseResult): ScoperChatMessage[] {
  const excerpts = findResult.matches
    .slice(0, 4)
    .map((match, index) => `${index + 1}. ${match.citation.excerpt} (${match.relevance})`)
    .join('\n')

  return [
    {
      role: 'user',
      content: [
        `The user asked: "${prompt}"`,
        '',
        'Matching document excerpts:',
        excerpts || '(none)',
        '',
        'Write a concise 2-3 sentence answer. Reference the evidence directly.',
      ].join('\n'),
    },
  ]
}

async function streamFindClauseSummary(
  prompt: string,
  findResult: FindClauseResult,
  handlers: AgentTurnHandlers,
): Promise<string> {
  await ensureScoperReady()
  useSessionStore.getState().setChatModelStatus('generating')

  const scoper = getScoperClient()
  const result = await scoper.send(buildFindClauseScoperPrompt(prompt, findResult), {
    onText: handlers.onStreamDelta,
  })

  useSessionStore.getState().setChatModelStatus('ready')
  return result.text.trim() || findResult.summary
}

async function runFindClauseAgentPath(prompt: string, handlers: AgentTurnHandlers) {
  const docIds = resolveCitationDocIds(prompt)
  applyMentionScope(prompt)

  const findResult = await findClause(prompt, { docIds, limit: 6 })

  try {
    const summary = await streamFindClauseSummary(prompt, findResult, handlers)
    finalizeFindClauseTurn(handlers.assistantId, summary, findResult)
    return
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[agent] find_clause summary fallback', error)
    }
  }

  finalizeFindClauseTurn(handlers.assistantId, findResult.summary, findResult)
}

async function runGenericScoperTurn(
  messages: AppChatMessage[],
  handlers: AgentTurnHandlers,
) {
  await ensureScoperReady()
  useSessionStore.getState().setChatModelStatus('generating')

  const scoper = getScoperClient()
  const result = await scoper.send(toScoperMessages(messages), {
    onText: handlers.onStreamDelta,
  })

  useSessionStore.getState().setChatModelStatus('ready')

  useSessionStore.getState().finalizeAssistantMessage(handlers.assistantId, {
    text: result.text,
    rich: buildAssistantRichContent(result.text, []),
  })
}

async function applyStubAssistantReply(assistantId: string, prompt: string) {
  const state = useSessionStore.getState()
  const docIds = resolveCitationDocIds(prompt)
  applyMentionScope(prompt)

  const findResult =
    docIds.length > 0 ? await findClause(prompt, { docIds, limit: 6 }) : null

  if (findResult && findResult.matches.length > 0) {
    finalizeFindClauseTurn(assistantId, findResult.summary, findResult)
    return
  }

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

/** Agent loop — DuckDB retrieve → find_clause → Scoper summary or stub (BDA-053) */
export async function runAgentTurn(prompt: string, handlers: AgentTurnHandlers): Promise<void> {
  const trimmed = prompt.trim()
  if (!trimmed) return

  const docIds = resolveCitationDocIds(trimmed)

  if (docIds.length > 0) {
    try {
      await runFindClauseAgentPath(trimmed, handlers)
      return
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[agent] find_clause path failed', error)
      }
    }
  }

  try {
    const messages = useSessionStore.getState().chatMessages
    await runGenericScoperTurn(messages, handlers)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[agent] falling back to stub reply', error)
    }
    await applyStubAssistantReply(handlers.assistantId, trimmed)
    useSessionStore.getState().setChatModelStatus(
      error instanceof ScoperWebGpuUnavailableError ? 'unavailable' : 'ready',
    )
  }
}
