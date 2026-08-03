/**
 * PDF drawing markup persistence (BDA-220+).
 * CRUD and harnesses land in BDA-223.
 */

import type {
  PdfDrawingAnnotation,
  PdfDrawingAnnotationRecord,
  PdfDrawingGeometry,
} from '@/lib/types'
import { getDuckdbClient } from '@/services/duckdb-client'

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

const GEOMETRY_KINDS = new Set<PdfDrawingGeometry['kind']>([
  'stroke',
  'rect',
  'ellipse',
  'text',
  'stamp',
])

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

type PdfDrawingAnnotationRow = PdfDrawingAnnotationRecord

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

  const annotation: PdfDrawingAnnotation = {
    annotation_id: `pdf-draw-harness-${crypto.randomUUID()}`,
    doc_id: 'doc-schema-harness',
    page_num: 1,
    tool: 'pen',
    color: '#F59E0B',
    stroke_width: 4,
    opacity: 1,
    geometry: { kind: 'stroke', points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }] },
    author_initials: 'HR',
    created_at: new Date().toISOString(),
  }
  const row = pdfDrawingAnnotationToRecord(annotation)

  await duckdb.query(
    `INSERT INTO pdf_drawing_annotations (
      annotation_id, doc_id, page_num, tool, color, stroke_width, opacity,
      geometry_json, text_body, author_initials, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
    ],
  )

  const loaded = await duckdb.query<PdfDrawingAnnotationRow>(
    `SELECT annotation_id, doc_id, page_num, tool, color, stroke_width, opacity,
            geometry_json, text_body, author_initials, created_at, updated_at
     FROM pdf_drawing_annotations
     WHERE annotation_id = ?`,
    [row.annotation_id],
  )
  if (loaded.length !== 1) {
    throw new Error('runPdfDrawingAnnotationsSchemaHarness failed: row not found after insert')
  }

  const roundTrip = pdfDrawingAnnotationFromRecord(loaded[0]!)
  if (roundTrip.geometry.kind !== 'stroke' || roundTrip.geometry.points.length !== 2) {
    throw new Error('runPdfDrawingAnnotationsSchemaHarness failed: geometry round-trip mismatch')
  }

  await duckdb.query('DELETE FROM pdf_drawing_annotations WHERE annotation_id = ?', [
    row.annotation_id,
  ])
}
