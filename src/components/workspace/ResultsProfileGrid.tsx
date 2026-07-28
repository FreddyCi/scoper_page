import { ClipboardCheckIcon } from 'lucide-react'

import { ResultsProfileCard } from '@/components/workspace/ResultsProfileCard'
import type { CitationRef, RfpResultsProfile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'

type ResultsProfileGridProps = {
  profiles: RfpResultsProfile[]
  onCriterionClick?: (citation: CitationRef) => void
  className?: string
}

export function ResultsProfileGrid({
  profiles,
  onCriterionClick,
  className,
}: ResultsProfileGridProps) {
  if (profiles.length === 0) {
    return (
      <div className="text-muted-foreground flex min-h-[16rem] flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 text-center text-sm">
        No results profiles yet. Upload documents and run analysis to populate qualification cards.
      </div>
    )
  }

  function handleCriterionClick(citation: CitationRef) {
    if (onCriterionClick) {
      onCriterionClick(citation)
      return
    }
    focusCitation(citation)
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheckIcon className="text-muted-foreground size-4" />
          <h2 className="text-foreground text-sm font-semibold">Qualification profiles</h2>
          <span className="bg-muted text-muted-foreground rounded-pill px-2 py-0.5 text-xs font-medium tabular-nums">
            {profiles.length}
          </span>
        </div>
        <p className="text-subtle-foreground hidden text-xs sm:block">
          Click a criterion to open split view with source highlight
        </p>
      </header>

      {/* Narrow: horizontal scroll · lg+: 2-col grid · xl+: 3-col grid */}
      <div className="scrollbar-none min-h-0 flex-1 overflow-x-auto pb-2 lg:overflow-x-visible lg:overflow-y-auto">
        <div
          className={cn(
            'flex w-max min-w-full gap-4',
            'lg:grid lg:w-full lg:grid-cols-2 lg:auto-rows-min',
            'xl:grid-cols-3',
          )}
        >
          {profiles.map((profile) => (
            <ResultsProfileCard
              key={profile.profile_id}
              profile={profile}
              onCriterionClick={handleCriterionClick}
              className="w-[19rem] shrink-0 lg:w-auto"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
