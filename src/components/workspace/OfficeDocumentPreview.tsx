import { useMemo } from 'react'

import { useDocumentBlocks } from '@/hooks/use-document-blocks'
import type { DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  commonSectionPathPrefix,
  compactSectionPathLabel,
  groupBlocksForMarkdownRead,
} from '@/services/document-blocks'

type OfficeDocumentPreviewProps = {
  document: DocumentMeta
  className?: string
}

function SectionHeading({ label }: { label: string }) {
  const trimmed = label.trim()
  if (
    trimmed === 'Document' ||
    trimmed === 'Unpaged' ||
    /^page \d+$/i.test(trimmed)
  ) {
    return null
  }

  return (
    <h2 className="text-foreground border-border/70 scroll-mt-4 border-b pb-1 text-base font-semibold tracking-tight">
      {label}
    </h2>
  )
}

/** Render ingested Word blocks as a readable document preview */
export function OfficeDocumentPreview({ document, className }: OfficeDocumentPreviewProps) {
  const { blocks, loading, error } = useDocumentBlocks(document.doc_id)

  const sectionGroups = useMemo(() => groupBlocksForMarkdownRead(blocks), [blocks])
  const sectionPathPrefix = useMemo(
    () => commonSectionPathPrefix(sectionGroups.map((group) => group.label)),
    [sectionGroups],
  )

  return (
    <section
      className={cn(
        'border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden',
        className,
      )}
    >
      <header className="border-border/70 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-foreground truncate text-sm font-semibold">{document.filename}</h2>
          <p className="text-muted-foreground text-xs">Extracted from Word · formatted preview</p>
        </div>
        <span className="border-border bg-muted/50 text-foreground shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium">
          Word
        </span>
      </header>

      <div className="bg-workspace min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {loading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Loading document…</p>
        ) : null}

        {error ? (
          <p className="text-destructive py-8 text-center text-sm">{error.message}</p>
        ) : null}

        {!loading && !error && sectionGroups.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No text was extracted from this document.
          </p>
        ) : null}

        {!loading && !error && sectionGroups.length > 0 ? (
          <article className="prose prose-sm mx-auto max-w-3xl text-foreground">
            {sectionGroups.map((group) => (
              <section key={group.label} className="mb-6 space-y-3 last:mb-0">
                <SectionHeading
                  label={compactSectionPathLabel(group.label, sectionPathPrefix)}
                />
                <div className="space-y-2.5">
                  {group.blocks.map((block) => (
                    <p
                      key={block.block_id}
                      className="text-foreground m-0 text-sm leading-relaxed whitespace-pre-wrap"
                    >
                      {block.text}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </article>
        ) : null}
      </div>
    </section>
  )
}
