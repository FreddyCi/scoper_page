import { useCallback, useEffect, useRef, useState } from 'react'

import type { PdfDrawingShapeCommit, PdfDrawingStrokeCommit } from '@/components/workspace/PdfDrawingOverlay'
import {
  pdfDrawingCanRedo,
  pdfDrawingCanUndo,
  recordPdfDrawingDelete,
  recordPdfDrawingInsert,
  redoPdfDrawingHistory,
  undoPdfDrawingHistory,
} from '@/lib/pdf-drawing-history'
import {
  deletePdfDrawingAnnotation,
  fetchPdfDrawingAnnotationsForPage,
  insertPdfDrawingAnnotation,
  restorePdfDrawingAnnotation,
} from '@/services/pdf-drawing-annotations'
import type { PdfDrawingAnnotation } from '@/lib/types'

const historyHandlers = {
  undoInsert: async (annotation: PdfDrawingAnnotation) => {
    await deletePdfDrawingAnnotation(annotation.annotation_id)
  },
  undoDelete: async (annotation: PdfDrawingAnnotation) => {
    await restorePdfDrawingAnnotation(annotation)
  },
  redoInsert: async (annotation: PdfDrawingAnnotation) => {
    await restorePdfDrawingAnnotation(annotation)
  },
  redoDelete: async (annotation: PdfDrawingAnnotation) => {
    await deletePdfDrawingAnnotation(annotation.annotation_id)
  },
}

/** Page-scoped drawing marks from DuckDB (BDA-225+). */
export function usePdfDrawingAnnotations(docId: string, pageNum: number) {
  const [annotations, setAnnotations] = useState<PdfDrawingAnnotation[]>([])
  const [loading, setLoading] = useState(true)
  const [historyTick, setHistoryTick] = useState(0)
  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations

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

  const bumpHistory = useCallback(() => {
    setHistoryTick((value) => value + 1)
  }, [])

  const commitStroke = useCallback(
    async (commit: PdfDrawingStrokeCommit) => {
      const saved = await insertPdfDrawingAnnotation({
        doc_id: docId,
        page_num: pageNum,
        tool: commit.tool,
        color: commit.color,
        stroke_width: commit.stroke_width,
        opacity: commit.opacity,
        geometry: commit.geometry,
      })
      recordPdfDrawingInsert(docId, saved)
      setAnnotations((previous) => [...previous, saved])
      bumpHistory()
      return saved
    },
    [bumpHistory, docId, pageNum],
  )

  const commitShape = useCallback(
    async (commit: PdfDrawingShapeCommit) => {
      const saved = await insertPdfDrawingAnnotation({
        doc_id: docId,
        page_num: pageNum,
        tool: commit.tool,
        color: commit.color,
        stroke_width: commit.stroke_width,
        opacity: commit.opacity,
        geometry: commit.geometry,
      })
      recordPdfDrawingInsert(docId, saved)
      setAnnotations((previous) => [...previous, saved])
      bumpHistory()
      return saved
    },
    [bumpHistory, docId, pageNum],
  )

  const eraseAnnotation = useCallback(
    async (annotationId: string) => {
      const target = annotationsRef.current.find(
        (annotation) => annotation.annotation_id === annotationId,
      )
      const removed = await deletePdfDrawingAnnotation(annotationId)
      if (removed && target) {
        recordPdfDrawingDelete(docId, target)
        setAnnotations((previous) =>
          previous.filter((annotation) => annotation.annotation_id !== annotationId),
        )
        bumpHistory()
      }
      return removed
    },
    [bumpHistory, docId],
  )

  const undoDrawingMark = useCallback(async () => {
    const op = await undoPdfDrawingHistory(docId, historyHandlers)
    if (!op) return false
    await refresh()
    bumpHistory()
    return true
  }, [bumpHistory, docId, refresh])

  const redoDrawingMark = useCallback(async () => {
    const op = await redoPdfDrawingHistory(docId, historyHandlers)
    if (!op) return false
    await refresh()
    bumpHistory()
    return true
  }, [bumpHistory, docId, refresh])

  void historyTick

  return {
    annotations,
    loading,
    refresh,
    commitStroke,
    commitShape,
    eraseAnnotation,
    undoDrawingMark,
    redoDrawingMark,
    canUndoDrawingMark: pdfDrawingCanUndo(docId),
    canRedoDrawingMark: pdfDrawingCanRedo(docId),
  }
}
