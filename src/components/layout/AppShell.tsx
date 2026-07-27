import type { ReactNode } from 'react'

import { ChatSidebar, ChatSidebarTabs } from '@/components/chat/ChatSidebar'
import {
  shellChatColumnClass,
  shellPanelMinWidthClass,
  shellWorkspaceColumnClass,
} from '@/components/layout/shell-layout'
import { UploadFab } from '@/components/layout/UploadFab'
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { WorkspaceContent } from '@/components/workspace/WorkspaceContent'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type AppShellProps = {
  children?: ReactNode
}

/**
 * Two-column app shell — workspace ~65%, agent chat ~35% per docs/main.png.
 * Workspace expands to full width when chat is collapsed (BDA-005 store).
 */
export function AppShell({ children }: AppShellProps) {
  const chatCollapsed = useSessionStore((s) => s.chatCollapsed)

  return (
    <div className="bg-canvas min-h-svh p-[var(--spacing-shell)]">
      <div className="shell-scroll-x mx-auto w-full max-w-[100rem]">
        <ChatSidebarTabs>
          <div
            className={cn(
              'shadow-panel flex h-[calc(100svh-var(--spacing-shell)*2)] flex-col overflow-hidden rounded-panel',
              shellPanelMinWidthClass,
            )}
          >
            {/* Shared header row — single border-b, aligned columns */}
            <div className="border-border flex shrink-0 border-b">
              <WorkspaceHeader chatCollapsed={chatCollapsed} />

              {!chatCollapsed ? (
                <header
                  className={cn(
                    'bg-surface flex items-center justify-between gap-3 px-[var(--spacing-panel)] py-3',
                    shellChatColumnClass,
                  )}
                >
                  <ChatSidebar variant="header" />
                </header>
              ) : null}
            </div>

            {/* Body — flex row; chat fixed ~35% width */}
            <div className="flex min-h-0 flex-1">
              <section
                className={cn(
                  'bg-workspace relative flex min-h-0 flex-col',
                  shellWorkspaceColumnClass,
                  !chatCollapsed && 'border-border border-r',
                )}
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {children ?? <WorkspaceContent />}
                </div>

                <footer className="text-subtle-foreground shrink-0 px-[var(--spacing-panel)] py-3 text-xs">
                  Workspace
                </footer>

                <div className="absolute bottom-[calc(var(--spacing-panel)+1.75rem)] left-[var(--spacing-panel)] z-10">
                  <UploadFab />
                </div>
              </section>

              {!chatCollapsed ? (
                <aside className={cn('bg-surface flex min-h-0 flex-col', shellChatColumnClass)}>
                  <ChatSidebar variant="body" />
                </aside>
              ) : null}
            </div>
          </div>
        </ChatSidebarTabs>
      </div>
    </div>
  )
}
