import { useState } from 'react'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  LayersIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ChatCitationCard } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'

type ChatCitationCardViewProps = {
  citations: ChatCitationCard[]
  className?: string
}

function highlightBody(body: string, highlight: string) {
  const index = body.indexOf(highlight)
  if (index < 0) {
    return <p className="text-foreground text-sm leading-relaxed">{body}</p>
  }

  const before = body.slice(0, index)
  const after = body.slice(index + highlight.length)

  return (
    <p className="text-foreground text-sm leading-relaxed">
      {before}
      <mark className="rounded-sm bg-sky-100 px-0.5 text-sky-950">{highlight}</mark>
      {after}
    </p>
  )
}

export function ChatCitationCardView({ citations, className }: ChatCitationCardViewProps) {
  const [index, setIndex] = useState(0)

  if (citations.length === 0) return null

  const current = citations[index] ?? citations[0]
  const total = citations.length

  return (
    <div
      className={cn(
        'border-border bg-surface shadow-panel overflow-hidden rounded-xl border',
        className,
      )}
    >
      <div className="border-border/70 flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Previous source"
            disabled={index === 0}
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {index + 1}/{total}
          </span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Next source"
            disabled={index >= total - 1}
            onClick={() => setIndex((value) => Math.min(total - 1, value + 1))}
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
        </div>

        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <CalendarIcon className="size-3.5" />
          <LayersIcon className="size-3.5" />
          <span>
            {total} {total === 1 ? 'source' : 'sources'}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {highlightBody(current.body, current.highlight)}

        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 rounded-full px-3 text-xs"
          onClick={() => focusCitation(current.citation)}
        >
          View source
        </Button>
      </div>

      <div className="border-border/70 text-muted-foreground flex items-center gap-2 border-t px-4 py-2.5 text-xs">
        <FileTextIcon className="size-3.5 shrink-0" />
        <span className="text-foreground truncate font-medium">{current.sourceLabel}</span>
        {current.sourceMeta ? (
          <>
            <span aria-hidden>·</span>
            <span className="truncate">{current.sourceMeta}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
