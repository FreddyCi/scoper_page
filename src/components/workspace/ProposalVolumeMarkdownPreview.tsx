import { Streamdown } from 'streamdown'

import type { ProposalVolume } from '@/lib/types'
import { cn } from '@/lib/utils'

const VOLUME_PROSE_CLASS =
  'text-foreground prose prose-sm max-w-none text-xs leading-relaxed ' +
  '[&_pre]:bg-muted/50 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-[11px] ' +
  '[&_blockquote]:border-border [&_blockquote]:text-muted-foreground [&_table]:text-[11px]'

type ProposalVolumeMarkdownPreviewProps = {
  volume: ProposalVolume
  className?: string
}

/** Inline draft markdown for a proposal volume (BDA-134). */
export function ProposalVolumeMarkdownPreview({
  volume,
  className,
}: ProposalVolumeMarkdownPreviewProps) {
  if (volume.status === 'pending') {
    return (
      <p className={cn('text-muted-foreground text-xs leading-relaxed', className)}>
        Generate the complete proposal to preview draft markdown for this volume.
      </p>
    )
  }

  if (volume.status === 'generating') {
    return (
      <p className={cn('text-muted-foreground text-xs leading-relaxed', className)}>
        Draft in progress…
      </p>
    )
  }

  const markdown = volume.bodyMarkdown?.trim()
  if (!markdown) {
    return (
      <p className={cn('text-muted-foreground text-xs leading-relaxed', className)}>
        {volume.status === 'error'
          ? 'No draft content for this volume. Regenerate to retry after fixing setup.'
          : 'No markdown body available.'}
      </p>
    )
  }

  return (
    <div
      className={cn(
        'border-border/60 bg-background/80 max-h-72 overflow-y-auto rounded-md border p-3',
        className,
      )}
    >
      <Streamdown mode="static" className={VOLUME_PROSE_CLASS}>
        {markdown}
      </Streamdown>
    </div>
  )
}
