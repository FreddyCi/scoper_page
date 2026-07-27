import type { ReactNode } from 'react'

import { MessageScrollerDemo } from '@/components/chat/MessageScrollerDemo'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSessionStore } from '@/store/session-store'

type ChatSidebarProps = {
  /** Rendered inside the shared header row (AppShell grid) */
  variant?: 'body' | 'header'
}

export function ChatSidebar({ variant = 'body' }: ChatSidebarProps) {
  const toggleChatCollapsed = useSessionStore((s) => s.toggleChatCollapsed)

  if (variant === 'header') {
    return (
      <>
        <TabsList variant="line" className="h-auto bg-transparent p-0">
          <TabsTrigger value="agent">Agent</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <button
          type="button"
          className="text-subtle-foreground hover:text-foreground text-lg leading-none transition-colors"
          aria-label="Close chat sidebar"
          onClick={toggleChatCollapsed}
        >
          ×
        </button>
      </>
    )
  }

  return (
    <>
      <TabsContent value="agent" className="flex min-h-0 flex-1 flex-col px-[var(--spacing-panel)] py-3">
        <MessageScrollerDemo />
      </TabsContent>

      <TabsContent value="history" className="text-muted-foreground px-[var(--spacing-panel)] py-3 text-sm">
        History tab — scope creep markers land in BDA-073.
      </TabsContent>

      <footer className="border-border mt-auto shrink-0 border-t p-[var(--spacing-panel)]">
        <div className="rounded-control border-border bg-workspace-muted text-subtle-foreground border px-3 py-2 text-sm">
          Ask the agent… @ to mention
        </div>
      </footer>
    </>
  )
}

export function ChatSidebarTabs({ children }: { children: ReactNode }) {
  return (
    <Tabs defaultValue="agent" className="contents">
      {children}
    </Tabs>
  )
}
