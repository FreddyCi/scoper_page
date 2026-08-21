import { extractRfpInstructions } from '@/services/extract-rfp-instructions'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import { getDuckdbClient } from '@/services/duckdb-client'
import { RFP_SOLICITATION_META_COLUMNS } from '@/lib/duckdb-schema'
import type { RfpInstructionField, RfpInstructionsProfile } from '@/lib/types'

type SolicitationMetaRow = {
  doc_id: string
  due_json: string | null
  questions_due_json: string | null
  page_limit_json: string | null
  volumes_json: string
  block_ids_json: string
  summary: string
  updated_at: string
}

function parseField(json: string | null): RfpInstructionField | undefined {
  if (!json) return undefined
  return JSON.parse(json) as RfpInstructionField
}

function serializeField(field: RfpInstructionField | undefined): string | null {
  return field ? JSON.stringify(field) : null
}

function mapRow(row: SolicitationMetaRow): RfpInstructionsProfile {
  return {
    doc_id: row.doc_id,
    dueDate: parseField(row.due_json),
    questionsDue: parseField(row.questions_due_json),
    pageLimit: parseField(row.page_limit_json),
    volumes: JSON.parse(row.volumes_json) as RfpInstructionField[],
    block_ids: JSON.parse(row.block_ids_json) as string[],
    summary: row.summary,
  }
}

export async function fetchRfpInstructionsForDoc(
  docId: string,
): Promise<RfpInstructionsProfile | null> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<SolicitationMetaRow>(
    `SELECT doc_id, due_json, questions_due_json, page_limit_json, volumes_json,
            block_ids_json, summary, updated_at
     FROM rfp_solicitation_meta
     WHERE doc_id = ?`,
    [docId],
  )
  const row = rows[0]
  return row ? mapRow(row) : null
}

export async function persistRfpInstructionsProfile(
  docId: string,
  extract: ReturnType<typeof extractRfpInstructions>,
): Promise<RfpInstructionsProfile> {
  const duckdb = await getDuckdbClient()
  const profile: RfpInstructionsProfile = {
    doc_id: docId,
    dueDate: extract.dueDate,
    questionsDue: extract.questionsDue,
    pageLimit: extract.pageLimit,
    volumes: extract.volumes,
    block_ids: extract.block_ids,
    summary: extract.summary,
  }

  await duckdb.query(
    `INSERT OR REPLACE INTO rfp_solicitation_meta (
       doc_id, due_json, questions_due_json, page_limit_json, volumes_json,
       block_ids_json, summary, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      docId,
      serializeField(profile.dueDate),
      serializeField(profile.questionsDue),
      serializeField(profile.pageLimit),
      JSON.stringify(profile.volumes),
      JSON.stringify(profile.block_ids),
      profile.summary,
      new Date().toISOString(),
    ],
  )

  return profile
}

/** Extract + persist solicitation meta for qualification (BDA-267). */
export async function syncRfpInstructionsForQualification(
  docId: string,
): Promise<RfpInstructionsProfile> {
  const blocks = await fetchDocumentBlocks(docId)
  const extract = extractRfpInstructions(blocks)
  return persistRfpInstructionsProfile(docId, extract)
}

/** Dev harness — schema + persist round-trip (BDA-267). */
export async function runRfpSolicitationMetaHarness(): Promise<void> {
  const duckdb = await getDuckdbClient()
  const describeRows = await duckdb.query<{ column_name: string }>(
    'DESCRIBE rfp_solicitation_meta',
  )
  const columnNames = new Set(describeRows.map((row) => row.column_name))
  for (const column of RFP_SOLICITATION_META_COLUMNS) {
    if (!columnNames.has(column)) {
      throw new Error(`runRfpSolicitationMetaHarness failed: missing column ${column}`)
    }
  }

  const docId = 'rfp-solicitation-meta-harness'
  await duckdb.query('DELETE FROM rfp_solicitation_meta WHERE doc_id = ?', [docId])

  const saved = await persistRfpInstructionsProfile(docId, {
    dueDate: {
      label: 'Due date',
      value: 'Proposals are due March 1, 2026',
      citation: {
        doc_id: docId,
        block_id: 'meta-due-block',
        page_num: 2,
        excerpt: 'Proposals are due March 1, 2026',
      },
    },
    pageLimit: {
      label: 'Page limit',
      value: 'not to exceed 15 pages',
      citation: {
        doc_id: docId,
        block_id: 'meta-page-block',
        page_num: 4,
        excerpt: 'not to exceed 15 pages',
      },
    },
    volumes: [
      {
        label: 'Volume',
        value: 'Volume I Technical Approach',
        citation: {
          doc_id: docId,
          block_id: 'meta-vol-block',
          page_num: 5,
          excerpt: 'Volume I Technical Approach',
        },
      },
    ],
    block_ids: ['meta-due-block', 'meta-page-block', 'meta-vol-block'],
    summary: '3 instruction fields extracted from baseline',
  })

  const fetched = await fetchRfpInstructionsForDoc(docId)
  if (!fetched?.dueDate?.value.includes('March 1')) {
    throw new Error('runRfpSolicitationMetaHarness: due date round-trip failed')
  }
  if (!fetched.pageLimit?.value.includes('15 pages')) {
    throw new Error('runRfpSolicitationMetaHarness: page limit round-trip failed')
  }
  if (fetched.volumes.length !== 1) {
    throw new Error('runRfpSolicitationMetaHarness: volumes round-trip failed')
  }
  if (saved.block_ids.length !== 3) {
    throw new Error('runRfpSolicitationMetaHarness: block_ids not persisted')
  }

  await duckdb.query('DELETE FROM rfp_solicitation_meta WHERE doc_id = ?', [docId])
}
