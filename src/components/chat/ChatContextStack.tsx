import { useMemo, useState, type ReactNode } from 'react'
import {
  ChevronRightIcon,
  FileTextIcon,
  HighlighterIcon,
  XIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ChatContextAttachment } from '@/lib/types'
import { cn } from '@/lib/utils'

type ChatContextStackProps = {
  attachments: ChatContextAttachment[]
  onRemove: (id: string) => void
  className?: string
}

function StackRow({
  label,
  expanded,
  onToggle,
  trailing,
  children,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
  trailing?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="border-border/60 border-b last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] leading-none transition-colors"
        >
          <ChevronRightIcon
            className={cn(
              'size-3.5 shrink-0 opacity-70 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
          <span className="truncate font-medium">{label}</span>
        </button>
        {trailing}
      </div>
      {expanded && children ? (
        <div className="border-border/40 border-t pb-1">{children}</div>
      ) : null}
    </div>
  )
}

function StackAttachmentItem({
  attachment,
  onRemove,
}: {
  attachment: ChatContextAttachment
  onRemove: () => void
}) {
  const Icon = attachment.kind === 'block' ? HighlighterIcon : FileTextIcon

  return (
    <div className="hover:bg-muted/40 flex items-center gap-2 py-1.5 pr-2 pl-9">
      <Icon className="text-muted-foreground size-3.5 shrink-0" />
      <span className="text-foreground min-w-0 flex-1 truncate text-xs">{attachment.label}</span>
      <button
        type="button"
        aria-label={`Remove ${attachment.label}`}
        className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-md p-1 transition-colors"
        onClick={onRemove}
      >
        <XIcon className="size-3" />
      </button>
    </div>
  )
}

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Cursor-style context stack — grouped rows tucked above the composer */
export function ChatContextStack({ attachments, onRemove, className }: ChatContextStackProps) {
  const { passages, files } = useMemo(() => {
    const passageItems: ChatContextAttachment[] = []
    const fileItems: ChatContextAttachment[] = []

    for (const attachment of attachments) {
      if (attachment.kind === 'block') {
        passageItems.push(attachment)
      } else {
        fileItems.push(attachment)
      }
    }

    return { passages: passageItems, files: fileItems }
  }, [attachments])

  const [passagesExpanded, setPassagesExpanded] = useState(false)
  const [filesExpanded, setFilesExpanded] = useState(false)

  if (attachments.length === 0) return null

  return (
    <div
      className={cn(
        'border-border/70 bg-muted/50 shrink-0 border-b',
        className,
      )}
      aria-label="Attached context"
    >
      {passages.length > 0 ? (
        <StackRow
          label={formatCount(passages.length, 'Passage', 'Passages')}
          expanded={passagesExpanded}
          onToggle={() => setPassagesExpanded((value) => !value)}
        >
          {passages.map((attachment) => (
            <StackAttachmentItem
              key={attachment.id}
              attachment={attachment}
              onRemove={() => onRemove(attachment.id)}
            />
          ))}
        </StackRow>
      ) : null}

      {files.length > 0 ? (
        <StackRow
          label={formatCount(files.length, 'File', 'Files')}
          expanded={filesExpanded}
          onToggle={() => setFilesExpanded((value) => !value)}
          trailing={
            !filesExpanded ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-6 shrink-0 px-2 text-[11px] font-medium"
                onClick={() => setFilesExpanded(true)}
              >
                Review
              </Button>
            ) : null
          }
        >
          {files.map((attachment) => (
            <StackAttachmentItem
              key={attachment.id}
              attachment={attachment}
              onRemove={() => onRemove(attachment.id)}
            />
          ))}
        </StackRow>
      ) : null}
    </div>
  )
}
