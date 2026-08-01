import { CircleCheckIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

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

const SOURCE_ACCENT: Record<CitationSourceKind, string> = {
  rfp: 'border-l-sky-500',
  context: 'border-l-violet-500',
  bidder: 'border-l-amber-500',
  document: 'border-l-muted-foreground/40',
}

type CitationChipProps = {
  citation: CitationRef
  className?: string
}

function chipSnippet(citation: CitationRef): string {
  const excerpt = citation.excerpt.trim()
  return excerpt.length > 72 ? `${excerpt.slice(0, 69).trimEnd()}…` : excerpt || 'View source'
}

export function CitationChip({ citation, className }: CitationChipProps) {
  const [identified, setIdentified] = useState(false)
  const documents = useSessionStore((state) => state.documents)
  const evaluationDocId = useSessionStore((state) => state.evaluationDocId)
  const kind = classifyCitationSource(citation.doc_id, documents, evaluationDocId)
  const source = citationSourceStyle(citation.doc_id, documents, evaluationDocId)
  const page = citation.page_num != null ? `Page ${citation.page_num}` : 'Source'

  return (
    <div
      className={cn(
        'border-border/80 bg-background flex w-full max-w-full items-stretch overflow-hidden rounded-lg border border-l-4 shadow-sm',
        SOURCE_ACCENT[kind],
        identified && 'border-emerald-400/90 ring-1 ring-emerald-200/60',
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={identified}
        aria-label={identified ? 'Identified — click to unmark' : 'Mark as identified'}
        onClick={() => setIdentified((current) => !current)}
        className={cn(
          'border-border/60 hover:bg-muted/40 flex w-10 shrink-0 items-center justify-center border-r transition-colors',
          identified ? 'bg-emerald-50/80' : 'bg-muted/20',
        )}
      >
        <CircleCheckIcon
          className={cn(
            'size-4 transition-colors',
            identified ? 'text-emerald-600' : 'text-muted-foreground/45',
          )}
          strokeWidth={2}
        />
      </button>

      <button
        type="button"
        onClick={() => focusCitation(citation)}
        className={cn(
          'hover:bg-muted/30 min-w-0 flex-1 px-2.5 py-2 text-left text-xs leading-snug transition-colors',
          source.legendClass,
        )}
      >
        <span className="text-foreground block truncate font-medium">
          <span className={cn('font-semibold', source.legendClass)}>{source.label}</span>
          <span className="text-muted-foreground font-normal"> · {page}</span>
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate">{chipSnippet(citation)}</span>
      </button>
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
    <div className={cn('space-y-3', className)}>
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        <CircleCheckIcon className="mr-1 inline size-3.5 align-[-2px] text-emerald-600" aria-hidden />
        Check when reviewed · click passage to open in document
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
              <div className="flex flex-col gap-1.5">
                {items.map((citation) => (
                  <CitationChip key={citation.block_id} citation={citation} />
                ))}
              </div>
            </div>
          )
        })
      ) : (
        <div className="flex flex-col gap-1.5">
          {citations.map((citation) => (
            <CitationChip key={citation.block_id} citation={citation} />
          ))}
        </div>
      )}
    </div>
  )
}
