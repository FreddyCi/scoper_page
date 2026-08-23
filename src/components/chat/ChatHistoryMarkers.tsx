import { Fragment, useMemo, type ReactNode } from 'react'
import { FileStackIcon } from 'lucide-react'

import { ChatHistoryQueryRow } from '@/components/chat/ChatHistoryQueryRow'
import { AgentActivityMarkerRow } from '@/components/chat/AgentActivityMarkers'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { tailAgentActivityLog } from '@/lib/agent-activity'
import { groupChatQueryHistory } from '@/lib/chat-history'
import { listProposalVolumeHistory } from '@/lib/proposal-history'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

function HistorySectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-border h-px min-w-0 flex-1" />
      <span className="text-muted-foreground shrink-0 text-[11px] font-semibold tracking-wide uppercase">
        {children}
      </span>
      <div className="bg-border h-px min-w-0 flex-1" />
    </div>
  )
}

function HistoryGroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-muted-foreground text-xs font-medium leading-snug', className)}>{children}</p>
  )
}

function ProposalVolumeHistoryRow({
  title,
  statusLabel,
  sectionSubtitle,
  onSelect,
}: {
  title: string
  statusLabel: string
  sectionSubtitle?: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
        'border-border/70 bg-workspace-muted/50 hover:border-violet-300 hover:bg-violet-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
    >
      <FileStackIcon className="text-violet-600 mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-foreground text-xs leading-relaxed font-medium">{title}</p>
        <p className="text-muted-foreground text-[11px]">{statusLabel}</p>
        {sectionSubtitle ? (
          <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">{sectionSubtitle}</p>
        ) : null}
      </div>
    </button>
  )
}

/** History tab — agent activity, queries, proposal volumes (BDA-125) */
export function ChatHistoryMarkers() {
  const chatMessages = useSessionStore((state) => state.chatMessages)
  const chatThreads = useSessionStore((state) => state.chatThreads)
  const proposalRequirementsProfile = useSessionStore((state) => state.proposalRequirementsProfile)
  const agentActivityLog = useSessionStore((state) => state.agentActivityLog)
  const mode = useSessionStore((state) => state.mode)
  const focusChatMessage = useSessionStore((state) => state.focusChatMessage)
  const setWorkspaceView = useSessionStore((state) => state.setWorkspaceView)

  const chatGroups = useMemo(
    () => groupChatQueryHistory(chatMessages, chatThreads),
    [chatMessages, chatThreads],
  )

  const proposalVolumeEntries = useMemo(
    () => (mode === 'proposal' ? listProposalVolumeHistory(proposalRequirementsProfile) : []),
    [mode, proposalRequirementsProfile],
  )

  const activityEntries = useMemo(() => tailAgentActivityLog(agentActivityLog, 48), [agentActivityLog])

  if (
    chatGroups.length === 0 &&
    proposalVolumeEntries.length === 0 &&
    activityEntries.length === 0
  ) {
    return (
      <div className="text-muted-foreground m-auto max-w-xs px-2 text-center text-sm leading-relaxed">
        {mode === 'proposal'
          ? 'Build a proposal profile or run generation — agent activity will appear here.'
          : 'Ask the agent a question — your queries from this session will appear here.'}
      </div>
    )
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-2 px-0.5">
            {activityEntries.length > 0 ? (
              <>
                <MessageScrollerItem messageId="history-activity-intro" scrollAnchor={false}>
                  <HistorySectionHeading>Agent activity</HistorySectionHeading>
                </MessageScrollerItem>

                {activityEntries.map((entry) => (
                  <MessageScrollerItem
                    key={entry.id}
                    messageId={`activity-${entry.id}`}
                    scrollAnchor={false}
                  >
                    <AgentActivityMarkerRow entry={entry} />
                  </MessageScrollerItem>
                ))}
              </>
            ) : null}

            {chatGroups.length > 0 ? (
              <>
                <MessageScrollerItem messageId="history-chat-intro" scrollAnchor={false}>
                  <HistorySectionHeading>Agent queries</HistorySectionHeading>
                </MessageScrollerItem>

                {chatGroups.map((group, groupIndex) => (
                  <Fragment key={group.id}>
                    <MessageScrollerItem messageId={group.id} scrollAnchor={false}>
                      <HistoryGroupLabel className={cn(groupIndex > 0 && 'pt-2')}>
                        {group.label}
                      </HistoryGroupLabel>
                    </MessageScrollerItem>

                    {group.entries.map((entry) => (
                      <MessageScrollerItem
                        key={entry.id}
                        messageId={entry.id}
                        scrollAnchor={entry.scrollAnchor}
                      >
                        <ChatHistoryQueryRow
                          label={entry.label}
                          onSelect={() => focusChatMessage(entry.messageId, entry.threadId)}
                        />
                      </MessageScrollerItem>
                    ))}
                  </Fragment>
                ))}
              </>
            ) : null}

            {proposalVolumeEntries.length > 0 ? (
              <>
                <MessageScrollerItem messageId="history-proposal-intro" scrollAnchor={false}>
                  <HistorySectionHeading>Proposal volumes</HistorySectionHeading>
                </MessageScrollerItem>

                {proposalVolumeEntries.map((entry) => (
                  <MessageScrollerItem
                    key={entry.id}
                    messageId={entry.id}
                    scrollAnchor={entry.scrollAnchor && chatGroups.length === 0}
                  >
                    <ProposalVolumeHistoryRow
                      title={entry.title}
                      statusLabel={entry.statusLabel}
                      sectionSubtitle={entry.sectionSubtitle}
                      onSelect={() => setWorkspaceView('profiles')}
                    />
                  </MessageScrollerItem>
                ))}
              </>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
