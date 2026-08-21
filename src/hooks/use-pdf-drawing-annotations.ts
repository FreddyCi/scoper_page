import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  PdfDrawingShapeCommit,
  PdfDrawingStampCommit,
  PdfDrawingStrokeCommit,
  PdfDrawingTextCommit,
} from '@/components/workspace/PdfDrawingOverlay'
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
  updatePdfDrawingAnnotation,
} from '@/services/pdf-drawing-annotations'
import type { PdfDrawingAnnotation, PdfDrawingGeometry } from '@/lib/types'

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
    setAnnotations([])

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

  const commitText = useCallback(
    async (commit: PdfDrawingTextCommit) => {
      const saved = await insertPdfDrawingAnnotation({
        doc_id: docId,
        page_num: pageNum,
        tool: 'text',
        color: commit.color,
        geometry: commit.geometry,
        text_body: commit.text_body,
      })
      recordPdfDrawingInsert(docId, saved)
      setAnnotations((previous) => [...previous, saved])
      bumpHistory()
      return saved
    },
    [bumpHistory, docId, pageNum],
  )

  const commitStamp = useCallback(
    async (commit: PdfDrawingStampCommit) => {
      const saved = await insertPdfDrawingAnnotation({
        doc_id: docId,
        page_num: pageNum,
        tool: 'stamp',
        color: commit.color,
        stroke_width: commit.stroke_width,
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

  const eraseAnnotations = useCallback(
    async (annotationIds: readonly string[]) => {
      const uniqueIds = [...new Set(annotationIds)]
      if (uniqueIds.length === 0) return 0
      let removedCount = 0
      for (const annotationId of uniqueIds) {
        const removed = await eraseAnnotation(annotationId)
        if (removed) removedCount += 1
      }
      return removedCount
    },
    [eraseAnnotation],
  )

  const moveDrawingMark = useCallback(
    async (annotationId: string, geometry: PdfDrawingGeometry) => {
      const updated = await updatePdfDrawingAnnotation({
        annotation_id: annotationId,
        geometry,
      })
      if (updated) {
        setAnnotations((previous) =>
          previous.map((annotation) =>
            annotation.annotation_id === annotationId ? updated : annotation,
          ),
        )
      }
      return updated
    },
    [],
  )

  const updateMarkVoiceNote = useCallback(
    async (annotationId: string, voiceNote: string | null | undefined) => {
      try {
        const updated = await updatePdfDrawingAnnotation({
          annotation_id: annotationId,
          voice_note: voiceNote,
        })
        if (updated) {
          setAnnotations((previous) =>
            previous.map((annotation) =>
              annotation.annotation_id === annotationId ? updated : annotation,
            ),
          )
        }
        return updated
      } catch (error) {
        console.error('[usePdfDrawingAnnotations] updateMarkVoiceNote failed', error)
        await refresh()
        return null
      }
    },
    [refresh],
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
    commitText,
    commitStamp,
    eraseAnnotation,
    eraseAnnotations,
    moveDrawingMark,
    updateMarkVoiceNote,
    undoDrawingMark,
    redoDrawingMark,
    canUndoDrawingMark: pdfDrawingCanUndo(docId),
    canRedoDrawingMark: pdfDrawingCanRedo(docId),
  }
}
