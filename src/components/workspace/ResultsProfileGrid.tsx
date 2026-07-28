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
      <div className="text-muted-foreground flex min-h-[16rem] flex-1 items-center justify-center px-6 text-center text-sm">
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
    <div
      className={cn(
        'grid min-h-0 flex-1 auto-rows-min gap-4 overflow-y-auto pb-2',
        'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
        className,
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
  )
}
