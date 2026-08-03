import type { PdfDrawingAnnotation } from '@/lib/types'

export const PDF_DRAWING_UNDO_MAX = 50

export type PdfDrawingHistoryOp =
  | { kind: 'insert'; annotation: PdfDrawingAnnotation }
  | { kind: 'delete'; annotation: PdfDrawingAnnotation }

type DocHistoryStacks = {
  undo: PdfDrawingHistoryOp[]
  redo: PdfDrawingHistoryOp[]
}

const stacksByDoc = new Map<string, DocHistoryStacks>()

function getStacks(docId: string): DocHistoryStacks {
  let stacks = stacksByDoc.get(docId)
  if (!stacks) {
    stacks = { undo: [], redo: [] }
    stacksByDoc.set(docId, stacks)
  }
  return stacks
}

function pushCap(stack: PdfDrawingHistoryOp[], op: PdfDrawingHistoryOp): PdfDrawingHistoryOp[] {
  const next = [...stack, op]
  if (next.length <= PDF_DRAWING_UNDO_MAX) return next
  return next.slice(next.length - PDF_DRAWING_UNDO_MAX)
}

export function clearPdfDrawingHistory(docId: string): void {
  stacksByDoc.delete(docId)
}

export function pdfDrawingCanUndo(docId: string): boolean {
  return getStacks(docId).undo.length > 0
}

export function pdfDrawingCanRedo(docId: string): boolean {
  return getStacks(docId).redo.length > 0
}

export function recordPdfDrawingInsert(
  docId: string,
  annotation: PdfDrawingAnnotation,
): void {
  const stacks = getStacks(docId)
  stacks.undo = pushCap(stacks.undo, { kind: 'insert', annotation })
  stacks.redo = []
}

export function recordPdfDrawingDelete(
  docId: string,
  annotation: PdfDrawingAnnotation,
): void {
  const stacks = getStacks(docId)
  stacks.undo = pushCap(stacks.undo, { kind: 'delete', annotation })
  stacks.redo = []
}

/** @internal Harness-only — verify undo stack cap. */
export function pdfDrawingUndoDepth(docId: string): number {
  return getStacks(docId).undo.length
}

export type PdfDrawingHistoryApplyHandlers = {
  undoInsert: (annotation: PdfDrawingAnnotation) => Promise<void>
  undoDelete: (annotation: PdfDrawingAnnotation) => Promise<void>
  redoInsert: (annotation: PdfDrawingAnnotation) => Promise<void>
  redoDelete: (annotation: PdfDrawingAnnotation) => Promise<void>
}

export async function undoPdfDrawingHistory(
  docId: string,
  handlers: PdfDrawingHistoryApplyHandlers,
): Promise<PdfDrawingHistoryOp | null> {
  const stacks = getStacks(docId)
  const op = stacks.undo.pop()
  if (!op) return null

  if (op.kind === 'insert') {
    await handlers.undoInsert(op.annotation)
  } else {
    await handlers.undoDelete(op.annotation)
  }

  stacks.redo = pushCap(stacks.redo, op)
  return op
}

export async function redoPdfDrawingHistory(
  docId: string,
  handlers: PdfDrawingHistoryApplyHandlers,
): Promise<PdfDrawingHistoryOp | null> {
  const stacks = getStacks(docId)
  const op = stacks.redo.pop()
  if (!op) return null

  if (op.kind === 'insert') {
    await handlers.redoInsert(op.annotation)
  } else {
    await handlers.redoDelete(op.annotation)
  }

  stacks.undo = pushCap(stacks.undo, op)
  return op
}
