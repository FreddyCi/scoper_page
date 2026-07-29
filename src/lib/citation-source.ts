import type { DocumentMeta } from '@/lib/types'

export type CitationSourceKind = 'rfp' | 'context' | 'bidder' | 'document'

export type CitationSourceStyle = {
  kind: CitationSourceKind
  label: string
  chipClass: string
  legendClass: string
}

const SOURCE_STYLES: Record<CitationSourceKind, CitationSourceStyle> = {
  rfp: {
    kind: 'rfp',
    label: 'RFP',
    chipClass:
      'border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100',
    legendClass: 'text-sky-800',
  },
  context: {
    kind: 'context',
    label: 'Context',
    chipClass:
      'border-violet-300 bg-violet-50 text-violet-950 hover:bg-violet-100',
    legendClass: 'text-violet-800',
  },
  bidder: {
    kind: 'bidder',
    label: 'Bidder',
    chipClass:
      'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100',
    legendClass: 'text-amber-900',
  },
  document: {
    kind: 'document',
    label: 'Document',
    chipClass:
      'border-border bg-muted/60 text-foreground hover:bg-muted',
    legendClass: 'text-muted-foreground',
  },
}

export function classifyCitationSource(
  docId: string,
  documents: DocumentMeta[],
  evaluationDocId: string | null,
): CitationSourceKind {
  const doc = documents.find((item) => item.doc_id === docId)
  if (!doc) return 'document'

  if (doc.doc_id === evaluationDocId || doc.role === 'baseline') {
    return 'rfp'
  }

  if (doc.role === 'supporting' || doc.mime === 'text/markdown') {
    return 'context'
  }

  if (doc.role === 'change_request') {
    return 'document'
  }

  if (doc.role === 'unknown' || doc.mime === 'application/pdf') {
    return 'bidder'
  }

  return 'document'
}

export function citationSourceStyle(
  docId: string,
  documents: DocumentMeta[],
  evaluationDocId: string | null,
): CitationSourceStyle {
  return SOURCE_STYLES[classifyCitationSource(docId, documents, evaluationDocId)]
}

export function citationSourceLegend(): CitationSourceStyle[] {
  return [SOURCE_STYLES.rfp, SOURCE_STYLES.context, SOURCE_STYLES.bidder]
}
