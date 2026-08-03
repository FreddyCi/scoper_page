import type {
  CitationRef,
  ProposalRequirementsProfile,
  ProposalVolume,
} from '@/lib/types'
import { canExportProposalProfile } from '@/lib/proposal-export-quality'

export type ProposalExportMode = 'complete' | 'drafted-only'

export type AssembleProposalMarkdownOptions = {
  rfpFilename?: string
  /** Full profile vs draft volumes only (BDA-213). */
  exportMode?: ProposalExportMode
}

const SOURCE_EXCERPT_MAX = 200

function volumesForExport(
  profile: ProposalRequirementsProfile,
  exportMode: ProposalExportMode,
): ProposalVolume[] {
  if (exportMode === 'complete') {
    return profile.volumes
  }

  return profile.volumes.filter(
    (volume) => volume.status === 'draft' && Boolean(volume.bodyMarkdown?.trim()),
  )
}

function collectVolumeCitations(volume: ProposalVolume): CitationRef[] {
  const seen = new Set<string>()
  const citations: CitationRef[] = []

  for (const section of volume.sections ?? []) {
    for (const citation of section.citations ?? []) {
      if (seen.has(citation.block_id)) continue
      seen.add(citation.block_id)
      citations.push(citation)
    }
  }

  return citations
}

function formatSourceLine(citation: CitationRef): string {
  const page = citation.page_num != null ? `Page ${citation.page_num}` : 'Source'
  const excerpt = citation.excerpt.trim().replace(/\s+/g, ' ')
  const clipped =
    excerpt.length > SOURCE_EXCERPT_MAX
      ? `${excerpt.slice(0, SOURCE_EXCERPT_MAX - 1)}…`
      : excerpt
  return `- ${page}: ${clipped || '(no excerpt)'}`
}

function volumeSourcesMarkdown(volume: ProposalVolume): string {
  const citations = collectVolumeCitations(volume)
  if (citations.length === 0) {
    return ''
  }

  return ['### Sources', '', ...citations.map(formatSourceLine), ''].join('\n')
}

/** Single downloadable markdown file from all volume drafts (BDA-135). */
export function assembleProposalMarkdown(
  profile: ProposalRequirementsProfile,
  options: AssembleProposalMarkdownOptions = {},
): string {
  const exportMode = options.exportMode ?? 'complete'
  const volumes = volumesForExport(profile, exportMode)

  const title =
    exportMode === 'drafted-only' ? '# Partial proposal draft' : '# Complete proposal draft'
  const sections: string[] = [title, '']

  if (exportMode === 'drafted-only') {
    sections.push(
      '_This export includes only volumes with draft content; pending and incomplete volumes are omitted._',
      '',
    )
  }

  if (options.rfpFilename) {
    sections.push(`_Solicitation: ${options.rfpFilename}_`, '')
  }

  if (profile.summary.trim()) {
    sections.push(profile.summary.trim(), '')
  }

  if (volumes.length === 0) {
    sections.push('_No draft volumes available for export._', '')
    return sections.join('\n').trim()
  }

  for (const volume of volumes) {
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

    const sources = volumeSourcesMarkdown(volume)
    if (sources) {
      sections.push(sources)
    }

    sections.push('---', '')
  }

  return sections.join('\n').trim()
}

export function countDraftedProposalVolumes(profile: ProposalRequirementsProfile): number {
  return profile.volumes.filter(
    (volume) => volume.status === 'draft' && Boolean(volume.bodyMarkdown?.trim()),
  ).length
}

export function canExportDraftedProposalVolumes(profile: ProposalRequirementsProfile): boolean {
  return countDraftedProposalVolumes(profile) > 0
}

export function hasExportableProposalContent(profile: ProposalRequirementsProfile): boolean {
  return canExportProposalProfile(profile).ok
}

export function proposalExportFilename(
  rfpFilename: string,
  exportMode: ProposalExportMode = 'complete',
): string {
  const stem = rfpFilename.replace(/\.[^.]+$/i, '').trim() || 'proposal'
  const safe = stem.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const suffix = exportMode === 'drafted-only' ? 'partial-draft' : 'draft'
  return `${safe || 'proposal'}-${suffix}.md`
}

/** Dev harness — assembled export shape (BDA-135, BDA-213) */
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
        sections: [
          {
            id: 'sec-a1',
            title: 'Approach',
            findClauseQuery: 'methodology',
            status: 'draft',
            bodyMarkdown: exportableBody,
            citations: [
              {
                doc_id: 'rfp-1',
                block_id: 'rfp-1:p4:i2',
                page_num: 4,
                excerpt: 'Section L.1 requires a detailed methodology and project schedule.',
              },
            ],
          },
        ],
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
  if (!markdown.includes('### Sources') || !markdown.includes('Page 4')) {
    throw new Error('runAssembleProposalMarkdownHarness: expected Sources from section citations')
  }

  const partialExport = assembleProposalMarkdown(partialProfile, {
    rfpFilename: 'Sample-RFP.pdf',
    exportMode: 'drafted-only',
  })
  if (!partialExport.includes('Partial proposal draft')) {
    throw new Error('runAssembleProposalMarkdownHarness: partial export missing header note')
  }
  if (partialExport.includes('# Volume: Management plan')) {
    throw new Error('runAssembleProposalMarkdownHarness: drafted-only should omit pending volumes')
  }
  if (!partialExport.includes('# Volume: Technical approach')) {
    throw new Error('runAssembleProposalMarkdownHarness: drafted-only should keep draft volume')
  }

  const filename = proposalExportFilename('Sample RFP.pdf')
  if (filename !== 'Sample-RFP-draft.md') {
    throw new Error(`runAssembleProposalMarkdownHarness: unexpected filename ${filename}`)
  }

  const partialFilename = proposalExportFilename('Sample RFP.pdf', 'drafted-only')
  if (partialFilename !== 'Sample-RFP-partial-draft.md') {
    throw new Error(`runAssembleProposalMarkdownHarness: unexpected partial filename ${partialFilename}`)
  }

  const empty: ProposalRequirementsProfile = {
    ...profile,
    volumes: profile.volumes.map((volume) => ({
      ...volume,
      bodyMarkdown: undefined,
      status: 'pending' as const,
    })),
  }
  if (hasExportableProposalContent(empty)) {
    throw new Error('runAssembleProposalMarkdownHarness: empty profile should not export')
  }
}
