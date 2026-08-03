import type {
  ProposalVolume,
  ProposalVolumeGenerationProgress,
  ProposalVolumeSection,
} from '@/lib/types'

const TOC_TITLE_DOT_LEADERS = /\s*[.·…]{2,}\s*\d{0,4}\s*$/

/** Short label for UI (strip TOC dot leaders / page numbers; cap length). */
export function formatProposalSectionTitleForDisplay(
  title: string,
  maxLength = 80,
): string {
  const cleaned = title.replace(TOC_TITLE_DOT_LEADERS, '').replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) {
    return cleaned
  }
  return `${cleaned.slice(0, maxLength - 1).trim()}…`
}

/** Derive UI progress from sectional status fields. */
export function computeVolumeGenerationProgress(
  sections: ProposalVolumeSection[] | undefined,
): ProposalVolumeGenerationProgress | undefined {
  if (!sections || sections.length === 0) {
    return undefined
  }

  const totalSections = sections.length
  const completedSections = sections.filter((section) => section.status === 'draft').length
  const activeSection = sections.find((section) => section.status === 'generating')

  return {
    completedSections,
    totalSections,
    activeSectionId: activeSection?.id,
  }
}

/** Active sectional label for proposal panel status (BDA-167). */
export function formatVolumeSectionProgressLine(volume: ProposalVolume): string | null {
  const progress = volume.generationProgress
  if (!progress || progress.totalSections === 0) {
    return null
  }

  const sections = volume.sections ?? []
  const activeSection =
    (progress.activeSectionId
      ? sections.find((section) => section.id === progress.activeSectionId)
      : undefined) ?? sections.find((section) => section.status === 'generating')

  if (activeSection && volume.status === 'generating') {
    const index = Math.min(progress.completedSections + 1, progress.totalSections)
    const sectionLabel = formatProposalSectionTitleForDisplay(activeSection.title, 56)
    return `Section ${index}/${progress.totalSections} — ${sectionLabel}`
  }

  if (progress.totalSections > 1 && volume.status === 'generating') {
    const index = Math.min(progress.completedSections + 1, progress.totalSections)
    return `Section ${index}/${progress.totalSections}`
  }

  return null
}

export type ProposalProfileGenerationStatus = {
  activeVolume: ProposalVolume | undefined
  draftVolumeCount: number
  totalVolumes: number
  sectionProgressLine: string | null
  statusLine: string
}

/** Panel status while `proposalGenerating` (volume + sectional progress). */
export function summarizeProposalProfileGeneration(
  volumes: ProposalVolume[],
): ProposalProfileGenerationStatus {
  const totalVolumes = volumes.length
  const draftVolumeCount = volumes.filter((volume) => volume.status === 'draft').length
  const activeVolume = volumes.find((volume) => volume.status === 'generating')
  const sectionProgressLine = activeVolume
    ? formatVolumeSectionProgressLine(activeVolume)
    : null

  let statusLine: string
  if (activeVolume) {
    statusLine = sectionProgressLine
      ? `${activeVolume.title} · ${sectionProgressLine}`
      : `Writing “${activeVolume.title}” — ${draftVolumeCount} of ${totalVolumes} volume${
          totalVolumes === 1 ? '' : 's'
        } complete`
  } else if (proposalGeneratingFinishing(draftVolumeCount, totalVolumes)) {
    statusLine = `Finishing proposal — ${draftVolumeCount} of ${totalVolumes} volume${
      totalVolumes === 1 ? '' : 's'
    } complete`
  } else {
    statusLine = `${draftVolumeCount} of ${totalVolumes} volume${totalVolumes === 1 ? '' : 's'} complete`
  }

  return {
    activeVolume,
    draftVolumeCount,
    totalVolumes,
    sectionProgressLine,
    statusLine,
  }
}

function proposalGeneratingFinishing(draftVolumeCount: number, totalVolumes: number): boolean {
  return draftVolumeCount > 0 && draftVolumeCount < totalVolumes
}

/** Dev harness — sectional types compile and progress helper (BDA-160) */
export function runProposalVolumeSectionTypesHarness(): void {
  const section: ProposalVolumeSection = {
    id: 'sec-insurance',
    title: 'Insurance',
    findClauseQuery: 'insurance bonding requirements compliance',
    status: 'generating',
  }

  const volume: ProposalVolume = {
    id: 'vol-1',
    title: 'Technical approach',
    requirementSummary: 'Methodology per Section L.',
    status: 'generating',
    sections: [
      section,
      {
        id: 'sec-staffing',
        title: 'Staffing plan',
        findClauseQuery: 'staffing key personnel',
        status: 'draft',
        bodyMarkdown: '## Staffing\n\nDedicated PM assigned.',
      },
    ],
    generationProgress: { completedSections: 1, totalSections: 2, activeSectionId: section.id },
  }

  const computed = computeVolumeGenerationProgress(volume.sections)
  if (!computed || computed.totalSections !== 2 || computed.completedSections !== 1) {
    throw new Error('runProposalVolumeSectionTypesHarness: progress computation mismatch')
  }
  if (computed.activeSectionId !== 'sec-insurance') {
    throw new Error('runProposalVolumeSectionTypesHarness: expected active section id')
  }

  const line = formatVolumeSectionProgressLine(volume)
  if (line !== 'Section 2/2 — Insurance') {
    throw new Error(`runProposalVolumeSectionTypesHarness: unexpected progress line "${line}"`)
  }

  const longTitleVolume: ProposalVolume = {
    ...volume,
    sections: [
      {
        ...section,
        title:
          'ENTIRE AGREEMENT; INVESTIGATION; PRIME CONTRACT; DEFINITIONS ............ 3',
      },
    ],
  }
  const longLine = formatVolumeSectionProgressLine(longTitleVolume)
  if (!longLine?.startsWith('Section 2/2 — ENTIRE AGREEMENT')) {
    throw new Error('runProposalVolumeSectionTypesHarness: long section title should compact')
  }
  if (longLine.includes('............')) {
    throw new Error('runProposalVolumeSectionTypesHarness: progress line should strip dot leaders')
  }

  const summary = summarizeProposalProfileGeneration([volume])
  if (!summary.statusLine.includes('Section 2/2') || !summary.statusLine.includes('Insurance')) {
    throw new Error(`runProposalVolumeSectionTypesHarness: bad status line "${summary.statusLine}"`)
  }
}
