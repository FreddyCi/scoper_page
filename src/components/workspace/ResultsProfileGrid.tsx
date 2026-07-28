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
      <div className="text-muted-foreground flex min-h-[16rem] flex-1 items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 text-center text-sm">
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

      <div
        className={cn(
          'grid min-h-0 flex-1 auto-rows-min gap-4 overflow-y-auto pb-2',
          'grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]',
          profiles.length === 1 && 'max-w-lg',
        )}
      >
        {profiles.map((profile) => (
          <ResultsProfileCard
            key={profile.profile_id}
            profile={profile}
            onCriterionClick={handleCriterionClick}
          />
        ))}
      </div>
    </div>
  )
}
