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
} from '@/components/ui/message-scroller'
import { SCOPER_BONSAI_17B } from '@/lib/scoper-model'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

const MODEL_STATUS_COPY = {
  idle: null,
  loading: `Loading ${SCOPER_BONSAI_17B.label}…`,
  ready: null,
  generating: 'Generating…',
  unavailable: 'On-device model unavailable — using demo replies',
} as const

/** MessageScroller transcript with Scoper streaming assistant turns (BDA-051) */
export function ChatTranscript() {
  const chatMessages = useSessionStore((s) => s.chatMessages)
  const chatModelStatus = useSessionStore((s) => s.chatModelStatus)
  const statusLabel = MODEL_STATUS_COPY[chatModelStatus]

  if (chatMessages.length === 0) {
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
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-4 px-1">
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
                              item.text
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
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}
