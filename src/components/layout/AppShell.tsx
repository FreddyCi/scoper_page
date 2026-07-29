import type { ReactNode } from 'react'

import { ChatSidebar, ChatSidebarTabs } from '@/components/chat/ChatSidebar'
import {
  shellChatColumnClasses,
  shellChatColumnTransitionClass,
  shellPanelMinWidthClass,
  shellWorkspaceColumnClass,
} from '@/components/layout/shell-layout'
import { WebGpuBanner } from '@/components/layout/WebGpuBanner'
import { UploadFab } from '@/components/layout/UploadFab'
import { UploadQueueProvider } from '@/components/layout/UploadQueueProvider'
import {
  WorkspaceDocumentTabsRow,
  WorkspaceHeaderTopRow,
} from '@/components/layout/WorkspaceHeader'
import { WorkspaceContent } from '@/components/workspace/WorkspaceContent'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type AppShellProps = {
  children?: ReactNode
}

/**
 * Two-column app shell — workspace ~65%, agent chat ~35% per docs/main.png.
 * Chat column animates closed; preference persisted in sessionStorage (BDA-011).
 */
export function AppShell({ children }: AppShellProps) {
  const chatCollapsed = useSessionStore((s) => s.chatCollapsed)

  const chatColumnClass = cn(
    shellChatColumnTransitionClass,
    shellChatColumnClasses(chatCollapsed),
  )

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
            <div className="relative shrink-0">
              <WebGpuBanner />
              <div className="border-border flex border-b">
                <WorkspaceHeaderTopRow chatCollapsed={chatCollapsed} />

                <header
                  className={cn(
                    'bg-surface flex items-stretch',
                    chatColumnClass,
                  )}
                  aria-hidden={chatCollapsed}
                >
                  <ChatSidebar variant="header" />
                </header>
              </div>

              <WorkspaceDocumentTabsRow
                chatCollapsed={chatCollapsed}
                chatColumnClass={chatColumnClass}
              />
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <section
                className={cn(
                  'bg-workspace relative flex min-h-0 flex-col transition-[border-color] duration-300',
                  shellWorkspaceColumnClass,
                  !chatCollapsed && 'border-border border-r',
                )}
              >
                <UploadQueueProvider>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {children ?? <WorkspaceContent />}
                  </div>

                  <footer className="text-subtle-foreground relative flex shrink-0 items-center justify-between px-[var(--spacing-panel)] pt-0 pb-3 text-xs">
                    <UploadFab />
                    <span>Workspace</span>
                  </footer>
                </UploadQueueProvider>
              </section>

              <aside
                className={cn('bg-surface flex min-h-0 flex-col', chatColumnClass)}
                aria-hidden={chatCollapsed}
              >
                <ChatSidebar variant="body" />
              </aside>
            </div>
          </div>
        </ChatSidebarTabs>
      </div>
    </div>
  )
}
