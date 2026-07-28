import type { CitationRef, DocumentMeta, ScopeCreepProfile, ScopeCreepSeverity } from '@/lib/types'
import { SCOPE_CREEP_VERDICT_LABELS } from '@/lib/types'

export type CreepHistoryEntry =
  | {
      id: string
      kind: 'separator'
      label: string
      scrollAnchor: false
    }
  | {
      id: string
      kind: 'flag'
      label: string
      sublabel: string
      severity: ScopeCreepSeverity
      citation: CitationRef
      scrollAnchor: boolean
    }

function documentLabel(documents: DocumentMeta[], docId: string): string {
  const match = documents.find((doc) => doc.doc_id === docId)
  if (!match) return docId
  return match.filename.replace(/\.[^.]+$/, '')
}

/** Flatten creep profiles into MessageScroller marker rows for the History tab */
export function flattenCreepHistory(
  profiles: ScopeCreepProfile[],
  documents: DocumentMeta[],
): CreepHistoryEntry[] {
  const entries: CreepHistoryEntry[] = []
  let anchorAssigned = false

  for (const profile of profiles) {
    entries.push({
      id: `history-sep-${profile.profile_id}`,
      kind: 'separator',
      label: `${SCOPE_CREEP_VERDICT_LABELS[profile.verdict]} · ${documentLabel(documents, profile.baseline_doc_id)} vs ${documentLabel(documents, profile.candidate_doc_id)}`,
      scrollAnchor: false,
    })

    for (const flag of profile.flags) {
      const citation = flag.evidence[0]
      if (!citation) continue

      const scrollAnchor = !anchorAssigned
      if (scrollAnchor) {
        anchorAssigned = true
      }

      entries.push({
        id: `history-flag-${profile.profile_id}-${flag.id}`,
        kind: 'flag',
        label: flag.summary,
        sublabel: `${flag.flag_type.replace(/_/g, ' ')} · ${flag.severity}`,
        severity: flag.severity,
        citation,
        scrollAnchor,
      })
    }
  }

  return entries
}
