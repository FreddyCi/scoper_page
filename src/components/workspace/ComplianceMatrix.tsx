import { ChevronRightIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { CitationRef, RfpRequirementScoreStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import {
  selectRfpRequirementScores,
  selectRfpRequirements,
  useSessionStore,
} from '@/store/session-store'

const STATUS_LABEL: Record<RfpRequirementScoreStatus, string> = {
  met: 'Met',
  partial: 'Partial',
  gap: 'Gap',
  unknown: 'Unknown',
}

const STATUS_CLASS: Record<RfpRequirementScoreStatus, string> = {
  met: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  partial: 'border-amber-200 bg-amber-50 text-amber-700',
  gap: 'border-rose-200 bg-rose-50 text-rose-700',
  unknown: 'border-border bg-muted/40 text-muted-foreground',
}

type ComplianceMatrixProps = {
  onCitationClick?: (citation: CitationRef) => void
  className?: string
}

function RequirementScoreChip({ status }: { status: RfpRequirementScoreStatus | null }) {
  if (!status) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}

function formatNotesForRow(
  profileIds: string[],
  profileNames: Map<string, string>,
  notesByProfile: Map<string, string>,
): string | null {
  const entries = profileIds
    .map((profileId) => {
      const note = notesByProfile.get(profileId)?.trim()
      if (!note) return null
      const name = profileNames.get(profileId) ?? profileId
      return profileIds.length === 1 ? note : `${name}: ${note}`
    })
    .filter((entry): entry is string => Boolean(entry))

  return entries.length > 0 ? entries.join(' · ') : null
}

/** Shall/must compliance matrix — baseline requirements vs bidder profiles (BDA-264). */
export function ComplianceMatrix({ onCitationClick, className }: ComplianceMatrixProps) {
  const requirements = useSessionStore(selectRfpRequirements)
  const scores = useSessionStore(selectRfpRequirementScores)
  const profiles = useSessionStore((state) => state.profiles)

  const profileNames = new Map(profiles.map((profile) => [profile.profile_id, profile.subject.name]))

  function handleCitationClick(citation: CitationRef) {
    if (onCitationClick) {
      onCitationClick(citation)
      return
    }
    focusCitation(citation)
  }

  if (requirements.length === 0) {
    return (
      <section className={cn('border-border/70 space-y-2 border-t pt-4', className)}>
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Compliance matrix</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            No shall/must lines found in the baseline document.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className={cn('border-border/70 space-y-3 border-t pt-4', className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Compliance matrix</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {requirements.length} obligation{requirements.length === 1 ? '' : 's'} from baseline
          {profiles.length > 0
            ? ` · scored against ${profiles.length} bidder${profiles.length === 1 ? '' : 's'}`
            : ' · upload bidder responses to score columns'}
        </p>
      </div>

      <div className="border-border/70 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
          <thead>
            <tr className="border-border/70 bg-workspace-muted/40 border-b">
              <th className="text-muted-foreground w-8 px-2 py-2 font-medium">#</th>
              <th className="text-muted-foreground min-w-[10rem] px-2 py-2 font-medium">
                Requirement
              </th>
              <th className="text-muted-foreground w-16 px-2 py-2 font-medium">Cite</th>
              {profiles.map((profile) => (
                <th
                  key={profile.profile_id}
                  className="text-muted-foreground max-w-[6rem] truncate px-2 py-2 font-medium"
                  title={profile.subject.name}
                >
                  {profile.subject.name}
                </th>
              ))}
              <th className="text-muted-foreground min-w-[5rem] px-2 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((requirement, index) => {
              const rowScores = scores.filter((score) => score.requirement_id === requirement.id)
              const scoresByProfile = new Map(
                rowScores.map((score) => [score.profile_id, score.status]),
              )
              const notesByProfile = new Map(
                rowScores
                  .filter((score) => score.note?.trim())
                  .map((score) => [score.profile_id, score.note!.trim()]),
              )
              const noteText = formatNotesForRow(
                profiles.map((profile) => profile.profile_id),
                profileNames,
                notesByProfile,
              )
              const clickable = Boolean(requirement.citation)

              return (
                <tr
                  key={requirement.id}
                  className="border-border/60 hover:bg-workspace-muted/30 border-b last:border-b-0"
                >
                  <td className="text-muted-foreground px-2 py-2 align-top tabular-nums">{index + 1}</td>
                  <td className="px-2 py-2 align-top">
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => requirement.citation && handleCitationClick(requirement.citation)}
                      className={cn(
                        'text-left leading-relaxed',
                        clickable && 'hover:text-sky-900 cursor-pointer',
                        !clickable && 'cursor-default',
                      )}
                    >
                      {requirement.label}
                    </button>
                  </td>
                  <td className="px-2 py-2 align-top">
                    {clickable ? (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-sky-700 inline-flex items-center gap-0.5"
                        onClick={() =>
                          requirement.citation && handleCitationClick(requirement.citation)
                        }
                      >
                        {requirement.citation?.page_num != null
                          ? `p.${requirement.citation.page_num}`
                          : 'View'}
                        <ChevronRightIcon className="size-3" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {profiles.map((profile) => (
                    <td key={profile.profile_id} className="px-2 py-2 align-top">
                      <RequirementScoreChip
                        status={scoresByProfile.get(profile.profile_id) ?? null}
                      />
                    </td>
                  ))}
                  <td className="text-muted-foreground px-2 py-2 align-top leading-relaxed">
                    {noteText ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
