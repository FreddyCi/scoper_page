import { GitCompareArrowsIcon } from 'lucide-react'
import { useMemo } from 'react'

import { CreepProfileCard } from '@/components/workspace/CreepProfileCard'
import { buildMockCreepProfiles } from '@/lib/creep-profile-stub'
import type { CitationRef, DocumentMeta, ScopeCreepProfile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'

type CreepProfileGridProps = {
  profiles: ScopeCreepProfile[]
  documents?: DocumentMeta[]
  onFlagClick?: (citation: CitationRef) => void
  className?: string
}

export function CreepProfileGrid({
  profiles,
  documents = [],
  onFlagClick,
  className,
}: CreepProfileGridProps) {
  const displayProfiles = useMemo(() => {
    if (profiles.length > 0) return profiles
    if (import.meta.env.DEV) {
      return buildMockCreepProfiles(documents)
    }
    return []
  }, [profiles, documents])

  if (displayProfiles.length === 0) {
    return (
      <div className="text-muted-foreground flex min-h-[16rem] flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 text-center text-sm">
        Tag a baseline and change document, then run scope analysis to populate creep profile
        cards.
      </div>
    )
  }

  function handleFlagClick(citation: CitationRef) {
    if (onFlagClick) {
      onFlagClick(citation)
      return
    }
    focusCitation(citation)
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompareArrowsIcon className="text-muted-foreground size-4" />
          <h2 className="text-foreground text-sm font-semibold">Scope creep profiles</h2>
          <span className="bg-muted text-muted-foreground rounded-pill px-2 py-0.5 text-xs font-medium tabular-nums">
            {displayProfiles.length}
          </span>
        </div>
        <p className="text-subtle-foreground hidden text-xs sm:block">
          Click a flag to open split view with evidence highlight
        </p>
      </header>

      <div className="scrollbar-none min-h-0 flex-1 overflow-x-auto pb-2 lg:overflow-x-visible lg:overflow-y-auto">
        <div
          className={cn(
            'flex w-max min-w-full gap-4',
            'lg:grid lg:w-full lg:grid-cols-2 lg:auto-rows-min',
            'xl:grid-cols-3',
          )}
        >
          {displayProfiles.map((profile) => (
            <CreepProfileCard
              key={profile.profile_id}
              profile={profile}
              documents={documents}
              onFlagClick={handleFlagClick}
              className="w-[19rem] shrink-0 lg:w-auto"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
