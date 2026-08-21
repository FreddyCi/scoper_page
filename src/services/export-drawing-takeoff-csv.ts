import { aggregateDrawingTakeoff } from '@/lib/drawing-takeoff'
import { beginBlobSave } from '@/lib/download-blob'
import type { PdfDrawingAnnotation } from '@/lib/types'

export type ExportDrawingTakeoffCsvInput = {
  baselineFilename?: string
  annotations: PdfDrawingAnnotation[]
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function csvRow(cells: string[]): string {
  return cells.map(escapeCsvField).join(',')
}

/** Pure CSV builder for stamp takeoff export (BDA-272). */
export function buildDrawingTakeoffCsv(input: ExportDrawingTakeoffCsvInput): string {
  const rows = aggregateDrawingTakeoff(input.annotations)
  const header = ['mark', 'color', 'page', 'voice note', 'count']
  const body = rows.map((row) =>
    csvRow([
      row.label,
      row.color,
      String(row.page),
      row.voiceNote,
      String(row.count),
    ]),
  )
  return [csvRow(header), ...body].join('\n')
}

export function drawingTakeoffCsvFilename(baselineFilename?: string): string {
  const stem =
    (baselineFilename ?? 'drawing')
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'drawing'
  return `${stem}-stamp-takeoff.csv`
}

export async function downloadDrawingTakeoffCsv(
  input: ExportDrawingTakeoffCsvInput,
): Promise<void> {
  const csv = buildDrawingTakeoffCsv(input)
  const writeBlob = await beginBlobSave({
    filename: drawingTakeoffCsvFilename(input.baselineFilename),
    mime: 'text/csv',
    extension: '.csv',
  })
  await writeBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

/** Dev harness — CSV contains stamp label + page (BDA-272). */
export function runExportDrawingTakeoffCsvHarness(): void {
  const csv = buildDrawingTakeoffCsv({
    baselineFilename: 'Windows_Drawing.pdf',
    annotations: [
      {
        annotation_id: 'stamp-harness-a',
        doc_id: 'doc-harness',
        page_num: 2,
        tool: 'stamp',
        color: '#E11D48',
        geometry: { kind: 'stamp', x: 0.4, y: 0.5, stampKind: 'window' },
        author_initials: 'TH',
        created_at: new Date().toISOString(),
      },
      {
        annotation_id: 'stamp-harness-b',
        doc_id: 'doc-harness',
        page_num: 2,
        tool: 'stamp',
        color: '#E11D48',
        geometry: { kind: 'stamp', x: 0.6, y: 0.5, stampKind: 'window' },
        voice_note: 'North elevation',
        author_initials: 'TH',
        created_at: new Date().toISOString(),
      },
    ],
  })

  if (!csv.includes('Window marker') || !csv.includes(',2,')) {
    throw new Error('runExportDrawingTakeoffCsvHarness: missing stamp label or page')
  }
  if (!csv.includes('North elevation') || !csv.includes(',count')) {
    throw new Error('runExportDrawingTakeoffCsvHarness: missing voiced row or header')
  }
  if (drawingTakeoffCsvFilename('Windows Drawing.pdf') !== 'Windows-Drawing-stamp-takeoff.csv') {
    throw new Error('runExportDrawingTakeoffCsvHarness: unexpected filename')
  }
}
