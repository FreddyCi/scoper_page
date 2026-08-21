import { ChevronRightIcon } from 'lucide-react'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { CitationRef, RfpInstructionField } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import { selectRfpInstructionsProfile, useSessionStore } from '@/store/session-store'

type InstructionsCardProps = {
  variant?: 'evaluation' | 'proposal'
  onCitationClick?: (citation: CitationRef) => void
  className?: string
}

type InstructionFieldRowProps = {
  title: string
  field?: RfpInstructionField
  onCitationClick?: (citation: CitationRef) => void
}

function InstructionFieldRow({ title, field, onCitationClick }: InstructionFieldRowProps) {
  const clickable = Boolean(field?.citation)
  const value = field?.value ?? 'Not found'

  function handleClick() {
    if (!field?.citation) return
    if (onCitationClick) {
      onCitationClick(field.citation)
      return
    }
    focusCitation(field.citation)
  }

  return (
    <div className="border-border/70 bg-workspace-muted/40 space-y-1 rounded-lg border px-3 py-2.5">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{title}</p>
      <button
        type="button"
        disabled={!clickable}
        onClick={handleClick}
        className={cn(
          'flex w-full items-start justify-between gap-2 text-left text-sm leading-snug',
          clickable && 'hover:text-sky-900 cursor-pointer',
          !clickable && 'text-muted-foreground cursor-default',
          field?.value && 'text-foreground',
        )}
      >
        <span className="min-w-0">{value}</span>
        {clickable ? <ChevronRightIcon className="mt-0.5 size-3.5 shrink-0 opacity-60" /> : null}
      </button>
    </div>
  )
}

/** Solicitation instructions from baseline RFP — due date, Q&A, page limits, volumes (BDA-268). */
export function InstructionsCard({
  variant = 'evaluation',
  onCitationClick,
  className,
}: InstructionsCardProps) {
  const profile = useSessionStore(selectRfpInstructionsProfile)
  if (!profile) return null

  const description =
    variant === 'proposal'
      ? 'From the solicitation RFP — not your draft proposal volumes below.'
      : 'Extracted from the requirements document after qualification.'

  return (
    <Card
      className={cn(
        'border-border bg-surface shadow-panel gap-0 overflow-hidden rounded-xl border py-0',
        className,
      )}
    >
      <CardHeader className="gap-2 border-b border-border/70 px-4 py-4">
        <CardTitle className="text-base leading-snug font-semibold tracking-tight">
          Solicitation instructions
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-2 px-4 py-4 sm:grid-cols-2">
        <InstructionFieldRow
          title="Due date"
          field={profile.dueDate}
          onCitationClick={onCitationClick}
        />
        <InstructionFieldRow
          title="Questions due"
          field={profile.questionsDue}
          onCitationClick={onCitationClick}
        />
        <InstructionFieldRow
          title="Page limit"
          field={profile.pageLimit}
          onCitationClick={onCitationClick}
        />
        <div className="border-border/70 bg-workspace-muted/40 space-y-2 rounded-lg border px-3 py-2.5 sm:col-span-2">
          <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Solicitation volumes
          </p>
          {profile.volumes.length > 0 ? (
            <ul className="space-y-1.5">
              {profile.volumes.map((volume, index) => {
                const clickable = Boolean(volume.citation)
                return (
                  <li key={`${volume.value}-${index}`}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => {
                        if (!volume.citation) return
                        if (onCitationClick) {
                          onCitationClick(volume.citation)
                          return
                        }
                        focusCitation(volume.citation)
                      }}
                      className={cn(
                        'flex w-full items-start justify-between gap-2 text-left text-sm leading-snug',
                        clickable && 'hover:text-sky-900 cursor-pointer',
                        !clickable && 'cursor-default',
                      )}
                    >
                      <span className="min-w-0">{volume.value}</span>
                      {clickable ? (
                        <ChevronRightIcon className="mt-0.5 size-3.5 shrink-0 opacity-60" />
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Not found</p>
          )}
          {variant === 'proposal' ? (
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              These are RFP volume headings — separate from responder draft volumes in this panel.
            </p>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="border-border/70 bg-workspace-muted/30 border-t px-4 py-3">
        <p className="text-muted-foreground text-xs leading-relaxed">{profile.summary}</p>
      </CardFooter>
    </Card>
  )
}
