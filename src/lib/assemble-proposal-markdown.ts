import type { ProposalRequirementsProfile } from '@/lib/types'
import { canExportProposalProfile } from '@/lib/proposal-export-quality'

export type AssembleProposalMarkdownOptions = {
  rfpFilename?: string
}

/** Single downloadable markdown file from all volume drafts (BDA-135). */
export function assembleProposalMarkdown(
  profile: ProposalRequirementsProfile,
  options: AssembleProposalMarkdownOptions = {},
): string {
  const sections: string[] = ['# Complete proposal draft', '']

  if (options.rfpFilename) {
    sections.push(`_Solicitation: ${options.rfpFilename}_`, '')
  }

  if (profile.summary.trim()) {
    sections.push(profile.summary.trim(), '')
  }

  for (const volume of profile.volumes) {
    sections.push(`# Volume: ${volume.title}`, '')

    const requirement = volume.requirementSummary.trim()
    if (requirement) {
      sections.push(`> ${requirement.replace(/\n+/g, ' ')}`, '')
    }

    const body = volume.bodyMarkdown?.trim()
    if (body) {
      sections.push(body, '')
    } else if (volume.status === 'error' && volume.errorMessage?.trim()) {
      sections.push(`_Generation failed: ${volume.errorMessage.trim()}_`, '')
    } else {
      sections.push('_No draft content for this volume._', '')
    }

    sections.push('---', '')
  }

  return sections.join('\n').trim()
}

export function hasExportableProposalContent(profile: ProposalRequirementsProfile): boolean {
  return canExportProposalProfile(profile).ok
}

export function proposalExportFilename(rfpFilename: string): string {
  const stem = rfpFilename.replace(/\.[^.]+$/i, '').trim() || 'proposal'
  const safe = stem.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return `${safe || 'proposal'}-draft.md`
}

/** Dev harness — assembled export shape (BDA-135) */
export function runAssembleProposalMarkdownHarness(): void {
  const exportableBody = `
## Approach

Acme Systems will execute cloud migration in three phases aligned to Section L.1 requirements.
Our CMMI Level 3 quality system defines entry/exit criteria for each phase with measurable deliverables.

### Staffing and schedule

A dedicated program manager and two senior engineers support the client for twelve months,
with weekly status reporting and risk registers maintained in the shared project workspace.
`.trim()

  const profile: ProposalRequirementsProfile = {
    profile_id: 'export-harness',
    rfp_doc_id: 'rfp-1',
    summary: 'Technical and management volumes.',
    built_at: new Date().toISOString(),
    packageKind: 'solicitation',
    packageWarnings: [],
    volumes: [
      {
        id: 'vol-a',
        title: 'Technical approach',
        requirementSummary: 'Describe installation methodology.',
        status: 'draft',
        bodyMarkdown: exportableBody,
      },
      {
        id: 'vol-b',
        title: 'Management plan',
        requirementSummary: 'Staffing and schedule.',
        status: 'draft',
        bodyMarkdown: exportableBody,
      },
    ],
  }

  const partialProfile: ProposalRequirementsProfile = {
    ...profile,
    volumes: [
      profile.volumes[0]!,
      { ...profile.volumes[1]!, status: 'pending', bodyMarkdown: undefined },
    ],
  }
  if (hasExportableProposalContent(partialProfile)) {
    throw new Error('runAssembleProposalMarkdownHarness: partial profile should not pass export gate')
  }

  if (!hasExportableProposalContent(profile)) {
    throw new Error('runAssembleProposalMarkdownHarness: expected exportable draft')
  }

  const markdown = assembleProposalMarkdown(profile, { rfpFilename: 'Sample-RFP.pdf' })
  if (!markdown.includes('# Volume: Technical approach')) {
    throw new Error('runAssembleProposalMarkdownHarness: missing volume header')
  }
  if (!markdown.includes('## Approach')) {
    throw new Error('runAssembleProposalMarkdownHarness: missing draft body')
  }
  if (!markdown.includes('# Volume: Management plan')) {
    throw new Error('runAssembleProposalMarkdownHarness: missing second volume header')
  }
  if (!markdown.includes('CMMI Level 3')) {
    throw new Error('runAssembleProposalMarkdownHarness: missing second volume body')
  }

  const filename = proposalExportFilename('Sample RFP.pdf')
  if (filename !== 'Sample-RFP-draft.md') {
    throw new Error(`runAssembleProposalMarkdownHarness: unexpected filename ${filename}`)
  }

  const empty: ProposalRequirementsProfile = {
    ...profile,
    volumes: profile.volumes.map((volume) => ({ ...volume, bodyMarkdown: undefined, status: 'pending' as const })),
  }
  if (hasExportableProposalContent(empty)) {
    throw new Error('runAssembleProposalMarkdownHarness: empty profile should not export')
  }
}
