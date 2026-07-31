import type {
  ProposalVolume,
  ProposalVolumeGenerationProgress,
  ProposalVolumeSection,
} from '@/lib/types'

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
}
