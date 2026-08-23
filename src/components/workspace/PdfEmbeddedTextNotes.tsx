import { useEffect, useState } from 'react'
import { MessageSquareTextIcon } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import {
  mapPdfEmbeddedTextNotes,
  type PdfEmbeddedTextNote,
} from '@/lib/pdf-embedded-text-notes'
import { cn } from '@/lib/utils'

type PdfEmbeddedTextNotesProps = {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  /** When false, notes are hidden (e.g. Mark mode drawing). */
  enabled?: boolean
  className?: string
}

export function PdfEmbeddedTextNotes({
  pdf,
  pageNumber,
  scale,
  enabled = true,
  className,
}: PdfEmbeddedTextNotesProps) {
  const [notes, setNotes] = useState<PdfEmbeddedTextNote[]>([])
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setNotes([])
      setOpenNoteId(null)
      return
    }

    let cancelled = false

    void pdf
      .getPage(pageNumber)
      .then(async (page) => {
        const viewport = page.getViewport({ scale })
        const annotations = await page.getAnnotations()
        if (cancelled) return
        setNotes(mapPdfEmbeddedTextNotes(annotations, pageNumber, viewport))
        setOpenNoteId(null)
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[pdf-embedded-text-notes] load failed', error)
          setNotes([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, pdf, pageNumber, scale])

  if (!enabled || notes.length === 0) {
    return null
  }

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-[2]', className)} aria-label="PDF comments">
      {notes.map((note) => {
        const isOpen = openNoteId === note.id
        const iconSize = Math.max(20, Math.min(note.width, note.height, 26))

        return (
          <div key={note.id}>
            <button
              type="button"
              className={cn(
                'pointer-events-auto absolute flex items-center justify-center rounded-md border shadow-md transition-all',
                'border-rose-400/90 bg-rose-500 text-white hover:bg-rose-600',
                isOpen && 'ring-2 ring-rose-400/80 ring-offset-2 ring-offset-white',
              )}
              style={{
                left: note.left,
                top: note.top,
                width: iconSize,
                height: iconSize,
              }}
              aria-expanded={isOpen}
              aria-label={note.contents}
              title={note.contents}
              onClick={() => setOpenNoteId(isOpen ? null : note.id)}
            >
              <MessageSquareTextIcon className="size-3.5" strokeWidth={2.25} aria-hidden />
            </button>

            {isOpen ? (
              <div
                className={cn(
                  'border-border bg-surface text-foreground shadow-panel pointer-events-auto absolute max-w-[min(20rem,44vw)]',
                  'rounded-lg border border-l-[3px] border-l-rose-500 px-3.5 py-2.5',
                  'text-sm leading-relaxed',
                )}
                style={{
                  left: note.left + iconSize + 8,
                  top: Math.max(0, note.top - 6),
                }}
              >
                {note.title && note.title !== 'Notation' ? (
                  <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wide">
                    {note.title}
                  </p>
                ) : (
                  <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wide">
                    Plan note
                  </p>
                )}
                <p className="text-foreground font-medium">{note.contents}</p>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
