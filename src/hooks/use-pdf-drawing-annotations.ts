import { useCallback, useEffect, useState } from 'react'

import type { PdfDrawingPenCommit } from '@/components/workspace/PdfDrawingOverlay'
import {
  fetchPdfDrawingAnnotationsForPage,
  insertPdfDrawingAnnotation,
} from '@/services/pdf-drawing-annotations'
import type { PdfDrawingAnnotation } from '@/lib/types'

/** Page-scoped drawing marks from DuckDB (BDA-225+). */
export function usePdfDrawingAnnotations(docId: string, pageNum: number) {
  const [annotations, setAnnotations] = useState<PdfDrawingAnnotation[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const rows = await fetchPdfDrawingAnnotationsForPage(docId, pageNum)
    setAnnotations(rows)
    return rows
  }, [docId, pageNum])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchPdfDrawingAnnotationsForPage(docId, pageNum)
      .then((rows) => {
        if (!cancelled) {
          setAnnotations(rows)
          setLoading(false)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[usePdfDrawingAnnotations]', error)
          setAnnotations([])
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [docId, pageNum])

  const commitPenStroke = useCallback(
    async (commit: PdfDrawingPenCommit) => {
      const saved = await insertPdfDrawingAnnotation({
        doc_id: docId,
        page_num: pageNum,
        tool: commit.tool,
        color: commit.color,
        stroke_width: commit.stroke_width,
        opacity: commit.opacity,
        geometry: commit.geometry,
      })
      setAnnotations((previous) => [...previous, saved])
      return saved
    },
    [docId, pageNum],
  )

  return { annotations, loading, refresh, commitPenStroke }
}
