import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Loader2Icon,
} from 'lucide-react'

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
  className?: string
}

export function ProposalVolumeRow({ volume, muted = false, className }: ProposalVolumeRowProps) {
  const StatusIcon = STATUS_ICON[volume.status]
  const statusLabel = volumeStatusLabel(volume.status)
  const showLiveStatus = !muted || volume.status !== 'pending'

  return (
    <li
      className={cn(
        'flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm',
        muted
          ? 'border-border/40 bg-muted/20 opacity-60 saturate-50'
          : 'border-border/70 bg-workspace-muted/50',
        className,
      )}
      aria-disabled={muted ? true : undefined}
    >
      <div className="flex items-start gap-2.5">
        <StatusIcon
          className={cn(
            'mt-0.5 size-4 shrink-0',
            muted && volume.status === 'pending'
              ? 'text-muted-foreground/70'
              : STATUS_ICON_CLASS[volume.status],
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                'font-medium leading-snug',
                muted ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {volume.title}
            </span>
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                showLiveStatus ? 'text-muted-foreground' : 'text-muted-foreground/70',
              )}
            >
              {muted && volume.status === 'pending' ? 'Awaiting setup' : statusLabel}
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
    </li>
  )
}
