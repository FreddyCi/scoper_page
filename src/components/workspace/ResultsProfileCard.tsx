import { MapPinIcon } from 'lucide-react'

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { docMentionLabel } from '@/lib/chat-mentions'
import { CriterionRow } from '@/components/workspace/CriterionRow'
import type { CitationRef, CriterionStatus, RfpResultsProfile, RfpVerdict } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

const VERDICT_LABEL: Record<RfpVerdict, string> = {
  likely: 'Likely qualifies',
  might: 'Might qualify',
  unlikely: 'Unlikely to qualify',
}

const VERDICT_CLASS: Record<RfpVerdict, string> = {
  likely: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  might: 'border-amber-200 bg-amber-50 text-amber-700',
  unlikely: 'border-rose-200 bg-rose-50 text-rose-700',
}

const STATUS_SUMMARY_CLASS: Record<CriterionStatus, string> = {
  pass: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  fail: 'bg-rose-50 text-rose-700',
}

function countByStatus(criteria: RfpResultsProfile['criteria']) {
  return criteria.reduce(
    (acc, item) => {
      acc[item.status] += 1
      return acc
    },
    { pass: 0, warn: 0, fail: 0 } as Record<CriterionStatus, number>,
  )
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
  const documents = useSessionStore((state) => state.documents)
  const contractDoc = documents.find((doc) => doc.doc_id === profile.source_doc_id)
  const chatPromptOptions = {
    contractFilename: contractDoc?.filename,
    docMention: contractDoc ? docMentionLabel(contractDoc) : undefined,
  }
  const statusCounts = countByStatus(profile.criteria)

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
            <CardTitle className="text-base leading-snug font-semibold tracking-tight break-words">
              {profile.subject.name}
            </CardTitle>
            {profile.subject.role ? (
              <p className="text-muted-foreground text-sm">{profile.subject.role}</p>
            ) : null}
            {profile.subject.location ? (
              <p className="text-subtle-foreground flex items-center gap-1 text-xs">
                <MapPinIcon className="size-3 shrink-0" />
                {profile.subject.location}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
              VERDICT_CLASS[profile.verdict],
            )}
          >
            {VERDICT_LABEL[profile.verdict]}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['pass', 'warn', 'fail'] as const).map((status) =>
            statusCounts[status] > 0 ? (
              <span
                key={status}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                  STATUS_SUMMARY_CLASS[status],
                )}
              >
                {statusCounts[status]} {status}
              </span>
            ) : null,
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 px-4 py-4">
        {profile.criteria.map((criterion) => (
          <CriterionRow
            key={criterion.id}
            criterion={criterion}
            onCriterionClick={onCriterionClick}
            chatPromptOptions={chatPromptOptions}
          />
        ))}
      </CardContent>

      <CardFooter className="border-border/70 bg-workspace-muted/40 border-t px-4 py-3">
        <p className="text-muted-foreground text-sm leading-relaxed">{profile.summary}</p>
      </CardFooter>
    </Card>
  )
}
