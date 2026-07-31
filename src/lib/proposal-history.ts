import type { ProposalRequirementsProfile, ProposalVolumeStatus } from '@/lib/types'

export type ProposalVolumeHistoryEntry = {
  id: string
  title: string
  statusLabel: string
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
  return profile.volumes.map((volume, index) => ({
    id: volume.id,
    title: volume.title,
    statusLabel: STATUS_LABELS[volume.status],
    scrollAnchor: index === lastIndex,
  }))
}
