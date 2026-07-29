import type { ReactNode } from 'react'

import {
  HistoryIcon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react'

import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatHistoryMarkers } from '@/components/chat/ChatHistoryMarkers'
import { ChatTranscript } from '@/components/chat/ChatTranscript'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type ChatSidebarProps = {
  /** Rendered inside the shared header row (AppShell) */
  variant?: 'body' | 'header'
  className?: string
}

const chatTabTriggerClass = 'gap-1.5 sm:px-3'

function ChatSidebarHeaderControls() {
  const toggleChatCollapsed = useSessionStore((s) => s.toggleChatCollapsed)
  const clearChat = useSessionStore((s) => s.clearChat)
  const startNewChat = useSessionStore((s) => s.startNewChat)
  const chatGenerating = useSessionStore((s) => s.chatGenerating)

  return (
    <>
      <TabsList variant="segmented">
        <TabsTrigger value="agent" className={chatTabTriggerClass}>
          <SparklesIcon className="size-3.5" />
          Agent
        </TabsTrigger>
        <TabsTrigger value="history" className={chatTabTriggerClass}>
          <HistoryIcon className="size-3.5" />
          History
        </TabsTrigger>
      </TabsList>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="New chat"
          disabled={chatGenerating}
          onClick={() => startNewChat()}
        >
          <PlusIcon className="size-3.5" />
        </Button>
        <Button type="button" size="icon-xs" variant="ghost" aria-label="Refresh chat" onClick={clearChat}>
          <RotateCcwIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Close chat sidebar"
          onClick={toggleChatCollapsed}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </>
  )
}

export function ChatSidebar({ variant = 'body', className }: ChatSidebarProps) {
  if (variant === 'header') {
    return (
      <div
        className={cn(
          'flex w-full min-w-[17.5rem] items-center gap-2 px-[var(--spacing-panel)]',
          className,
        )}
      >
        <ChatSidebarHeaderControls />
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <TabsContent
        value="agent"
        className="mt-0 flex min-h-0 flex-1 flex-col px-[var(--spacing-panel)] pt-3 pb-3"
      >
        <ChatTranscript />
      </TabsContent>

      <TabsContent
        value="history"
        className="mt-0 flex min-h-0 flex-1 flex-col px-[var(--spacing-panel)] py-3"
      >
        <ChatHistoryMarkers />
      </TabsContent>

      <footer className="shrink-0 px-[var(--spacing-panel)] pb-3 pt-0.5">
        <ChatComposer />
      </footer>
    </div>
  )
}

export function ChatSidebarTabs({ children }: { children: ReactNode }) {
  const chatSidebarTab = useSessionStore((state) => state.chatSidebarTab)
  const setChatSidebarTab = useSessionStore((state) => state.setChatSidebarTab)

  return (
    <Tabs
      value={chatSidebarTab}
      onValueChange={(value) => setChatSidebarTab(value as 'agent' | 'history')}
      className="contents"
    >
      {children}
    </Tabs>
  )
}
