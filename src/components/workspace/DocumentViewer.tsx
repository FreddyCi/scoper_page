import { useEffect, useMemo } from 'react'
import {
  RPConfig,
  RPProvider,
  RPLayout,
  RPPages,
} from '@react-pdf-kit/viewer'

import { PDFJS_WORKER_URL } from '@/lib/pdfjs-config'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import type { DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'

type DocumentViewerProps = {
  document: DocumentMeta
  initialPage?: number
  onPageChange?: (page: number) => void
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

export function DocumentViewer({
  document,
  initialPage = 1,
  onPageChange,
  className,
}: DocumentViewerProps) {
  const pdfBytes = useMemo(
    () => getDocumentBytes(document.doc_id),
    [document.doc_id],
  )

  const pdfSrc = useMemo(() => {
    if (!pdfBytes) return null
    const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' })
    return URL.createObjectURL(blob)
  }, [pdfBytes])

  useEffect(() => {
    if (!pdfSrc) return
    return () => {
      URL.revokeObjectURL(pdfSrc)
    }
  }, [pdfSrc])

  if (document.mime !== 'application/pdf') {
    return (
      <ViewerState
        className={className}
        title="Preview unavailable"
        message={`${document.filename} is not a PDF. Document preview supports PDF only in this MVP.`}
      />
    )
  }

  if (!pdfBytes || !pdfSrc) {
    return (
      <ViewerState
        className={className}
        title="PDF not in memory"
        message="Original file bytes are unavailable for this session. Re-upload the document to preview it."
      />
    )
  }

  return (
    <div className={cn('bg-workspace min-h-0 flex-1 overflow-hidden rounded-panel', className)}>
      <RPConfig workerUrl={PDFJS_WORKER_URL}>
        <RPProvider
          src={pdfSrc}
          initialPage={initialPage}
          onPageChange={onPageChange}
          onLoadError={(error) => {
            console.error('[document-viewer]', error)
          }}
        >
          <RPLayout
            toolbar
            style={{ height: '100%', minHeight: '20rem' }}
            className="rounded-panel"
          >
            <RPPages />
          </RPLayout>
        </RPProvider>
      </RPConfig>
    </div>
  )
}
