import { EcpAgentRunDeniedError, runEcpAgentTool } from '@/ecp/agent-run'
import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import { ensureScoperEcpReadyBeforeAgentRun } from '@/ecp/environment'
import { buildAgentPrompt, resolveAgentSearchDocIds } from '@/lib/chat-context'
import { resolveMentionedDocIds } from '@/lib/chat-mentions'
import { compactFindClauseQuery } from '@/services/document-search'
import { buildRichAssistantReply } from '@/lib/chat-stub'
import type {
  AssistantChatContent,
  ChatContextAttachment,
  ChatMessage as AppChatMessage,
  FindClauseResult,
} from '@/lib/types'
import type { ChatMessage as ScoperChatMessage } from '@/lib/scoper-protocol'
import { buildAssistantRichContent } from '@/services/chat-citations'
import {
  getScoperClient,
  ScoperWebGpuUnavailableError,
} from '@/services/scoper-client'
import {
  emitChatFindClauseComplete,
  emitChatFindClauseStart,
  getChatContextTracker,
  recordChatTurnText,
  resetChatContextTracker,
  setChatContextPhase,
  syncContextUsageFromTracker,
} from '@/services/agent-activity-bridge'
import { useSessionStore } from '@/store/session-store'

type AgentTurnHandlers = {
  assistantId: string
  contextAttachments?: ChatContextAttachment[]
  onStreamDelta?: (delta: string) => void
}

function toScoperMessages(messages: AppChatMessage[]): ScoperChatMessage[] {
  const sessionAttachments = useSessionStore.getState().chatContextAttachments

  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => {
      const content =
        message.role === 'user'
          ? (() => {
              const attachments =
                sessionAttachments.length > 0
                  ? sessionAttachments
                  : (message.contextAttachments ?? [])
              return attachments.length > 0
                ? buildAgentPrompt(message.text.trim(), attachments)
                : message.text.trim()
            })()
          : message.text.trim()

      return {
        role: message.role,
        content,
      }
    })
    .filter((message) => message.content.length > 0)
}

function resolveCitationDocIds(
  prompt: string,
  contextAttachments: ChatContextAttachment[] = [],
): string[] {
  const state = useSessionStore.getState()
  const mentionedDocIds = resolveMentionedDocIds(prompt, state.documents)

  return resolveAgentSearchDocIds(contextAttachments, {
    mentionedDocIds,
    sessionDocuments: state.documents,
    evaluationDocId: state.evaluationDocId,
    activeDocId: state.activeDocId,
  })
}

function applyMentionScope(prompt: string, contextAttachments: ChatContextAttachment[] = []) {
  const docIds = resolveCitationDocIds(prompt, contextAttachments)
  if (docIds[0]) {
    useSessionStore.getState().setActiveDocId(docIds[0])
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

function finalizeAgentError(assistantId: string, message: string) {
  useSessionStore.getState().finalizeAssistantMessage(assistantId, { text: message })
}

async function invokeFindClauseViaEcp(
  query: string,
  docIds: string[],
  limit: number,
): Promise<FindClauseResult> {
  return runEcpAgentTool({
    capabilityId: DOCUMENT_CAPABILITIES.find_clause,
    input: { query, docIds, limit },
    ecpReady: true,
  }) as Promise<FindClauseResult>
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
  setChatContextPhase('generating')

  const tracker = getChatContextTracker()
  const scoperMessages = buildFindClauseScoperPrompt(prompt, findResult)
  recordChatTurnText(tracker, scoperMessages.map((message) => message.content).join('\n'))

  const scoper = getScoperClient()
  const result = await scoper.send(scoperMessages, {
    onText: handlers.onStreamDelta,
  })

  useSessionStore.getState().setChatModelStatus('ready')
  syncContextUsageFromTracker(tracker)
  return result.text.trim() || findResult.summary
}

async function runFindClauseAgentPath(prompt: string, handlers: AgentTurnHandlers) {
  const attachments = handlers.contextAttachments ?? []
  const enrichedPrompt = buildAgentPrompt(prompt, attachments)
  const docIds = resolveCitationDocIds(prompt, attachments)
  applyMentionScope(prompt, attachments)

  const findQuery = compactFindClauseQuery(prompt)
  emitChatFindClauseStart(findQuery)

  let findResult: FindClauseResult
  try {
    findResult = await invokeFindClauseViaEcp(findQuery, docIds, 6)
  } catch (error) {
    if (error instanceof EcpAgentRunDeniedError) {
      finalizeAgentError(handlers.assistantId, error.message)
      return
    }
    throw error
  }

  emitChatFindClauseComplete(findResult.matches.length)

  try {
    const summary = await streamFindClauseSummary(enrichedPrompt, findResult, handlers)
    finalizeFindClauseTurn(handlers.assistantId, summary, findResult)
    syncContextUsageFromTracker(getChatContextTracker())
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
  setChatContextPhase('generating')

  const tracker = getChatContextTracker()
  const scoperMessages = toScoperMessages(messages)
  recordChatTurnText(tracker, scoperMessages.map((message) => message.content).join('\n'))

  const scoper = getScoperClient()
  const result = await scoper.send(scoperMessages, {
    onText: handlers.onStreamDelta,
  })

  useSessionStore.getState().setChatModelStatus('ready')
  syncContextUsageFromTracker(tracker)

  useSessionStore.getState().finalizeAssistantMessage(handlers.assistantId, {
    text: result.text,
    rich: buildAssistantRichContent(result.text, []),
  })
}

async function applyStubAssistantReply(
  assistantId: string,
  prompt: string,
  contextAttachments: ChatContextAttachment[] = [],
) {
  const state = useSessionStore.getState()
  const docIds = resolveCitationDocIds(prompt, contextAttachments)
  applyMentionScope(prompt, contextAttachments)

  let findResult: FindClauseResult | null = null
  if (docIds.length > 0) {
    const findQuery = compactFindClauseQuery(prompt)
    try {
      emitChatFindClauseStart(findQuery)
      findResult = await invokeFindClauseViaEcp(findQuery, docIds, 6)
      emitChatFindClauseComplete(findResult.matches.length)
    } catch (error) {
      if (error instanceof EcpAgentRunDeniedError) {
        finalizeAgentError(assistantId, error.message)
        return
      }
      if (import.meta.env.DEV) {
        console.warn('[agent] stub find_clause via ECP failed', error)
      }
    }
  }

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

/** Agent loop — ECP find_clause → Scoper summary or stub (BDA-053/062) */
export async function runAgentTurn(prompt: string, handlers: AgentTurnHandlers): Promise<void> {
  const trimmed = prompt.trim()
  if (!trimmed) return

  resetChatContextTracker()
  setChatContextPhase('generating')

  await ensureScoperEcpReadyBeforeAgentRun()

  const attachments = handlers.contextAttachments ?? []
  const docIds = resolveCitationDocIds(trimmed, attachments)

  if (docIds.length > 0) {
    try {
      await runFindClauseAgentPath(trimmed, handlers)
      return
    } catch (error) {
      if (error instanceof EcpAgentRunDeniedError) {
        finalizeAgentError(handlers.assistantId, error.message)
        return
      }
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
    await applyStubAssistantReply(handlers.assistantId, trimmed, attachments)
    useSessionStore.getState().setChatModelStatus(
      error instanceof ScoperWebGpuUnavailableError ? 'unavailable' : 'ready',
    )
  }
}
