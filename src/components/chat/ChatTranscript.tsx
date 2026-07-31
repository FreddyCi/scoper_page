import { useEffect } from 'react'

import { AgentActivityMarkers } from '@/components/chat/AgentActivityMarkers'
import { AssistantMessageBody } from '@/components/chat/AssistantMessageBody'
import {
  Message,
  MessageContent,
  MessageGroup,
} from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller'
import { SCOPER_BONSAI_17B } from '@/lib/scoper-model'
import { shouldShowAgentActivityStrip } from '@/lib/agent-activity'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

const MODEL_STATUS_COPY = {
  idle: null,
  loading: `Loading ${SCOPER_BONSAI_17B.label}…`,
  ready: null,
  generating: 'Generating…',
  unavailable: 'On-device model unavailable — using demo replies',
} as const

function ChatScrollFocus() {
  const chatFocusMessageId = useSessionStore((state) => state.chatFocusMessageId)
  const clearChatFocusMessage = useSessionStore((state) => state.clearChatFocusMessage)
  const { scrollToMessage } = useMessageScroller()

  useEffect(() => {
    if (!chatFocusMessageId) return

    const frame = requestAnimationFrame(() => {
      scrollToMessage(chatFocusMessageId, { align: 'start', behavior: 'smooth' })
      clearChatFocusMessage()
    })

    return () => cancelAnimationFrame(frame)
  }, [chatFocusMessageId, clearChatFocusMessage, scrollToMessage])

  return null
}

/** MessageScroller transcript with Scoper streaming assistant turns (BDA-051) */
export function ChatTranscript() {
  const chatMessages = useSessionStore((s) => s.chatMessages)
  const chatModelStatus = useSessionStore((s) => s.chatModelStatus)
  const chatGenerating = useSessionStore((s) => s.chatGenerating)
  const proposalGenerating = useSessionStore((s) => s.proposalGenerating)
  const contextPhase = useSessionStore((s) => s.contextPhase)

  const showActivityStrip = shouldShowAgentActivityStrip({
    chatGenerating,
    proposalGenerating,
    contextPhase,
  })

  const statusLabel =
    chatModelStatus === 'loading'
      ? MODEL_STATUS_COPY.loading
      : chatModelStatus === 'unavailable'
        ? MODEL_STATUS_COPY.unavailable
        : chatModelStatus === 'generating' && showActivityStrip
          ? null
          : MODEL_STATUS_COPY[chatModelStatus]

  const hasMessages = chatMessages.length > 0

  if (!hasMessages && !showActivityStrip) {
    return (
      <div className="text-muted-foreground m-auto max-w-xs px-2 text-center text-sm">
        Ask a question to start the agent conversation.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {statusLabel ? (
        <p className="text-muted-foreground shrink-0 px-1 text-xs">{statusLabel}</p>
      ) : null}

      <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
        <ChatScrollFocus />
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="justify-end gap-4 px-1">
              {chatMessages.map((item) => {
                const isUser = item.role === 'user'

                return (
                  <MessageScrollerItem
                    key={item.id}
                    messageId={item.id}
                    scrollAnchor={isUser}
                    className={cn(item.streaming && 'scroll-mt-4')}
                  >
                    <MessageGroup>
                      <Message align={isUser ? 'end' : 'start'}>
                        <MessageContent>
                          <div
                            className={
                              isUser
                                ? 'bg-muted text-foreground max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed'
                                : 'text-foreground w-full max-w-none space-y-1'
                            }
                          >
                            {isUser ? (
                              <p>{item.text}</p>
                            ) : (
                              <AssistantMessageBody message={item} />
                            )}
                          </div>
                        </MessageContent>
                      </Message>
                    </MessageGroup>
                  </MessageScrollerItem>
                )
              })}

              {showActivityStrip ? (
                <MessageScrollerItem
                  messageId="agent-activity-markers"
                  scrollAnchor
                  className="scroll-mt-2"
                >
                  <AgentActivityMarkers />
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}
