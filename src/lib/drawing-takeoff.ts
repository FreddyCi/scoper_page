import type { PdfDrawingAnnotation, PdfDrawingGeometry } from '@/lib/types'

export type DrawingTakeoffRow = {
  label: string
  color: string
  page: number
  voiceNote: string
  count: number
  annotationIds: string[]
}

export type AggregateDrawingTakeoffOptions = {
  kinds?: PdfDrawingGeometry['kind'][]
}

/** Human-readable label for a drawing mark (shared by voice panel, PDF export, takeoff). */
export function markKindLabel(annotation: PdfDrawingAnnotation): string {
  switch (annotation.geometry.kind) {
    case 'stamp':
      return 'Window marker'
    case 'text':
      return annotation.text_body?.trim() || 'Text label'
    case 'rect':
      return 'Rectangle'
    case 'ellipse':
      return 'Ellipse'
    case 'stroke':
      return annotation.tool === 'highlighter' ? 'Highlight' : 'Stroke'
    default:
      return 'Mark'
  }
}

function takeoffGroupKey(annotation: PdfDrawingAnnotation): string {
  const voiceNote = annotation.voice_note?.trim() ?? ''
  return [
    markKindLabel(annotation),
    annotation.color.toLowerCase(),
    String(annotation.page_num),
    voiceNote,
  ].join('::')
}

/**
 * Group doc-wide drawing marks for stamp takeoff.
 * Default: stamps only. Rows include label, color, page, voice note, and count.
 */
export function aggregateDrawingTakeoff(
  annotations: PdfDrawingAnnotation[],
  options: AggregateDrawingTakeoffOptions = {},
): DrawingTakeoffRow[] {
  const kinds = options.kinds ?? ['stamp']
  const kindSet = new Set<PdfDrawingGeometry['kind']>(kinds)
  const groups = new Map<string, DrawingTakeoffRow>()

  for (const annotation of annotations) {
    if (!kindSet.has(annotation.geometry.kind)) continue
    const key = takeoffGroupKey(annotation)
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      existing.annotationIds.push(annotation.annotation_id)
      continue
    }
    groups.set(key, {
      label: markKindLabel(annotation),
      color: annotation.color,
      page: annotation.page_num,
      voiceNote: annotation.voice_note?.trim() ?? '',
      count: 1,
      annotationIds: [annotation.annotation_id],
    })
  }

  return [...groups.values()].sort((left, right) => {
    if (left.page !== right.page) return left.page - right.page
    if (left.label !== right.label) return left.label.localeCompare(right.label)
    return left.voiceNote.localeCompare(right.voiceNote)
  })
}

function stampAnnotation(
  annotation_id: string,
  page_num: number,
  color: string,
  voice_note?: string,
): PdfDrawingAnnotation {
  return {
    annotation_id,
    doc_id: 'takeoff-harness-doc',
    page_num,
    tool: 'stamp',
    color,
    geometry: { kind: 'stamp', x: 0.5, y: 0.5, stampKind: 'window' },
    author_initials: 'TH',
    created_at: new Date().toISOString(),
    ...(voice_note ? { voice_note } : {}),
  }
}

/** Dev harness — grouped stamp counts, pages, and voice notes (BDA-270). */
export function runDrawingTakeoffHarness(): void {
  const rows = aggregateDrawingTakeoff([
    stampAnnotation('stamp-a', 1, '#E11D48'),
    stampAnnotation('stamp-b', 1, '#E11D48'),
    stampAnnotation('stamp-c', 1, '#E11D48', 'North elevation glazing'),
  ])

  const grouped = rows.find((row) => row.count === 2 && row.voiceNote === '')
  if (!grouped || grouped.page !== 1 || grouped.label !== 'Window marker') {
    throw new Error('runDrawingTakeoffHarness: expected two window stamps grouped on page 1')
  }

  const noted = rows.find((row) => row.voiceNote.includes('North elevation'))
  if (!noted || noted.count !== 1) {
    throw new Error('runDrawingTakeoffHarness: expected separate row for voiced stamp')
  }

  if (markKindLabel(stampAnnotation('x', 1, '#000')) !== 'Window marker') {
    throw new Error('runDrawingTakeoffHarness: markKindLabel stamp mismatch')
  }

  const stroke = aggregateDrawingTakeoff(
    [
      {
        ...stampAnnotation('stroke-a', 2, '#F59E0B'),
        tool: 'pen',
        geometry: { kind: 'stroke', points: [{ x: 0.1, y: 0.2 }] },
      },
    ],
    { kinds: ['stamp'] },
  )
  if (stroke.length !== 0) {
    throw new Error('runDrawingTakeoffHarness: default filter should exclude strokes')
  }
}
