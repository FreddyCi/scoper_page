import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CriterionRow } from '@/components/workspace/CriterionRow'
import type { CitationRef, RfpResultsProfile, RfpVerdict } from '@/lib/types'
import { cn } from '@/lib/utils'

const VERDICT_LABEL: Record<RfpVerdict, string> = {
  likely: 'Likely qualifies',
  might: 'Might qualify',
  unlikely: 'Unlikely to qualify',
}

const VERDICT_VARIANT: Record<RfpVerdict, 'default' | 'secondary' | 'destructive'> = {
  likely: 'default',
  might: 'secondary',
  unlikely: 'destructive',
}

type ResultsProfileCardProps = {
  profile: RfpResultsProfile
  onCriterionClick?: (citation: CitationRef) => void
  className?: string
}

export function ResultsProfileCard({
  profile,
  onCriterionClick,
  className,
}: ResultsProfileCardProps) {
  return (
    <Card
      className={cn(
        'border-border bg-[#1a1d24] text-slate-100 shadow-panel gap-0 py-0',
        className,
      )}
    >
      <CardHeader className="gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base text-white">{profile.subject.name}</CardTitle>
            {profile.subject.role ? (
              <CardDescription className="text-slate-400">{profile.subject.role}</CardDescription>
            ) : null}
          </div>
          <Badge variant={VERDICT_VARIANT[profile.verdict]}>{VERDICT_LABEL[profile.verdict]}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 px-4 py-4">
        {profile.criteria.map((criterion) => (
          <CriterionRow
            key={criterion.id}
            criterion={criterion}
            onCriterionClick={onCriterionClick}
            className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
          />
        ))}

        <p className="text-slate-400 pt-2 text-xs leading-relaxed">{profile.summary}</p>
      </CardContent>
    </Card>
  )
}
