/**
 * PDF drawing markup persistence (BDA-220+).
 * CRUD and harnesses land in BDA-223.
 */

import type {
  PdfDrawingAnnotation,
  PdfDrawingAnnotationRecord,
  PdfDrawingGeometry,
} from '@/lib/types'

export type { PdfDrawingAnnotation, PdfDrawingAnnotationRecord, PdfDrawingGeometry }

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
