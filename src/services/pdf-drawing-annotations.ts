/**
 * PDF drawing markup persistence (BDA-220–223).
 */

import { reviewerInitialsFromName } from '@/lib/reviewer-profile'
import type {
  PdfDrawingAnnotation,
  PdfDrawingAnnotationRecord,
  PdfDrawingGeometry,
  PdfDrawingTool,
} from '@/lib/types'
import { getDuckdbClient } from '@/services/duckdb-client'
import { useSessionStore } from '@/store/session-store'

export type { PdfDrawingAnnotation, PdfDrawingAnnotationRecord, PdfDrawingGeometry }

const PDF_DRAWING_ANNOTATION_COLUMNS = [
  'annotation_id',
  'doc_id',
  'page_num',
  'tool',
  'color',
  'stroke_width',
  'opacity',
  'geometry_json',
  'text_body',
  'author_initials',
  'created_at',
  'updated_at',
] as const

const SELECT_PDF_DRAWING_ANNOTATION = `SELECT annotation_id, doc_id, page_num, tool, color, stroke_width, opacity,
       geometry_json, text_body, author_initials, created_at, updated_at
FROM pdf_drawing_annotations`

const GEOMETRY_KINDS = new Set<PdfDrawingGeometry['kind']>([
  'stroke',
  'rect',
  'ellipse',
  'text',
  'stamp',
])

type PdfDrawingAnnotationRow = {
  annotation_id: string
  doc_id: string
  page_num: number
  tool: PdfDrawingTool
  color: string
  stroke_width: number | null
  opacity: number | null
  geometry_json: string
  text_body: string | null
  author_initials: string | null
  created_at: string
  updated_at: string | null
}

export type InsertPdfDrawingAnnotationInput = {
  doc_id: string
  page_num: number
  tool: PdfDrawingTool
  color: string
  geometry: PdfDrawingGeometry
  stroke_width?: number
  opacity?: number
  text_body?: string
  authorInitials?: string
}

export type UpdatePdfDrawingAnnotationInput = {
  annotation_id: string
  tool?: PdfDrawingTool
  color?: string
  stroke_width?: number | null
  opacity?: number | null
  geometry?: PdfDrawingGeometry
  text_body?: string | null
}

function resolveAuthorInitials(override?: string): string {
  if (override?.trim()) {
    return reviewerInitialsFromName(override.trim())
  }
  return reviewerInitialsFromName(useSessionStore.getState().reviewerName)
}

export function parsePdfDrawingGeometry(json: string): PdfDrawingGeometry {
  const value = JSON.parse(json) as PdfDrawingGeometry
  if (
    !value ||
    typeof value !== 'object' ||
    !('kind' in value) ||
    typeof value.kind !== 'string' ||
    !GEOMETRY_KINDS.has(value.kind as PdfDrawingGeometry['kind'])
  ) {
    throw new Error('Invalid pdf drawing geometry JSON')
  }
  return value
}

export function serializePdfDrawingGeometry(geometry: PdfDrawingGeometry): string {
  return JSON.stringify(geometry)
}

function normalizeRow(row: PdfDrawingAnnotationRow): PdfDrawingAnnotationRecord {
  return {
    annotation_id: row.annotation_id,
    doc_id: row.doc_id,
    page_num: row.page_num,
    tool: row.tool,
    color: row.color,
    stroke_width: row.stroke_width ?? undefined,
    opacity: row.opacity ?? undefined,
    geometry_json: row.geometry_json,
    text_body: row.text_body ?? undefined,
    author_initials: row.author_initials?.trim() || '?',
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

export function pdfDrawingAnnotationFromRecord(
  row: PdfDrawingAnnotationRecord,
): PdfDrawingAnnotation {
  const { geometry_json, ...rest } = row
  return {
    ...rest,
    geometry: parsePdfDrawingGeometry(geometry_json),
  }
}

export function pdfDrawingAnnotationToRecord(
  annotation: PdfDrawingAnnotation,
): PdfDrawingAnnotationRecord {
  const { geometry, ...rest } = annotation
  return {
    ...rest,
    geometry_json: serializePdfDrawingGeometry(geometry),
  }
}

function rowInsertParams(row: PdfDrawingAnnotationRecord): unknown[] {
  return [
    row.annotation_id,
    row.doc_id,
    row.page_num,
    row.tool,
    row.color,
    row.stroke_width ?? null,
    row.opacity ?? null,
    row.geometry_json,
    row.text_body ?? null,
    row.author_initials,
    row.created_at,
    row.updated_at ?? null,
  ]
}

async function insertAnnotationRecord(row: PdfDrawingAnnotationRecord): Promise<void> {
  const duckdb = await getDuckdbClient()
  await duckdb.query(
    `INSERT INTO pdf_drawing_annotations (
      annotation_id, doc_id, page_num, tool, color, stroke_width, opacity,
      geometry_json, text_body, author_initials, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rowInsertParams(row),
  )
}

function mapRowsToAnnotations(rows: PdfDrawingAnnotationRow[]): PdfDrawingAnnotation[] {
  return rows.map((row) => pdfDrawingAnnotationFromRecord(normalizeRow(row)))
}

/** Persist a drawing markup annotation (BDA-223). */
export async function insertPdfDrawingAnnotation(
  input: InsertPdfDrawingAnnotationInput,
): Promise<PdfDrawingAnnotation> {
  if (input.page_num < 1) {
    throw new Error('insertPdfDrawingAnnotation: page_num must be >= 1')
  }

  const created_at = new Date().toISOString()
  const annotation: PdfDrawingAnnotation = {
    annotation_id: `pdf-draw-${crypto.randomUUID()}`,
    doc_id: input.doc_id,
    page_num: input.page_num,
    tool: input.tool,
    color: input.color,
    stroke_width: input.stroke_width,
    opacity: input.opacity,
    geometry: input.geometry,
    text_body: input.text_body?.trim() || undefined,
    author_initials: resolveAuthorInitials(input.authorInitials),
    created_at,
  }

  await insertAnnotationRecord(pdfDrawingAnnotationToRecord(annotation))
  return annotation
}

/** Update mutable fields on an existing annotation. */
export async function updatePdfDrawingAnnotation(
  input: UpdatePdfDrawingAnnotationInput,
): Promise<PdfDrawingAnnotation | null> {
  const existing = await fetchPdfDrawingAnnotationById(input.annotation_id)
  if (!existing) return null

  const updated: PdfDrawingAnnotation = {
    ...existing,
    tool: input.tool ?? existing.tool,
    color: input.color ?? existing.color,
    stroke_width:
      input.stroke_width !== undefined ? input.stroke_width ?? undefined : existing.stroke_width,
    opacity: input.opacity !== undefined ? input.opacity ?? undefined : existing.opacity,
    geometry: input.geometry ?? existing.geometry,
    text_body:
      input.text_body !== undefined ? input.text_body?.trim() || undefined : existing.text_body,
    updated_at: new Date().toISOString(),
  }

  const row = pdfDrawingAnnotationToRecord(updated)
  const duckdb = await getDuckdbClient()
  await duckdb.query(
    `UPDATE pdf_drawing_annotations
     SET tool = ?, color = ?, stroke_width = ?, opacity = ?,
         geometry_json = ?, text_body = ?, updated_at = ?
     WHERE annotation_id = ?`,
    [
      row.tool,
      row.color,
      row.stroke_width ?? null,
      row.opacity ?? null,
      row.geometry_json,
      row.text_body ?? null,
      row.updated_at ?? null,
      row.annotation_id,
    ],
  )

  return updated
}

/** Delete one annotation by id. Returns true if a row was removed. */
export async function deletePdfDrawingAnnotation(annotationId: string): Promise<boolean> {
  const existing = await fetchPdfDrawingAnnotationById(annotationId)
  if (!existing) return false

  const duckdb = await getDuckdbClient()
  await duckdb.query('DELETE FROM pdf_drawing_annotations WHERE annotation_id = ?', [
    annotationId,
  ])
  return true
}

/** Re-insert a previously removed annotation with the same id (undo delete / redo insert). */
export async function restorePdfDrawingAnnotation(
  annotation: PdfDrawingAnnotation,
): Promise<PdfDrawingAnnotation> {
  const existing = await fetchPdfDrawingAnnotationById(annotation.annotation_id)
  if (existing) return existing

  await insertAnnotationRecord(pdfDrawingAnnotationToRecord(annotation))
  return annotation
}

export async function fetchPdfDrawingAnnotationById(
  annotationId: string,
): Promise<PdfDrawingAnnotation | null> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<PdfDrawingAnnotationRow>(
    `${SELECT_PDF_DRAWING_ANNOTATION} WHERE annotation_id = ?`,
    [annotationId],
  )
  if (rows.length === 0) return null
  return pdfDrawingAnnotationFromRecord(normalizeRow(rows[0]!))
}

/** All drawing annotations for a document, ordered by page then creation time. */
export async function fetchPdfDrawingAnnotationsForDoc(
  docId: string,
): Promise<PdfDrawingAnnotation[]> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<PdfDrawingAnnotationRow>(
    `${SELECT_PDF_DRAWING_ANNOTATION}
     WHERE doc_id = ?
     ORDER BY page_num ASC, created_at ASC, annotation_id ASC`,
    [docId],
  )
  return mapRowsToAnnotations(rows)
}

/** Drawing annotations for one page of a document. */
export async function fetchPdfDrawingAnnotationsForPage(
  docId: string,
  pageNum: number,
): Promise<PdfDrawingAnnotation[]> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<PdfDrawingAnnotationRow>(
    `${SELECT_PDF_DRAWING_ANNOTATION}
     WHERE doc_id = ? AND page_num = ?
     ORDER BY created_at ASC, annotation_id ASC`,
    [docId, pageNum],
  )
  return mapRowsToAnnotations(rows)
}

/** Verify `pdf_drawing_annotations` exists and accepts rows (BDA-221). */
export async function runPdfDrawingAnnotationsSchemaHarness(): Promise<void> {
  const duckdb = await getDuckdbClient()
  const describeRows = await duckdb.query<{ column_name: string }>(
    'DESCRIBE pdf_drawing_annotations',
  )
  const columnNames = new Set(describeRows.map((row) => row.column_name))
  for (const column of PDF_DRAWING_ANNOTATION_COLUMNS) {
    if (!columnNames.has(column)) {
      throw new Error(
        `runPdfDrawingAnnotationsSchemaHarness failed: missing column ${column}`,
      )
    }
  }

  const saved = await insertPdfDrawingAnnotation({
    doc_id: 'doc-schema-harness',
    page_num: 1,
    tool: 'pen',
    color: '#F59E0B',
    stroke_width: 4,
    opacity: 1,
    geometry: { kind: 'stroke', points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }] },
    authorInitials: 'Harness Reviewer',
  })

  const roundTrip = await fetchPdfDrawingAnnotationById(saved.annotation_id)
  if (
    !roundTrip ||
    roundTrip.geometry.kind !== 'stroke' ||
    roundTrip.geometry.points.length !== 2
  ) {
    throw new Error('runPdfDrawingAnnotationsSchemaHarness failed: geometry round-trip mismatch')
  }

  await deletePdfDrawingAnnotation(saved.annotation_id)
}

/** Dev harness — create → list → update → delete (BDA-223). */
export async function runPdfDrawingAnnotationsCrudHarness(): Promise<void> {
  useSessionStore.getState().setReviewerName('Harness Reviewer')

  const docId = 'pdf-draw-crud-harness-doc'
  const duckdb = await getDuckdbClient()
  await duckdb.query('DELETE FROM pdf_drawing_annotations WHERE doc_id = ?', [docId])

  const strokeA = await insertPdfDrawingAnnotation({
    doc_id: docId,
    page_num: 1,
    tool: 'pen',
    color: '#F59E0B',
    stroke_width: 4,
    geometry: { kind: 'stroke', points: [{ x: 0.1, y: 0.1 }] },
  })
  if (strokeA.author_initials !== 'HR') {
    throw new Error('runPdfDrawingAnnotationsCrudHarness failed: expected author initials HR')
  }

  await insertPdfDrawingAnnotation({
    doc_id: docId,
    page_num: 2,
    tool: 'highlighter',
    color: '#E11D48',
    opacity: 0.35,
    geometry: { kind: 'stroke', points: [{ x: 0.2, y: 0.2 }] },
  })

  const docAnnotations = await fetchPdfDrawingAnnotationsForDoc(docId)
  if (docAnnotations.length !== 2) {
    throw new Error('runPdfDrawingAnnotationsCrudHarness failed: expected 2 doc annotations')
  }

  const pageOne = await fetchPdfDrawingAnnotationsForPage(docId, 1)
  if (pageOne.length !== 1 || pageOne[0]!.annotation_id !== strokeA.annotation_id) {
    throw new Error('runPdfDrawingAnnotationsCrudHarness failed: page-scoped list mismatch')
  }

  const updated = await updatePdfDrawingAnnotation({
    annotation_id: strokeA.annotation_id,
    color: '#0EA5E9',
  })
  if (!updated || updated.color !== '#0EA5E9') {
    throw new Error('runPdfDrawingAnnotationsCrudHarness failed: update color')
  }

  const reloaded = await fetchPdfDrawingAnnotationById(strokeA.annotation_id)
  if (!reloaded?.updated_at) {
    throw new Error('runPdfDrawingAnnotationsCrudHarness failed: expected updated_at after update')
  }

  const deleted = await deletePdfDrawingAnnotation(strokeA.annotation_id)
  if (!deleted) {
    throw new Error('runPdfDrawingAnnotationsCrudHarness failed: delete stroke A')
  }

  const remaining = await fetchPdfDrawingAnnotationsForDoc(docId)
  if (remaining.length !== 1 || remaining[0]!.page_num !== 2) {
    throw new Error('runPdfDrawingAnnotationsCrudHarness failed: expected one page-2 annotation')
  }

  await duckdb.query('DELETE FROM pdf_drawing_annotations WHERE doc_id = ?', [docId])
}

/** Dev harness — undo/redo stack (BDA-227). */
export async function runPdfDrawingAnnotationsUndoHarness(): Promise<void> {
  useSessionStore.getState().setReviewerName('Harness Reviewer')

  const docId = 'pdf-draw-undo-harness-doc'
  const duckdb = await getDuckdbClient()
  await duckdb.query('DELETE FROM pdf_drawing_annotations WHERE doc_id = ?', [docId])

  const {
    clearPdfDrawingHistory,
    pdfDrawingCanRedo,
    pdfDrawingCanUndo,
    recordPdfDrawingInsert,
    undoPdfDrawingHistory,
    redoPdfDrawingHistory,
    PDF_DRAWING_UNDO_MAX,
    pdfDrawingUndoDepth,
  } = await import('@/lib/pdf-drawing-history')

  clearPdfDrawingHistory(docId)

  const handlers = {
    undoInsert: async (annotation) => {
      await deletePdfDrawingAnnotation(annotation.annotation_id)
    },
    undoDelete: async (annotation) => {
      await restorePdfDrawingAnnotation(annotation)
    },
    redoInsert: async (annotation) => {
      await restorePdfDrawingAnnotation(annotation)
    },
    redoDelete: async (annotation) => {
      await deletePdfDrawingAnnotation(annotation.annotation_id)
    },
  }

  for (let index = 0; index < 3; index += 1) {
    const saved = await insertPdfDrawingAnnotation({
      doc_id: docId,
      page_num: 1,
      tool: 'pen',
      color: '#F59E0B',
      stroke_width: 4,
      geometry: {
        kind: 'stroke',
        points: [{ x: 0.1 + index * 0.05, y: 0.1 }],
      },
    })
    recordPdfDrawingInsert(docId, saved)
  }

  if (pdfDrawingUndoDepth(docId) !== 3) {
    throw new Error('runPdfDrawingAnnotationsUndoHarness failed: undo depth after 3 inserts')
  }

  await undoPdfDrawingHistory(docId, handlers)
  await undoPdfDrawingHistory(docId, handlers)
  const afterUndo = await fetchPdfDrawingAnnotationsForDoc(docId)
  if (afterUndo.length !== 1 || !pdfDrawingCanUndo(docId)) {
    throw new Error('runPdfDrawingAnnotationsUndoHarness failed: expected 1 row after 2 undos')
  }

  await redoPdfDrawingHistory(docId, handlers)
  if ((await fetchPdfDrawingAnnotationsForDoc(docId)).length !== 2) {
    throw new Error('runPdfDrawingAnnotationsUndoHarness failed: expected 2 rows after redo')
  }

  if (!pdfDrawingCanRedo(docId)) {
    throw new Error('runPdfDrawingAnnotationsUndoHarness failed: expected redo available')
  }

  for (let index = 0; index < PDF_DRAWING_UNDO_MAX + 5; index += 1) {
    const saved = await insertPdfDrawingAnnotation({
      doc_id: docId,
      page_num: 1,
      tool: 'pen',
      color: '#000',
      geometry: { kind: 'stroke', points: [{ x: 0.01 * index, y: 0.02 }] },
    })
    recordPdfDrawingInsert(docId, saved)
  }
  if (pdfDrawingUndoDepth(docId) > PDF_DRAWING_UNDO_MAX) {
    throw new Error('runPdfDrawingAnnotationsUndoHarness failed: undo stack cap exceeded')
  }

  clearPdfDrawingHistory(docId)
  await duckdb.query('DELETE FROM pdf_drawing_annotations WHERE doc_id = ?', [docId])
}
