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
import type { ProposalVolume, ProposalVolumeStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<
  ProposalVolumeStatus,
  typeof CircleDashedIcon
> = {
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

export type ProposalVolumeRowProps = {
  volume: ProposalVolume
  /** Muted preview until setup gates pass (`readyToGenerate`). */
  muted?: boolean
  /** Emphasize the volume currently being generated. */
  active?: boolean
  className?: string
}

export function ProposalVolumeRow({
  volume,
  muted = false,
  active = false,
  className,
}: ProposalVolumeRowProps) {
  const previewId = useId()
  const [expanded, setExpanded] = useState(false)
  const StatusIcon = STATUS_ICON[volume.status]
  const statusLabel = volumeStatusLabel(volume.status)
  const sectionProgressLine =
    active || volume.status === 'generating'
      ? formatVolumeSectionProgressLine(volume)
      : null
  const showLiveStatus = !muted || volume.status !== 'pending'
  const hasBody = Boolean(volume.bodyMarkdown?.trim())

  return (
    <li
      className={cn(
        'flex flex-col gap-0 rounded-lg border text-sm transition-colors',
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
          {volume.errorMessage ? (
            <p className="text-destructive mt-1 text-xs">{volume.errorMessage}</p>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-border/50 border-t px-3 py-2.5 pl-11" id={previewId}>
          <ProposalVolumeMarkdownPreview volume={volume} />
        </div>
      ) : null}
    </li>
  )
}
