import type { ReactNode } from 'react'

import { ChatSidebar, ChatSidebarTabs } from '@/components/chat/ChatSidebar'
import {
  shellChatColumnClasses,
  shellChatColumnTransitionClass,
  shellPanelMinWidthClass,
  shellWorkspaceColumnClass,
} from '@/components/layout/shell-layout'
import { ScoutProvider } from '@/components/scout/ScoutProvider'
import { ShareWorkspaceSheet } from '@/components/layout/ShareWorkspaceSheet'
import { ProposalSetupFooterChecklist } from '@/components/layout/ProposalSetupFooterChecklist'
import { WebGpuBanner } from '@/components/layout/WebGpuBanner'
import { UploadFab } from '@/components/layout/UploadFab'
import { UploadQueueProvider } from '@/components/layout/UploadQueueProvider'
import {
  WorkspaceDocumentTabsRow,
  WorkspaceHeaderTopRow,
} from '@/components/layout/WorkspaceHeader'
import { WorkspaceContent } from '@/components/workspace/WorkspaceContent'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
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
  const resetSession = useSessionStore((s) => s.resetSession)
  const hasSessionContent = useSessionStore(
    (s) => s.documents.length > 0 || s.chatMessages.length > 0,
  )

  const chatColumnClass = cn(
    shellChatColumnTransitionClass,
    shellChatColumnClasses(chatCollapsed),
  )

  return (
    <TooltipProvider delay={250}>
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
                  <ScoutProvider>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-14">
                      {children ?? <WorkspaceContent />}
                    </div>

                    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-transparent px-[var(--spacing-panel)] pt-1 pb-3 text-xs text-subtle-foreground">
                      <div className="pointer-events-auto justify-self-start">
                        <UploadFab />
                      </div>
                      <div className="pointer-events-auto justify-self-center">
                        <ProposalSetupFooterChecklist />
                      </div>
                      <div className="pointer-events-auto flex justify-self-end items-center gap-1">
                        <ShareWorkspaceSheet />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!hasSessionContent}
                          className="text-subtle-foreground hover:text-foreground pointer-events-auto h-7 px-2 text-xs font-normal"
                          onClick={() => resetSession()}
                        >
                          Clear workspace
                        </Button>
                      </div>
                    </footer>
                  </ScoutProvider>
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
    </TooltipProvider>
  )
}
