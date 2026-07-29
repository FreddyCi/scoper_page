import { useMemo } from 'react'
import { Streamdown } from 'streamdown'

import type { DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getDocumentBytes } from '@/services/document-bytes-cache'

type MarkdownDocumentViewerProps = {
  document: DocumentMeta
  className?: string
  /** Rich layout for the Preview tab — tables, lists, and block structure. */
  variant?: 'default' | 'preview'
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

const PREVIEW_PROSE_CLASS =
  'text-foreground prose prose-sm max-w-none leading-relaxed ' +
  '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs ' +
  '[&_th]:border-border [&_th]:bg-muted/60 [&_th]:border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold ' +
  '[&_td]:border-border [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top ' +
  '[&_pre]:bg-muted/50 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 ' +
  '[&_ul]:my-3 [&_ol]:my-3 [&_blockquote]:border-violet-300 [&_blockquote]:text-muted-foreground'

/** Render uploaded markdown from cached bytes — context docs and notes (BDA-081) */
export function MarkdownDocumentViewer({
  document,
  className,
  variant = 'default',
}: MarkdownDocumentViewerProps) {
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
          <p className={cn('text-xs', variant === 'preview' ? 'text-violet-800' : 'text-muted-foreground')}>
            {variant === 'preview'
              ? 'Rendered markdown · tables, lists, and formatting'
              : 'Markdown context document'}
          </p>
        </div>
        {variant === 'preview' ? (
          <span className="border-violet-200/70 bg-violet-50/80 text-violet-950 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium">
            Preview
          </span>
        ) : null}
      </header>

      <div
        className={cn(
          'bg-workspace min-h-0 flex-1 overflow-y-auto px-4 py-4',
          variant === 'preview' && 'sm:px-6 sm:py-5',
        )}
      >
        <Streamdown
          mode="static"
          className={cn(
            variant === 'preview' ? PREVIEW_PROSE_CLASS : 'text-foreground prose-sm max-w-none text-sm leading-relaxed [&_table]:text-xs',
            variant === 'preview' && 'mx-auto max-w-3xl',
          )}
        >
          {markdown}
        </Streamdown>
      </div>
    </div>
  )
}
