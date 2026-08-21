import { beginBlobSave } from '@/lib/download-blob'
import type {
  RfpInstructionsProfile,
  RfpRequirement,
  RfpRequirementScore,
  RfpRequirementScoreStatus,
  RfpResultsProfile,
} from '@/lib/types'

const STATUS_CSV_LABEL: Record<RfpRequirementScoreStatus, string> = {
  met: 'Met',
  partial: 'Partial',
  gap: 'Gap',
  unknown: 'Unknown',
}

export type ExportRfpComplianceCsvInput = {
  baselineFilename?: string
  requirements: RfpRequirement[]
  profiles: RfpResultsProfile[]
  scores: RfpRequirementScore[]
  instructions?: RfpInstructionsProfile | null
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function csvRow(cells: string[]): string {
  return cells.map(escapeCsvField).join(',')
}

function instructionValue(value: string | undefined): string {
  return value?.trim() ? value.trim() : 'Not found'
}

/** Instructions block prepended above compliance matrix rows (BDA-269). */
export function buildRfpInstructionsCsvPreamble(
  instructions?: RfpInstructionsProfile | null,
): string[] {
  const volumes =
    instructions && instructions.volumes.length > 0
      ? instructions.volumes.map((volume) => volume.value).join('; ')
      : 'Not found'

  return [
    csvRow(['Instructions']),
    csvRow(['Due date', instructionValue(instructions?.dueDate?.value)]),
    csvRow(['Questions due', instructionValue(instructions?.questionsDue?.value)]),
    csvRow(['Page limit', instructionValue(instructions?.pageLimit?.value)]),
    csvRow(['Solicitation volumes', volumes]),
    '',
  ]
}

/** Pure CSV builder for compliance matrix export (BDA-266). */
export function buildRfpComplianceCsv(input: ExportRfpComplianceCsvInput): string {
  const preamble = buildRfpInstructionsCsvPreamble(input.instructions)
  const header = [
    '#',
    'requirement',
    'page',
    'excerpt',
    ...input.profiles.flatMap((profile) => [
      `${profile.subject.name} status`,
      `${profile.subject.name} note`,
    ]),
  ]

  const rows = input.requirements.map((requirement, index) => {
    const page =
      requirement.citation?.page_num != null ? String(requirement.citation.page_num) : ''
    const excerpt = requirement.citation?.excerpt ?? requirement.label.slice(0, 280)
    const profileCells = input.profiles.flatMap((profile) => {
      const score = input.scores.find(
        (row) =>
          row.requirement_id === requirement.id && row.profile_id === profile.profile_id,
      )
      return [score ? STATUS_CSV_LABEL[score.status] : '', score?.note ?? '']
    })

    return csvRow([
      String(index + 1),
      requirement.label,
      page,
      excerpt,
      ...profileCells,
    ])
  })

  return [...preamble, csvRow(header), ...rows].join('\n')
}

export function rfpComplianceCsvFilename(baselineFilename?: string): string {
  const stem =
    (baselineFilename ?? 'rfp')
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'rfp'
  return `${stem}-compliance-matrix.csv`
}

export async function downloadRfpComplianceCsv(input: ExportRfpComplianceCsvInput): Promise<void> {
  const csv = buildRfpComplianceCsv(input)
  const writeBlob = await beginBlobSave({
    filename: rfpComplianceCsvFilename(input.baselineFilename),
    mime: 'text/csv',
    extension: '.csv',
  })
  await writeBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

/** Dev harness — CSV contains known shall phrase + bidder columns (BDA-266). */
export function runExportRfpComplianceCsvHarness(): void {
  const csv = buildRfpComplianceCsv({
    baselineFilename: 'sample-rfp.pdf',
    instructions: {
      doc_id: 'baseline-harness',
      dueDate: {
        label: 'Due date',
        value: 'Proposals are due March 1, 2026',
      },
      volumes: [],
      block_ids: [],
      summary: 'Harness instructions',
    },
    requirements: [
      {
        id: 'req-harness-1',
        label: 'The Contractor shall provide weekly status reports.',
        citation: {
          doc_id: 'baseline-harness',
          block_id: 'block-harness',
          page_num: 3,
          excerpt: 'The Contractor shall provide weekly status reports.',
        },
      },
    ],
    profiles: [
      {
        profile_id: 'profile-harness-bidder',
        source_doc_id: 'bidder-harness',
        verdict: 'likely',
        subject: { name: 'Acme Bid' },
        criteria: [],
        summary: 'Harness bidder',
      },
    ],
    scores: [
      {
        requirement_id: 'req-harness-1',
        profile_id: 'profile-harness-bidder',
        status: 'partial',
        note: 'Needs CO sign-off',
        source: 'user',
      },
    ],
  })

  if (!csv.includes('weekly status reports')) {
    throw new Error('runExportRfpComplianceCsvHarness: missing known requirement phrase')
  }
  const matrixHeaderIndex = csv.indexOf('#,requirement,page,excerpt')
  const instructionsIndex = csv.indexOf('Instructions')
  if (instructionsIndex === -1 || instructionsIndex >= matrixHeaderIndex) {
    throw new Error('runExportRfpComplianceCsvHarness: instructions preamble missing or after matrix')
  }
  if (!csv.includes('March 1') || !csv.includes('Questions due,Not found')) {
    throw new Error('runExportRfpComplianceCsvHarness: instructions preamble content missing')
  }
  if (!csv.includes('Acme Bid status') || !csv.includes('Partial')) {
    throw new Error('runExportRfpComplianceCsvHarness: missing bidder status column')
  }
  if (!csv.includes('Needs CO sign-off')) {
    throw new Error('runExportRfpComplianceCsvHarness: missing bidder note')
  }
  if (rfpComplianceCsvFilename('Sample RFP.pdf') !== 'Sample-RFP-compliance-matrix.csv') {
    throw new Error('runExportRfpComplianceCsvHarness: unexpected filename')
  }
}
