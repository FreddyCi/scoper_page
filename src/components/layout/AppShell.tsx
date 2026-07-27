import type { ReactNode } from 'react'

import { ChatSidebar, ChatSidebarTabs } from '@/components/chat/ChatSidebar'
import { Button } from '@/components/ui/button'
import { useSessionStore } from '@/store/session-store'
import type { WorkspaceMode } from '@/lib/types'

type AppShellProps = {
  children?: ReactNode
}

const MODE_LABELS: Record<WorkspaceMode, string> = {
  rfp: 'RFP Analysis',
  scope_creep: 'Scope Creep',
}

/**
 * Shell preview — full two-column layout lands in BDA-010.
 * Session store wired for name, mode, and chat collapse (BDA-005).
 */
export function AppShell({ children }: AppShellProps) {
  const sessionName = useSessionStore((s) => s.sessionName)
  const mode = useSessionStore((s) => s.mode)
  const chatCollapsed = useSessionStore((s) => s.chatCollapsed)
  const setMode = useSessionStore((s) => s.setMode)
  const toggleChatCollapsed = useSessionStore((s) => s.toggleChatCollapsed)

  const headerCols = chatCollapsed ? 'grid-cols-1' : 'grid-cols-[1.85fr_1fr]'
  const bodyCols = chatCollapsed ? 'grid-cols-1' : 'grid-cols-[1.85fr_1fr]'

  return (
    <div className="bg-canvas min-h-screen p-[var(--spacing-shell)]">
      <ChatSidebarTabs>
        <div className="shadow-panel flex h-[calc(100vh-var(--spacing-shell)*2)] flex-col overflow-hidden rounded-panel">
          <div className={`border-border grid shrink-0 border-b ${headerCols}`}>
            <header className="bg-workspace border-border flex items-center gap-3 px-[var(--spacing-panel)] py-3">
              <span className="rounded-pill border-border bg-surface text-foreground inline-flex items-center gap-2 border px-3 py-1 text-sm font-medium">
                {sessionName}
              </span>
              <span className="text-subtle-foreground text-xs">Saving</span>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="xs"
                  variant={mode === 'rfp' ? 'default' : 'outline'}
                  onClick={() => setMode('rfp')}
                >
                  RFP
                </Button>
                <Button
                  size="xs"
                  variant={mode === 'scope_creep' ? 'default' : 'outline'}
                  onClick={() => setMode('scope_creep')}
                >
                  Creep
                </Button>
                {chatCollapsed ? (
                  <Button size="xs" variant="secondary" onClick={toggleChatCollapsed}>
                    Open chat
                  </Button>
                ) : null}
              </div>
            </header>

            {!chatCollapsed ? (
              <header className="bg-surface border-border flex items-center justify-between gap-3 border-l px-[var(--spacing-panel)] py-3">
                <ChatSidebar variant="header" />
              </header>
            ) : null}
          </div>

          <div className={`grid min-h-0 flex-1 ${bodyCols}`}>
            <section
              className={`bg-workspace flex min-w-0 flex-col ${chatCollapsed ? '' : 'border-border border-r'}`}
            >
              <div className="flex flex-1 flex-col items-center justify-center px-[var(--spacing-panel)]">
                <h1 className="text-foreground text-xl font-semibold">Browser Doc Agent Demo</h1>
                <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
                  Mode: {MODE_LABELS[mode]}
                  {chatCollapsed ? ' · Chat collapsed' : ''} — workspace views land in BDA-010.
                </p>
                {children}
              </div>
              <footer className="text-subtle-foreground px-[var(--spacing-panel)] py-3 text-xs">
                Workspace
              </footer>
            </section>

            {!chatCollapsed ? (
              <aside className="bg-surface flex min-w-0 flex-col">
                <ChatSidebar variant="body" />
              </aside>
            ) : null}
          </div>
        </div>
      </ChatSidebarTabs>
    </div>
  )
}
