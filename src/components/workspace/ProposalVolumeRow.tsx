import { useId, useState } from 'react'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  Loader2Icon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ProposalVolumeMarkdownPreview } from '@/components/workspace/ProposalVolumeMarkdownPreview'
import { formatVolumeSectionProgressLine } from '@/lib/proposal-volume-section'
import type {
  ProposalVolume,
  ProposalVolumeSection,
  ProposalVolumeStatus,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<ProposalVolumeStatus, typeof CircleDashedIcon> = {
  pending: CircleDashedIcon,
  generating: Loader2Icon,
  draft: CheckCircle2Icon,
  error: AlertCircleIcon,
}

const STATUS_ICON_CLASS: Record<ProposalVolumeStatus, string> = {
  pending: 'text-muted-foreground',
  generating: 'text-primary animate-spin',
  draft: 'text-emerald-600',
  error: 'text-destructive',
}

function volumeStatusLabel(status: ProposalVolumeStatus): string {
  switch (status) {
    case 'generating':
      return 'Generating…'
    case 'draft':
      return 'Draft ready'
    case 'error':
      return 'Error'
    default:
      return 'Pending'
  }
}

function sectionStatusLabel(status: ProposalVolumeStatus): string {
  switch (status) {
    case 'generating':
      return 'Writing'
    case 'draft':
      return 'Draft'
    case 'error':
      return 'Failed'
    default:
      return 'Pending'
  }
}

function ProposalVolumeSectionStatusList({
  sections,
  compact = false,
}: {
  sections: ProposalVolumeSection[]
  compact?: boolean
}) {
  if (sections.length === 0) {
    return null
  }

  return (
    <ul
      className={cn('space-y-1', compact ? 'mt-1.5' : 'mt-2')}
      aria-label="Sections in this volume"
    >
      {sections.map((section) => {
        const SectionIcon = STATUS_ICON[section.status]
        return (
          <li key={section.id} className="flex items-start gap-2 text-xs">
            <SectionIcon
              className={cn(
                'mt-0.5 size-3.5 shrink-0',
                STATUS_ICON_CLASS[section.status],
                section.status === 'generating' && 'animate-spin',
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'leading-snug',
                    section.status === 'generating'
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {section.title}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {sectionStatusLabel(section.status)}
                </span>
              </div>
              {section.errorMessage ? (
                <p className="text-destructive mt-0.5 leading-snug">{section.errorMessage}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export type ProposalVolumeRowProps = {
  volume: ProposalVolume
  /** Muted preview until setup gates pass (`readyToGenerate`). */
  muted?: boolean
  /** Emphasize the volume currently being generated. */
  active?: boolean
  className?: string
  /** Run sectional generation for this volume only (BDA-199). */
  onGenerate?: (volumeId: string) => void
  generateDisabled?: boolean
  generateDisabledReason?: string
}

export function ProposalVolumeRow({
  volume,
  muted = false,
  active = false,
  className,
  onGenerate,
  generateDisabled = false,
  generateDisabledReason,
}: ProposalVolumeRowProps) {
  const previewId = useId()
  const [expanded, setExpanded] = useState(false)
  const StatusIcon = STATUS_ICON[volume.status]
  const statusLabel = volumeStatusLabel(volume.status)
  const sections = volume.sections ?? []
  const hasSections = sections.length > 0
  const sectionProgressLine =
    active || volume.status === 'generating'
      ? formatVolumeSectionProgressLine(volume)
      : null
  const showSectionList =
    hasSections &&
    (expanded || volume.status === 'generating' || volume.status === 'error')
  const showLiveStatus = !muted || volume.status !== 'pending'
  const hasBody = Boolean(volume.bodyMarkdown?.trim())

  const showVolumeGenerateAction =
    onGenerate != null &&
    (volume.status === 'pending' || volume.status === 'draft' || volume.status === 'error')
  const volumeGenerateLabel = volume.status === 'pending' ? 'Generate' : 'Regenerate'
  const volumeGenerateDisabled = generateDisabled || muted || volume.status === 'generating'
  const volumeGenerateTitle =
    volumeGenerateDisabled && generateDisabledReason
      ? generateDisabledReason
      : volumeGenerateDisabled && muted
        ? 'Complete proposal setup to generate volumes'
        : undefined

  return (
    <li
      className={cn(
        'flex min-w-0 flex-col gap-0 rounded-lg border text-sm transition-colors',
        active && 'border-primary/50 bg-primary/5 ring-primary/30 ring-1',
        !active &&
          (muted
            ? 'border-border/40 bg-muted/20 opacity-60 saturate-50'
            : 'border-border/70 bg-workspace-muted/50'),
        className,
      )}
      aria-disabled={muted ? true : undefined}
      aria-current={active ? 'step' : undefined}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground mt-0.5 shrink-0"
          aria-expanded={expanded}
          aria-controls={previewId}
          aria-label={
            expanded
              ? `Collapse draft preview for ${volume.title}`
              : `Expand draft preview for ${volume.title}`
          }
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? (
            <ChevronDownIcon className="size-4" aria-hidden />
          ) : (
            <ChevronRightIcon className="size-4" aria-hidden />
          )}
        </Button>

        <StatusIcon
          className={cn(
            'mt-1 size-4 shrink-0',
            muted && volume.status === 'pending'
              ? 'text-muted-foreground/70'
              : STATUS_ICON_CLASS[volume.status],
          )}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className={cn(
                'text-left font-medium leading-snug hover:underline',
                muted ? 'text-muted-foreground' : 'text-foreground',
              )}
              onClick={() => setExpanded((open) => !open)}
            >
              {volume.title}
            </button>
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                showLiveStatus ? 'text-muted-foreground' : 'text-muted-foreground/70',
              )}
            >
              {sectionProgressLine ??
                (muted && volume.status === 'pending'
                  ? 'Awaiting setup'
                  : hasBody
                    ? `${statusLabel} · Preview`
                    : statusLabel)}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {volume.requirementSummary}
          </p>
          {showSectionList && !expanded ? (
            <ProposalVolumeSectionStatusList sections={sections} compact />
          ) : null}
          {volume.errorMessage ? (
            <p className="text-destructive mt-1 text-xs">{volume.errorMessage}</p>
          ) : null}
          {showVolumeGenerateAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs"
              disabled={volumeGenerateDisabled}
              title={volumeGenerateTitle}
              aria-label={`${volumeGenerateLabel} ${volume.title}`}
              onClick={() => onGenerate(volume.id)}
            >
              {volumeGenerateLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-border/50 border-t px-3 py-2.5 pl-11" id={previewId}>
          {hasSections ? (
            <ProposalVolumeSectionStatusList sections={sections} />
          ) : null}
          <ProposalVolumeMarkdownPreview volume={volume} className={hasSections ? 'mt-3' : undefined} />
        </div>
      ) : null}
    </li>
  )
}
