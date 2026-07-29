import type { DocumentMeta, ScopeCreepFlag, ScopeCreepProfile } from '@/lib/types'
import { SCOPE_CREEP_VERDICT_LABELS } from '@/lib/types'

export type CreepHistoryFlagEntry = {
  id: string
  flag: ScopeCreepFlag
  scrollAnchor: boolean
}

export type CreepHistoryGroup = {
  id: string
  label: string
  flags: CreepHistoryFlagEntry[]
}

function documentLabel(documents: DocumentMeta[], docId: string): string {
  const match = documents.find((doc) => doc.doc_id === docId)
  if (!match) return docId
  return match.filename.replace(/\.[^.]+$/, '')
}

/** Group creep profiles into labeled sections for the History tab */
export function groupCreepHistory(
  profiles: ScopeCreepProfile[],
  documents: DocumentMeta[],
): CreepHistoryGroup[] {
  const groups: CreepHistoryGroup[] = []
  let anchorAssigned = false

  for (const profile of profiles) {
    const flags: CreepHistoryFlagEntry[] = []

    for (const flag of profile.flags) {
      const citation = flag.evidence[0]
      if (!citation) continue

      const scrollAnchor = !anchorAssigned
      if (scrollAnchor) {
        anchorAssigned = true
      }

      flags.push({
        id: `history-flag-${profile.profile_id}-${flag.id}`,
        flag,
        scrollAnchor,
      })
    }

    if (flags.length === 0) continue

    groups.push({
      id: `history-group-${profile.profile_id}`,
      label: `${SCOPE_CREEP_VERDICT_LABELS[profile.verdict]} · ${documentLabel(documents, profile.baseline_doc_id)} vs ${documentLabel(documents, profile.candidate_doc_id)}`,
      flags,
    })
  }

  return groups
}

/** @deprecated Use groupCreepHistory — kept for dev harness compatibility */
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
      severity: ScopeCreepFlag['severity']
      citation: NonNullable<ScopeCreepFlag['evidence'][number]>
      scrollAnchor: boolean
    }

/** Flatten grouped history for legacy callers (dev harness) */
export function flattenCreepHistory(
  profiles: ScopeCreepProfile[],
  documents: DocumentMeta[],
): CreepHistoryEntry[] {
  const entries: CreepHistoryEntry[] = []

  for (const group of groupCreepHistory(profiles, documents)) {
    entries.push({
      id: group.id.replace('history-group-', 'history-sep-'),
      kind: 'separator',
      label: group.label,
      scrollAnchor: false,
    })

    for (const { id, flag, scrollAnchor } of group.flags) {
      const citation = flag.evidence[0]
      if (!citation) continue

      entries.push({
        id,
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
