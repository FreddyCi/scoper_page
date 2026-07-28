import { useMemo } from 'react'
import { Streamdown } from 'streamdown'

import type { DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getDocumentBytes } from '@/services/document-bytes-cache'

type MarkdownDocumentViewerProps = {
  document: DocumentMeta
  className?: string
}

function ViewerState({
  title,
  message,
  className,
}: {
  title: string
  message: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-border bg-surface text-muted-foreground flex h-full min-h-[20rem] flex-col items-center justify-center gap-2 rounded-panel border px-6 text-center text-sm',
        className,
      )}
    >
      <p className="text-foreground font-medium">{title}</p>
      <p className="text-subtle-foreground max-w-sm text-xs">{message}</p>
    </div>
  )
}

/** Render uploaded markdown from cached bytes — context docs and notes (BDA-081) */
export function MarkdownDocumentViewer({ document, className }: MarkdownDocumentViewerProps) {
  const markdown = useMemo(() => {
    const bytes = getDocumentBytes(document.doc_id)
    if (!bytes) return null
    return new TextDecoder('utf-8').decode(bytes)
  }, [document.doc_id])

  if (!markdown) {
    return (
      <ViewerState
        className={className}
        title="Markdown not in memory"
        message="Re-upload this file to preview it in the session."
      />
    )
  }

  return (
    <div
      className={cn(
        'border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border',
        className,
      )}
    >
      <header className="border-border/70 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-foreground truncate text-sm font-semibold">{document.filename}</h2>
          <p className="text-muted-foreground text-xs">Markdown context document</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <Streamdown
          mode="static"
          className="text-foreground prose-sm max-w-none text-sm leading-relaxed [&_table]:text-xs"
        >
          {markdown}
        </Streamdown>
      </div>
    </div>
  )
}
