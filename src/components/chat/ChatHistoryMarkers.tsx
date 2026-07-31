import { Fragment, useMemo, type ReactNode } from 'react'

import { ChatHistoryQueryRow } from '@/components/chat/ChatHistoryQueryRow'
import { CreepFlagRow, DEFAULT_SUMMARY_MAX_CHARS } from '@/components/workspace/CreepFlagRow'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { groupChatQueryHistory } from '@/lib/chat-history'
import { groupCreepHistory } from '@/lib/creep-history'
import { buildMockCreepProfiles } from '@/lib/creep-profile-stub'
import type { ScopeCreepProfile } from '@/lib/types'
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

/** History tab — agent queries plus scope creep flags (BDA-073) */
export function ChatHistoryMarkers() {
  const chatMessages = useSessionStore((state) => state.chatMessages)
  const chatThreads = useSessionStore((state) => state.chatThreads)
  const creepProfiles = useSessionStore((state) => state.creepProfiles)
  const documents = useSessionStore((state) => state.documents)
  const mode = useSessionStore((state) => state.mode)
  const focusChatMessage = useSessionStore((state) => state.focusChatMessage)

  const chatGroups = useMemo(
    () => groupChatQueryHistory(chatMessages, chatThreads),
    [chatMessages, chatThreads],
  )

  const creepProfilesForHistory = useMemo((): ScopeCreepProfile[] => {
    if (mode !== 'proposal') return []
    if (creepProfiles.length > 0) return creepProfiles
    if (import.meta.env.DEV) {
      return buildMockCreepProfiles(documents)
    }
    return []
  }, [creepProfiles, documents, mode])

  const creepGroups = useMemo(
    () => groupCreepHistory(creepProfilesForHistory, documents),
    [creepProfilesForHistory, documents],
  )

  if (chatGroups.length === 0 && creepGroups.length === 0) {
    return (
      <div className="text-muted-foreground m-auto max-w-xs px-2 text-center text-sm leading-relaxed">
        {mode === 'proposal'
          ? 'Build a proposal profile or ask the agent — activity will appear here.'
          : 'Ask the agent a question — your queries from this session will appear here.'}
      </div>
    )
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-2 px-0.5">
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

            {creepGroups.length > 0 ? (
              <>
                <MessageScrollerItem messageId="history-creep-intro" scrollAnchor={false}>
                  <HistorySectionHeading>Scope analysis</HistorySectionHeading>
                </MessageScrollerItem>

                {creepGroups.map((group, groupIndex) => (
                  <Fragment key={group.id}>
                    <MessageScrollerItem messageId={group.id} scrollAnchor={false}>
                      <HistoryGroupLabel className={cn(groupIndex > 0 && 'pt-2')}>
                        {group.label}
                      </HistoryGroupLabel>
                    </MessageScrollerItem>

                    {group.flags.map((entry) => (
                      <MessageScrollerItem
                        key={entry.id}
                        messageId={entry.id}
                        scrollAnchor={entry.scrollAnchor && chatGroups.length === 0}
                      >
                        <CreepFlagRow
                          flag={entry.flag}
                          summaryMaxChars={DEFAULT_SUMMARY_MAX_CHARS}
                          summaryClassName="text-xs leading-relaxed"
                        />
                      </MessageScrollerItem>
                    ))}
                  </Fragment>
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
