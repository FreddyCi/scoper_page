import { useEffect, useMemo, useRef } from 'react'

import { useDocumentBlocks } from '@/hooks/use-document-blocks'
import { groupBlocksByPage } from '@/services/document-blocks'
import { blockToCitation } from '@/lib/types'
import type { BlockRecord } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type ExtractedTextPaneProps = {
  docId: string
  className?: string
}

function BlockRow({
  block,
  selected,
  onSelect,
}: {
  block: BlockRecord
  selected: boolean
  onSelect: () => void
}) {
  const rowRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selected])

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onSelect}
      className={cn(
        'border-border hover:bg-muted/60 w-full rounded-lg border px-3 py-2 text-left transition-colors',
        selected && 'border-sky-400 bg-sky-50 ring-1 ring-sky-300',
      )}
    >
      <p className="text-foreground text-sm leading-relaxed">{block.text}</p>
      {block.section_path ? (
        <p className="text-muted-foreground mt-1 truncate text-xs">{block.section_path}</p>
      ) : null}
    </button>
  )
}

export function ExtractedTextPane({ docId, className }: ExtractedTextPaneProps) {
  const { blocks, loading, error } = useDocumentBlocks(docId)
  const selectedCitation = useSessionStore((state) => state.selectedCitation)
  const selectCitation = useSessionStore((state) => state.selectCitation)

  const pageGroups = useMemo(() => groupBlocksByPage(blocks), [blocks])
  const activeBlockId =
    selectedCitation?.doc_id === docId ? selectedCitation.block_id : null

  return (
    <section
      className={cn(
        'border-border bg-surface flex min-h-0 flex-col overflow-hidden rounded-panel border',
        className,
      )}
    >
      <header className="border-border/70 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5">
        <div>
          <h2 className="text-foreground text-sm font-semibold">Extracted text</h2>
          <p className="text-muted-foreground text-xs">
            {loading ? 'Loading blocks…' : `${blocks.length} blocks`}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Loading extracted text…</p>
        ) : null}

        {error ? (
          <p className="text-destructive py-8 text-center text-sm">{error.message}</p>
        ) : null}

        {!loading && !error && blocks.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No extracted blocks yet. Upload and parse a document to populate this pane.
          </p>
        ) : null}

        {!loading && !error && pageGroups.length > 0 ? (
          <div className="space-y-4">
            {pageGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="text-muted-foreground sticky top-0 z-10 bg-[inherit] py-1 text-xs font-semibold tracking-wide uppercase">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.blocks.map((block) => (
                    <BlockRow
                      key={block.block_id}
                      block={block}
                      selected={activeBlockId === block.block_id}
                      onSelect={() => selectCitation(blockToCitation(block))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
