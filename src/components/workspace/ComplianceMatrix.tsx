import { useEffect, useState } from 'react'
import { ChevronRightIcon, DownloadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CitationRef, RfpRequirementScore, RfpRequirementScoreStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import { downloadRfpComplianceCsv } from '@/services/export-rfp-compliance-csv'
import {
  selectRfpInstructionsProfile,
  selectRfpRequirementScores,
  selectRfpRequirements,
  useSessionStore,
} from '@/store/session-store'

const STATUS_OPTIONS: RfpRequirementScoreStatus[] = ['met', 'partial', 'gap', 'unknown']

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

type ScoreCellProps = {
  requirementId: string
  profileId: string
  score: RfpRequirementScore | null
}

function RequirementScoreSelect({ requirementId, profileId, score }: ScoreCellProps) {
  const updateRfpRequirementScore = useSessionStore((state) => state.updateRfpRequirementScore)
  const status = score?.status ?? 'unknown'
  const [draft, setDraft] = useState(status)

  useEffect(() => {
    setDraft(status)
  }, [status])

  async function commit(next: RfpRequirementScoreStatus) {
    if (next === status && score?.source === 'user') return
    setDraft(next)
    await updateRfpRequirementScore({
      requirement_id: requirementId,
      profile_id: profileId,
      status: next,
      note: score?.note,
      source: 'user',
    })
  }

  return (
    <select
      value={draft}
      aria-label={`Compliance status for requirement ${requirementId}`}
      onChange={(event) => void commit(event.target.value as RfpRequirementScoreStatus)}
      className={cn(
        'max-w-full rounded-md border px-1.5 py-1 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        STATUS_CLASS[draft],
      )}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {STATUS_LABEL[option]}
        </option>
      ))}
    </select>
  )
}

function RequirementNoteInput({
  requirementId,
  profileId,
  profileLabel,
  score,
  showProfileLabel,
}: ScoreCellProps & { profileLabel: string; showProfileLabel: boolean }) {
  const updateRfpRequirementScore = useSessionStore((state) => state.updateRfpRequirementScore)
  const note = score?.note ?? ''
  const [draft, setDraft] = useState(note)

  useEffect(() => {
    setDraft(note)
  }, [note])

  async function commit() {
    const trimmed = draft.trim()
    const previous = note.trim()
    if (trimmed === previous) return
    await updateRfpRequirementScore({
      requirement_id: requirementId,
      profile_id: profileId,
      status: score?.status ?? 'unknown',
      note: trimmed || undefined,
      source: 'user',
    })
  }

  return (
    <div className="space-y-1">
      {showProfileLabel ? (
        <p className="text-muted-foreground truncate text-[10px] font-medium" title={profileLabel}>
          {profileLabel}
        </p>
      ) : null}
      <Input
        value={draft}
        placeholder="Add note…"
        aria-label={
          showProfileLabel
            ? `Note for ${profileLabel}`
            : `Note for requirement ${requirementId}`
        }
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }
        }}
        className="h-7 min-w-[6rem] px-2 text-xs"
      />
    </div>
  )
}

/** Shall/must compliance matrix — baseline requirements vs bidder profiles (BDA-264–265). */
export function ComplianceMatrix({ onCitationClick, className }: ComplianceMatrixProps) {
  const requirements = useSessionStore(selectRfpRequirements)
  const scores = useSessionStore(selectRfpRequirementScores)
  const profiles = useSessionStore((state) => state.profiles)
  const instructions = useSessionStore(selectRfpInstructionsProfile)
  const evaluationDocId = useSessionStore((state) => state.evaluationDocId)
  const documents = useSessionStore((state) => state.documents)
  const [exportingCsv, setExportingCsv] = useState(false)

  const baselineFilename = documents.find((doc) => doc.doc_id === evaluationDocId)?.filename

  async function handleExportCsv() {
    if (requirements.length === 0 || exportingCsv) return
    setExportingCsv(true)
    try {
      await downloadRfpComplianceCsv({
        baselineFilename,
        requirements,
        profiles,
        scores,
        instructions,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('[compliance-matrix] csv export failed', error)
    } finally {
      setExportingCsv(false)
    }
  }

  function handleCitationClick(citation: CitationRef) {
    if (onCitationClick) {
      onCitationClick(citation)
      return
    }
    focusCitation(citation)
  }

  function scoreFor(requirementId: string, profileId: string): RfpRequirementScore | null {
    return (
      scores.find(
        (score) => score.requirement_id === requirementId && score.profile_id === profileId,
      ) ?? null
    )
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
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Compliance matrix</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {requirements.length} obligation{requirements.length === 1 ? '' : 's'} from baseline
            {profiles.length > 0
              ? ` · edit status and notes per bidder (saved on blur)`
              : ' · upload bidder responses to score columns'}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 px-2 text-xs"
          disabled={exportingCsv}
          onClick={() => void handleExportCsv()}
        >
          <DownloadIcon className="size-3.5" />
          {exportingCsv ? 'Exporting…' : 'CSV'}
        </Button>
      </div>

      <div className="border-border/70 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
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
              <th className="text-muted-foreground min-w-[7rem] px-2 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((requirement, index) => {
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
                      <RequirementScoreSelect
                        requirementId={requirement.id}
                        profileId={profile.profile_id}
                        score={scoreFor(requirement.id, profile.profile_id)}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2 align-top">
                    {profiles.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="space-y-2">
                        {profiles.map((profile) => (
                          <RequirementNoteInput
                            key={profile.profile_id}
                            requirementId={requirement.id}
                            profileId={profile.profile_id}
                            profileLabel={profile.subject.name}
                            showProfileLabel={profiles.length > 1}
                            score={scoreFor(requirement.id, profile.profile_id)}
                          />
                        ))}
                      </div>
                    )}
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
