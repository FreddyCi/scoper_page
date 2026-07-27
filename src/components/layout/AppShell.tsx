import type { ReactNode } from 'react'

import { ChatSidebar } from '@/components/chat/ChatSidebar'

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
      <div className="shadow-panel flex h-[calc(100vh-var(--spacing-shell)*2)] overflow-hidden rounded-panel">
        {/* Workspace ~65% */}
        <section className="bg-workspace flex min-w-0 flex-[1.85] flex-col">
          <header className="border-border flex items-center gap-3 border-b px-[var(--spacing-panel)] py-3">
            <span className="rounded-pill border-border bg-surface text-foreground inline-flex items-center gap-2 border px-3 py-1 text-sm font-medium">
              Untitled session
            </span>
            <span className="text-subtle-foreground text-xs">Saving</span>
          </header>
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

        {/* Agent sidebar ~35% */}
        <aside className="bg-surface border-border flex min-w-0 flex-1 flex-col border-l">
          <header className="border-border flex items-center justify-end border-b px-4 py-3">
            <span className="text-subtle-foreground text-lg leading-none">×</span>
          </header>
          <ChatSidebar />
        </aside>
      </div>
    </div>
  )
}
