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
    <div className={cn('absolute inset-0 z-[2]', className)} aria-label="PDF comments">
      {notes.map((note) => {
        const isOpen = openNoteId === note.id
        const iconSize = Math.max(18, Math.min(note.width, note.height, 24))

        return (
          <div key={note.id}>
            <button
              type="button"
              className={cn(
                'absolute flex items-center justify-center rounded-sm border shadow-sm transition-colors',
                isOpen
                  ? 'border-rose-700 bg-rose-600 text-white'
                  : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100',
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
              <MessageSquareTextIcon className="size-3.5" aria-hidden />
            </button>

            {isOpen ? (
              <div
                className="absolute max-w-[min(18rem,42vw)] rounded-md border border-rose-700 bg-rose-600 px-3 py-2 text-sm leading-snug text-white shadow-lg"
                style={{
                  left: note.left + iconSize + 6,
                  top: Math.max(0, note.top - 4),
                }}
              >
                {note.title && note.title !== 'Notation' ? (
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100">
                    {note.title}
                  </p>
                ) : null}
                <p>{note.contents}</p>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
