import { AlertTriangleIcon, FlagIcon, InfoIcon } from 'lucide-react'
import { useMemo } from 'react'

import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { flattenCreepHistory, type CreepHistoryEntry } from '@/lib/creep-history'
import { buildMockCreepProfiles } from '@/lib/creep-profile-stub'
import type { ScopeCreepProfile, ScopeCreepSeverity } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import { useSessionStore } from '@/store/session-store'

function severityIcon(severity: ScopeCreepSeverity) {
  switch (severity) {
    case 'high':
      return AlertTriangleIcon
    case 'medium':
      return FlagIcon
    default:
      return InfoIcon
  }
}

function CreepFlagMarker({ entry }: { entry: Extract<CreepHistoryEntry, { kind: 'flag' }> }) {
  const Icon = severityIcon(entry.severity)

  return (
    <Marker
      variant="border"
      render={
        <button
          type="button"
          className="hover:text-foreground w-full rounded-md px-1 py-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => focusCitation(entry.citation)}
        />
      }
    >
      <MarkerIcon>
        <Icon className="text-muted-foreground" />
      </MarkerIcon>
      <MarkerContent>
        <span className="text-foreground block text-sm leading-snug">{entry.label}</span>
        <span className="text-muted-foreground mt-0.5 block text-xs capitalize">
          {entry.sublabel}
        </span>
      </MarkerContent>
    </Marker>
  )
}

/** History tab — scope creep flags as MessageScroller markers (BDA-073) */
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

  const entries = useMemo(
    () => flattenCreepHistory(profiles, documents),
    [profiles, documents],
  )

  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground m-auto max-w-xs px-2 text-center text-sm">
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
          <MessageScrollerContent className="gap-3 px-1">
            <MessageScrollerItem messageId="history-intro" scrollAnchor={false}>
              <Marker variant="separator">
                <MarkerContent>Scope analysis</MarkerContent>
              </Marker>
            </MessageScrollerItem>

            {entries.map((entry) => (
              <MessageScrollerItem
                key={entry.id}
                messageId={entry.id}
                scrollAnchor={entry.scrollAnchor}
                className={cn(entry.kind === 'separator' && 'pt-1')}
              >
                {entry.kind === 'separator' ? (
                  <Marker variant="separator">
                    <MarkerContent>{entry.label}</MarkerContent>
                  </Marker>
                ) : (
                  <CreepFlagMarker entry={entry} />
                )}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
