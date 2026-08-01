import { CircleCheckIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  citationSourceLegend,
  citationSourceStyle,
  classifyCitationSource,
  type CitationSourceKind,
} from '@/lib/citation-source'
import type { CitationRef } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import { useSessionStore } from '@/store/session-store'

/** Floating pill toolbar — matches criterion row action cluster. */
export const citationActionToolbarClass =
  'bg-background/80 border-border/60 flex shrink-0 items-center rounded-md border p-0.5 shadow-sm'

type CitationChipProps = {
  citation: CitationRef
  className?: string
}

function chipSnippet(citation: CitationRef): string {
  const excerpt = citation.excerpt.trim()
  return excerpt.length > 48 ? `${excerpt.slice(0, 45).trimEnd()}…` : excerpt || 'View source'
}

type CitationIdentifiedToggleProps = {
  citation: CitationRef
  className?: string
}

/** Single-icon pill: circle-check toggles identified / opens source (same as criterion trailing menu). */
export function CitationIdentifiedToggle({ citation, className }: CitationIdentifiedToggleProps) {
  const [identified, setIdentified] = useState(false)

  function handleToggle(event: React.MouseEvent) {
    event.stopPropagation()
    setIdentified((current) => !current)
    focusCitation(citation)
  }

  return (
    <div className={cn(citationActionToolbarClass, className)}>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={
          identified
            ? 'Identified — open passage in document'
            : 'Not marked identified — click to open and mark'
        }
        aria-pressed={identified}
        className={cn(
          identified
            ? 'text-emerald-600 hover:text-emerald-700'
            : 'text-muted-foreground hover:text-emerald-600',
        )}
        onClick={handleToggle}
      >
        <CircleCheckIcon className="size-3.5" strokeWidth={2} />
      </Button>
    </div>
  )
}

export function CitationChip({ citation, className }: CitationChipProps) {
  const documents = useSessionStore((state) => state.documents)
  const evaluationDocId = useSessionStore((state) => state.evaluationDocId)
  const source = citationSourceStyle(citation.doc_id, documents, evaluationDocId)
  const page = citation.page_num != null ? `Page ${citation.page_num}` : 'Source'

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => focusCitation(citation)}
        className={cn(
          'inline-flex min-w-0 flex-1 items-center rounded-full border px-2.5 py-1 text-left text-xs font-medium transition-colors',
          source.chipClass,
        )}
      >
        <span className="truncate">
          <span className="font-semibold">{source.label}</span>
          <span className="opacity-60"> · </span>
          {page}
          <span className="opacity-60"> · </span>
          {chipSnippet(citation)}
        </span>
      </button>
      <CitationIdentifiedToggle citation={citation} />
    </div>
  )
}

const SOURCE_ORDER: CitationSourceKind[] = ['rfp', 'context', 'bidder', 'document']

type CitationChipListProps = {
  citations: CitationRef[]
  className?: string
}

export function CitationChipList({ citations, className }: CitationChipListProps) {
  const documents = useSessionStore((state) => state.documents)
  const evaluationDocId = useSessionStore((state) => state.evaluationDocId)

  const grouped = useMemo(() => {
    const buckets = new Map<CitationSourceKind, CitationRef[]>()

    for (const citation of citations) {
      const kind = classifyCitationSource(citation.doc_id, documents, evaluationDocId)
      const bucket = buckets.get(kind) ?? []
      bucket.push(citation)
      buckets.set(kind, bucket)
    }

    return SOURCE_ORDER.flatMap((kind) => {
      const items = buckets.get(kind)
      if (!items?.length) return []
      return [{ kind, items }]
    })
  }, [citations, documents, evaluationDocId])

  if (citations.length === 0) return null

  const showGroups = grouped.length > 1

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase text-emerald-800">
          <span className={citationActionToolbarClass}>
            <CircleCheckIcon className="mx-0.5 size-3.5 text-emerald-600" strokeWidth={2} aria-hidden />
          </span>
          Identified
        </span>
        {citationSourceLegend().map((entry) => (
          <span
            key={entry.kind}
            className={cn('inline-flex items-center gap-1.5 text-[10px] font-medium uppercase', entry.legendClass)}
          >
            <span className={cn('size-2 rounded-full border', entry.chipClass)} aria-hidden />
            {entry.label}
          </span>
        ))}
      </div>

      {showGroups ? (
        grouped.map(({ kind, items }) => {
          const style = citationSourceLegend().find((entry) => entry.kind === kind)
          return (
            <div key={kind} className="space-y-1.5">
              <p className={cn('text-[11px] font-semibold tracking-wide uppercase', style?.legendClass)}>
                From {style?.label ?? kind}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {items.map((citation) => (
                  <CitationChip key={citation.block_id} citation={citation} />
                ))}
              </div>
            </div>
          )
        })
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {citations.map((citation) => (
            <CitationChip key={citation.block_id} citation={citation} />
          ))}
        </div>
      )}
    </div>
  )
}
