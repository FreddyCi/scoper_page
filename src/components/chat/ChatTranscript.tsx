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

const SAMPLE_MESSAGES = [
  {
    id: 'sample-1',
    role: 'user' as const,
    text: 'Analyse this RFP for qualification criteria and flag any risky clauses.',
  },
  {
    id: 'sample-2',
    role: 'assistant' as const,
    text: 'I found 12 evaluation criteria across sections 3.1–3.4. Three look like hard pass/fail requirements.',
  },
]

/** MessageScroller transcript region — replaced by bitgpu chat in BDA-051 */
export function ChatTranscript() {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-4 px-1">
            {SAMPLE_MESSAGES.map((item) => (
              <MessageScrollerItem
                key={item.id}
                messageId={item.id}
                scrollAnchor={item.role === 'user'}
              >
                <MessageGroup>
                  <Message align={item.role === 'user' ? 'end' : 'start'}>
                    <MessageContent>
                      <div
                        className={
                          item.role === 'user'
                            ? 'bg-muted text-foreground max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed'
                            : 'text-foreground max-w-[92%] text-sm leading-relaxed'
                        }
                      >
                        {item.text}
                      </div>
                    </MessageContent>
                  </Message>
                </MessageGroup>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
