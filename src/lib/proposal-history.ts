import type { ProposalRequirementsProfile, ProposalVolumeStatus } from '@/lib/types'
import { formatVolumeSectionProgressLine } from '@/lib/proposal-volume-section'

export type ProposalVolumeHistoryEntry = {
  id: string
  title: string
  statusLabel: string
  /** Active sectional progress while volume is generating (BDA-168). */
  sectionSubtitle?: string
  scrollAnchor: boolean
}

const STATUS_LABELS: Record<ProposalVolumeStatus, string> = {
  pending: 'Pending',
  generating: 'Generating',
  draft: 'Draft ready',
  error: 'Error',
}

/** Proposal mode history tab rows — latest volume anchors scroll (BDA-125) */
export function listProposalVolumeHistory(
  profile: ProposalRequirementsProfile | null,
): ProposalVolumeHistoryEntry[] {
  if (!profile?.volumes.length) return []

  const lastIndex = profile.volumes.length - 1
  return profile.volumes.map((volume, index) => {
    const sectionSubtitle =
      volume.status === 'generating' ? formatVolumeSectionProgressLine(volume) ?? undefined : undefined

    return {
      id: volume.id,
      title: volume.title,
      statusLabel: STATUS_LABELS[volume.status],
      sectionSubtitle,
      scrollAnchor: index === lastIndex,
    }
  })
}

/** Dev harness — volume history rows + sectional subtitles (BDA-168) */
export function runProposalHistoryHarness(): void {
  const profile: ProposalRequirementsProfile = {
    profile_id: 'hist-sec',
    rfp_doc_id: 'rfp-1',
    summary: 'Harness',
    built_at: new Date().toISOString(),
    packageKind: 'solicitation',
    packageWarnings: [],
    volumes: [
      {
        id: 'vol-1',
        title: 'Technical approach',
        requirementSummary: 'Methodology.',
        status: 'generating',
        sections: [
          {
            id: 's1',
            title: 'Methodology',
            findClauseQuery: 'methodology',
            status: 'draft',
          },
          {
            id: 's2',
            title: 'Insurance',
            findClauseQuery: 'insurance',
            status: 'generating',
          },
        ],
        generationProgress: {
          completedSections: 1,
          totalSections: 2,
          activeSectionId: 's2',
        },
      },
    ],
  }

  const entries = listProposalVolumeHistory(profile)
  if (entries.length !== 1) {
    throw new Error('runProposalHistoryHarness: expected one volume entry')
  }
  if (!entries[0]!.sectionSubtitle?.includes('Insurance')) {
    throw new Error(`runProposalHistoryHarness: missing section subtitle "${entries[0]!.sectionSubtitle}"`)
  }
  if (entries[0]!.statusLabel !== 'Generating') {
    throw new Error('runProposalHistoryHarness: expected generating status label')
  }
}
