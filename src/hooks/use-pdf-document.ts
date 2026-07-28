import { useEffect, useState } from 'react'

import type { PDFDocumentProxy } from 'pdfjs-dist'

import { loadPdfDocument } from '@/lib/pdfjs-viewer'

export function usePdfDocument(bytes: Uint8Array | undefined) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!bytes) {
      setPdf(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void loadPdfDocument(bytes)
      .then((document) => {
        if (!cancelled) setPdf(document)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setPdf(null)
          setError(loadError instanceof Error ? loadError : new Error(String(loadError)))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [bytes])

  return { pdf, loading, error }
}
