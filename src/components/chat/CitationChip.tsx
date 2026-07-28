import { FileTextIcon } from 'lucide-react'

import type { CitationRef } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'

type CitationChipProps = {
  citation: CitationRef
  className?: string
}

function chipLabel(citation: CitationRef): string {
  const page = citation.page_num != null ? `Page ${citation.page_num}` : 'Source'
  const excerpt = citation.excerpt.trim()
  const snippet =
    excerpt.length > 48 ? `${excerpt.slice(0, 45).trimEnd()}…` : excerpt || 'View source'
  return `${page} · ${snippet}`
}

export function CitationChip({ citation, className }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={() => focusCitation(citation)}
      className={cn(
        'border-sky-200 bg-sky-50 text-sky-950 hover:bg-sky-100 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-xs font-medium transition-colors',
        className,
      )}
    >
      <FileTextIcon className="size-3 shrink-0 opacity-70" />
      <span className="truncate">{chipLabel(citation)}</span>
    </button>
  )
}

type CitationChipListProps = {
  citations: CitationRef[]
  className?: string
}

export function CitationChipList({ citations, className }: CitationChipListProps) {
  if (citations.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {citations.map((citation) => (
        <CitationChip key={citation.block_id} citation={citation} />
      ))}
    </div>
  )
}
