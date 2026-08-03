import { useState } from 'react'
import { Streamdown } from 'streamdown'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { validateProposalVolumeDraft } from '@/lib/proposal-export-quality'
import type { ProposalVolume } from '@/lib/types'
import { useSessionStore } from '@/store/session-store'
import { cn } from '@/lib/utils'

const VOLUME_PROSE_CLASS =
  'text-foreground prose prose-sm max-w-none text-xs leading-relaxed ' +
  '[&_pre]:bg-muted/50 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-[11px] ' +
  '[&_blockquote]:border-border [&_blockquote]:text-muted-foreground [&_table]:text-[11px]'

type ProposalVolumeMarkdownPreviewProps = {
  volume: ProposalVolume
  className?: string
}

function volumeBodyCanEdit(volume: ProposalVolume): boolean {
  return volume.status === 'draft' || volume.status === 'error'
}

function DraftQualityWarnings({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) {
    return null
  }

  return (
    <div
      role="status"
      className="border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100 rounded-md border px-2.5 py-2"
    >
      <p className="text-xs font-medium leading-snug">Quality notes (saved anyway)</p>
      <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed">
        {reasons.map((reason, index) => (
          <li key={`${index}-${reason}`}>{reason}</li>
        ))}
      </ul>
    </div>
  )
}

/** Inline draft markdown for a proposal volume (BDA-134). */
export function ProposalVolumeMarkdownPreview({
  volume,
  className,
}: ProposalVolumeMarkdownPreviewProps) {
  const setProposalVolumeBody = useSessionStore((s) => s.setProposalVolumeBody)
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [saveWarnings, setSaveWarnings] = useState<string[]>([])

  const canEdit = volumeBodyCanEdit(volume)
  const volumeLabel = volume.title.trim() || volume.id

  const beginEdit = () => {
    setDraftText(volume.bodyMarkdown ?? '')
    setSaveWarnings([])
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraftText('')
  }

  const saveEdit = () => {
    const markdown = draftText
    const validation = validateProposalVolumeDraft(markdown, { label: volumeLabel })
    setProposalVolumeBody(volume.id, markdown)
    setSaveWarnings(validation.reasons)
    setEditing(false)
  }

  if (volume.status === 'pending') {
    return (
      <p className={cn('text-muted-foreground text-xs leading-relaxed', className)}>
        Use Generate on this volume—or Generate complete proposal below—to preview draft markdown
        here.
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

  if (editing) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Textarea
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          rows={12}
          className="font-mono text-xs leading-relaxed"
          aria-label={`Edit markdown for ${volumeLabel}`}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="h-7 text-xs" onClick={saveEdit}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={cancelEdit}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (!markdown) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {volume.status === 'error'
            ? 'No draft content for this volume. Regenerate to retry after fixing setup, or edit to paste markdown.'
            : 'No markdown body available.'}
        </p>
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" className="h-7 w-fit text-xs" onClick={beginEdit}>
            Edit
          </Button>
        ) : null}
        <DraftQualityWarnings reasons={saveWarnings} />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex justify-end">
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={beginEdit}>
            Edit
          </Button>
        ) : null}
      </div>
      <div className="border-border/60 bg-background/80 max-h-72 overflow-y-auto rounded-md border p-3">
        <Streamdown mode="static" className={VOLUME_PROSE_CLASS}>
          {markdown}
        </Streamdown>
      </div>
      <DraftQualityWarnings reasons={saveWarnings} />
    </div>
  )
}
