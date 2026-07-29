import type { ChatMessage, ChatThread } from '@/lib/types'

export type ChatHistoryQueryEntry = {
  id: string
  messageId: string
  threadId: 'current' | string
  label: string
  created_at: string
  scrollAnchor: boolean
}

export type ChatHistoryQueryGroup = {
  id: string
  label: string
  entries: ChatHistoryQueryEntry[]
}

function truncate(text: string, maxChars: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars).trimEnd()}…`
}

function threadTitle(messages: ChatMessage[], fallback: string): string {
  const firstUser = messages.find((message) => message.role === 'user')
  if (!firstUser?.text.trim()) return fallback
  return truncate(firstUser.text, 80)
}

function userQueryEntries(
  messages: ChatMessage[],
  threadId: 'current' | string,
  idPrefix: string,
  anchorAssigned: { value: boolean },
): ChatHistoryQueryEntry[] {
  const entries: ChatHistoryQueryEntry[] = []

  for (const message of messages) {
    if (message.role !== 'user') continue

    const scrollAnchor = !anchorAssigned.value
    if (scrollAnchor) {
      anchorAssigned.value = true
    }

    entries.push({
      id: `${idPrefix}-${message.id}`,
      messageId: message.id,
      threadId,
      label: truncate(message.text, 120),
      created_at: message.created_at,
      scrollAnchor,
    })
  }

  return entries
}

/** Group user prompts from the active and archived chat threads for the History tab */
export function groupChatQueryHistory(
  chatMessages: ChatMessage[],
  chatThreads: ChatThread[],
): ChatHistoryQueryGroup[] {
  const groups: ChatHistoryQueryGroup[] = []
  const anchorAssigned = { value: false }

  const currentEntries = userQueryEntries(
    chatMessages,
    'current',
    'chat-history-current',
    anchorAssigned,
  )

  if (currentEntries.length > 0) {
    groups.push({
      id: 'chat-group-current',
      label:
        chatThreads.length > 0
          ? threadTitle(chatMessages, 'Current thread')
          : 'Agent queries',
      entries: currentEntries,
    })
  }

  for (const thread of [...chatThreads].reverse()) {
    const entries = userQueryEntries(
      thread.messages,
      thread.id,
      `chat-history-${thread.id}`,
      anchorAssigned,
    )

    if (entries.length === 0) continue

    groups.push({
      id: `chat-group-${thread.id}`,
      label: thread.title,
      entries,
    })
  }

  return groups
}

export function createChatThreadSnapshot(messages: ChatMessage[]): ChatThread | null {
  if (messages.length === 0) return null

  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    title: threadTitle(messages, 'Chat thread'),
    messages,
    created_at: messages[0]?.created_at ?? now,
    updated_at: now,
  }
}
