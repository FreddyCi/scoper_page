import type { ReactNode } from 'react'

import { ChatSidebar, ChatSidebarTabs } from '@/components/chat/ChatSidebar'

type AppShellProps = {
  children?: ReactNode
}

/**
 * Shell preview — full two-column layout lands in BDA-010.
 * Tokens match docs/main.png: gray canvas, workspace tint, white chat panel.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="bg-canvas min-h-screen p-[var(--spacing-shell)]">
      <ChatSidebarTabs>
        <div className="shadow-panel flex h-[calc(100vh-var(--spacing-shell)*2)] flex-col overflow-hidden rounded-panel">
          {/* Shared header row — single border-b spans both columns */}
          <div className="border-border grid shrink-0 grid-cols-[1.85fr_1fr] border-b">
            <header className="bg-workspace border-border flex items-center gap-3 border-r px-[var(--spacing-panel)] py-3">
              <span className="rounded-pill border-border bg-surface text-foreground inline-flex items-center gap-2 border px-3 py-1 text-sm font-medium">
                Untitled session
              </span>
              <span className="text-subtle-foreground text-xs">Saving</span>
            </header>

            <header className="bg-surface flex items-center justify-between gap-3 px-[var(--spacing-panel)] py-3">
              <ChatSidebar variant="header" />
            </header>
          </div>

          {/* Body row */}
          <div className="grid min-h-0 flex-1 grid-cols-[1.85fr_1fr]">
            <section className="bg-workspace border-border flex min-w-0 flex-col border-r">
              <div className="flex flex-1 flex-col items-center justify-center px-[var(--spacing-panel)]">
                <h1 className="text-foreground text-xl font-semibold">Browser Doc Agent Demo</h1>
                <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
                  shadcn MessageScroller wired in chat sidebar — shell polish lands in BDA-010.
                </p>
                {children}
              </div>
              <footer className="text-subtle-foreground px-[var(--spacing-panel)] py-3 text-xs">
                Workspace
              </footer>
            </section>

            <aside className="bg-surface flex min-w-0 flex-col">
              <ChatSidebar variant="body" />
            </aside>
          </div>
        </div>
      </ChatSidebarTabs>
    </div>
  )
}
