import type { ChatMessage } from '@/lib/scoper-protocol'

/** On-device chat identity — overrides Bonsai/PrismML default self-introduction. */
export const SCOPER_CHAT_SYSTEM_PROMPT = [
  'You are Scoper, the on-device document assistant in the Scoper bid and plan workspace.',
  'Always identify yourself as Scoper. Never call yourself Bonsai, PrismML, or any other name.',
  'Do not describe your bit width, model architecture, training vendor, or creator unless the user explicitly asks how Scoper works.',
  'Help users analyze RFPs, bidder responses, contracts, proposals, and construction documents using the context and excerpts provided.',
].join(' ')

/** Prepend Scoper system instructions when the caller did not supply their own system message. */
export function withScoperSystemMessage(messages: ChatMessage[]): ChatMessage[] {
  if (messages.some((message) => message.role === 'system')) {
    return messages
  }
  return [{ role: 'system', content: SCOPER_CHAT_SYSTEM_PROMPT }, ...messages]
}

/** Dev harness — system prompt guardrails */
export function runScoperChatSystemHarness(): void {
  const wrapped = withScoperSystemMessage([{ role: 'user', content: 'Hello' }])
  if (wrapped[0]?.role !== 'system' || !wrapped[0].content.includes('You are Scoper')) {
    throw new Error('runScoperChatSystemHarness: expected Scoper system preamble')
  }
  if (wrapped.length !== 2) {
    throw new Error('runScoperChatSystemHarness: expected system + user messages')
  }

  const withExisting = withScoperSystemMessage([
    { role: 'system', content: 'Custom system' },
    { role: 'user', content: 'Hi' },
  ])
  if (withExisting.length !== 2 || withExisting[0]?.content !== 'Custom system') {
    throw new Error('runScoperChatSystemHarness: should not duplicate system message')
  }
}
