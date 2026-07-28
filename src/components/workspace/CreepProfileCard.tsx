import { ArrowRightLeftIcon } from 'lucide-react'

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CreepFlagRow, SEVERITY_BADGE_CLASS } from '@/components/workspace/CreepFlagRow'
import type {
  CitationRef,
  DocumentMeta,
  ScopeCreepProfile,
  ScopeCreepSeverity,
  ScopeCreepVerdict,
} from '@/lib/types'
import { SCOPE_CREEP_VERDICT_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

const VERDICT_CLASS: Record<ScopeCreepVerdict, string> = {
  aligned: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  possible_creep: 'border-amber-200 bg-amber-50 text-amber-700',
  creep: 'border-rose-200 bg-rose-50 text-rose-700',
}

function documentLabel(documents: DocumentMeta[], docId: string): string {
  const match = documents.find((doc) => doc.doc_id === docId)
  if (!match) return docId
  return match.filename.replace(/\.[^.]+$/, '')
}

function countBySeverity(flags: ScopeCreepProfile['flags']) {
  return flags.reduce(
    (acc, flag) => {
      acc[flag.severity] += 1
      return acc
    },
    { high: 0, medium: 0, low: 0 } as Record<ScopeCreepSeverity, number>,
  )
}

type CreepProfileCardProps = {
  profile: ScopeCreepProfile
  documents?: DocumentMeta[]
  onFlagClick?: (citation: CitationRef) => void
  className?: string
}

export function CreepProfileCard({
  profile,
  documents = [],
  onFlagClick,
  className,
}: CreepProfileCardProps) {
  const severityCounts = countBySeverity(profile.flags)
  const baselineLabel = documentLabel(documents, profile.baseline_doc_id)
  const candidateLabel = documentLabel(documents, profile.candidate_doc_id)

  return (
    <Card
      className={cn(
        'border-border bg-surface shadow-panel gap-0 overflow-hidden rounded-xl border py-0',
        className,
      )}
    >
      <CardHeader className="gap-4 border-b border-border/70 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate text-base font-semibold tracking-tight">
              {baselineLabel}
              <ArrowRightLeftIcon className="text-muted-foreground mx-1.5 inline size-3.5 align-text-bottom" />
              {candidateLabel}
            </CardTitle>
            <p className="text-muted-foreground text-sm">Baseline vs change request</p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
              VERDICT_CLASS[profile.verdict],
            )}
          >
            {SCOPE_CREEP_VERDICT_LABELS[profile.verdict]}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['high', 'medium', 'low'] as const).map((severity) =>
            severityCounts[severity] > 0 ? (
              <span
                key={severity}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                  SEVERITY_BADGE_CLASS[severity],
                )}
              >
                {severityCounts[severity]} {severity}
              </span>
            ) : null,
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 px-4 py-4">
        {profile.flags.map((flag) => (
          <CreepFlagRow key={flag.id} flag={flag} onFlagClick={onFlagClick} />
        ))}
      </CardContent>

      <CardFooter className="border-border/70 bg-workspace-muted/40 border-t px-4 py-3">
        <p className="text-muted-foreground text-sm leading-relaxed">{profile.summary}</p>
      </CardFooter>
    </Card>
  )
}
