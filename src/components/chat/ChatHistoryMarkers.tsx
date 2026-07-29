import { Fragment, useMemo, type ReactNode } from 'react'

import { CreepFlagRow } from '@/components/workspace/CreepFlagRow'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
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

/** History tab — scope creep flags grouped like workspace CreepFlagRow cards (BDA-073) */
export function ChatHistoryMarkers() {
  const creepProfiles = useSessionStore((state) => state.creepProfiles)
  const documents = useSessionStore((state) => state.documents)
  const mode = useSessionStore((state) => state.mode)

  const profiles = useMemo((): ScopeCreepProfile[] => {
    if (creepProfiles.length > 0) return creepProfiles
    if (import.meta.env.DEV && mode === 'scope_creep') {
      return buildMockCreepProfiles(documents)
    }
    return []
  }, [creepProfiles, documents, mode])

  const groups = useMemo(
    () => groupCreepHistory(profiles, documents),
    [profiles, documents],
  )

  if (groups.length === 0) {
    return (
      <div className="text-muted-foreground m-auto max-w-xs px-2 text-center text-sm leading-relaxed">
        {mode === 'scope_creep'
          ? 'Tag baseline and change documents, then run scope analysis. Flags will appear here as markers.'
          : 'Switch to Scope Creep mode and analyze documents to populate history markers.'}
      </div>
    )
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-2 px-0.5">
            <MessageScrollerItem messageId="history-intro" scrollAnchor={false}>
              <HistorySectionHeading>Scope analysis</HistorySectionHeading>
            </MessageScrollerItem>

            {groups.map((group, groupIndex) => (
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
                    scrollAnchor={entry.scrollAnchor}
                  >
                    <CreepFlagRow flag={entry.flag} />
                  </MessageScrollerItem>
                ))}
              </Fragment>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
