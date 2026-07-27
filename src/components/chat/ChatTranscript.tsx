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
import { useSessionStore } from '@/store/session-store'

/** MessageScroller transcript region — replaced by bitgpu chat in BDA-051 */
export function ChatTranscript() {
  const chatMessages = useSessionStore((s) => s.chatMessages)

  if (chatMessages.length === 0) {
    return (
      <div className="text-muted-foreground m-auto max-w-xs px-2 text-center text-sm">
        Ask a question to start the agent conversation.
      </div>
    )
  }

  return (
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
  )
}
