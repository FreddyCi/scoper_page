import { useState } from 'react'

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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const INITIAL_MESSAGES = [
  {
    id: '1',
    role: 'user' as const,
    text: 'Analyse this RFP for qualification criteria.',
  },
  {
    id: '2',
    role: 'assistant' as const,
    text: 'I found 12 evaluation criteria across sections 3.1–3.4. Three look like hard pass/fail requirements.',
  },
  {
    id: '3',
    role: 'user' as const,
    text: 'Where does it mention CMMI Level 3?',
  },
  {
    id: '4',
    role: 'assistant' as const,
    text: 'Section 4.2.1 requires CMMI Level 3 or equivalent within 90 days of award.',
  },
]

type DemoMessage = (typeof INITIAL_MESSAGES)[number]

/**
 * Isolated MessageScroller demo — verifies provider, autoScroll, and jump button.
 * Used in ChatSidebar during BDA-003; replaced by real chat in BDA-051.
 */
export function MessageScrollerDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>(INITIAL_MESSAGES)
  const [autoScroll, setAutoScroll] = useState(true)

  function appendMessage() {
    setMessages((current) => [
      ...current,
      {
        id: String(current.length + 1),
        role: current.length % 2 === 0 ? 'assistant' : 'user',
        text: `Streamed token chunk ${current.length + 1} — autoScroll ${autoScroll ? 'on' : 'off'}.`,
      },
    ])
  }

  return (
    <MessageScrollerProvider autoScroll={autoScroll} defaultScrollPosition="last-anchor">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Badge variant={autoScroll ? 'default' : 'outline'}>
            autoScroll: {autoScroll ? 'on' : 'off'}
          </Badge>
          <Button size="xs" variant="outline" onClick={() => setAutoScroll((v) => !v)}>
            Toggle autoScroll
          </Button>
          <Button size="xs" variant="secondary" onClick={appendMessage}>
            Add message
          </Button>
        </div>

        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent>
              {messages.map((item, index) => (
                <MessageScrollerItem
                  key={item.id}
                  scrollAnchor={item.role === 'user'}
                >
                  <MessageGroup>
                    <Message align={item.role === 'user' ? 'end' : 'start'}>
                      <MessageContent>
                        <div
                          className={
                            item.role === 'user'
                              ? 'bg-primary text-primary-foreground max-w-[85%] rounded-2xl px-3 py-2'
                              : 'bg-muted text-foreground max-w-[85%] rounded-2xl px-3 py-2'
                          }
                        >
                          {item.text}
                        </div>
                      </MessageContent>
                    </Message>
                  </MessageGroup>
                  {index === messages.length - 1 && item.role === 'assistant' ? (
                    <span className="text-subtle-foreground px-1 text-xs">Latest</span>
                  ) : null}
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" />
        </MessageScroller>
      </div>
    </MessageScrollerProvider>
  )
}
