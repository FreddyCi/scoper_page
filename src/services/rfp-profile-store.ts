import { getDuckdbClient } from '@/services/duckdb-client'
import type {
  CriterionResult,
  CriterionStatus,
  RfpResultsProfile,
  RfpVerdict,
} from '@/lib/types'
import { blockToCitation } from '@/lib/types'

type ResultsProfileRow = {
  profile_id: string
  mode: string
  doc_id: string
  verdict: string
  subject_json: string
  summary: string
}

type ProfileCriterionRow = {
  profile_id: string
  criterion_id: string
  status: string
  label: string
  detail: string | null
  block_id: string | null
}

export async function clearRfpProfilesForDocs(docIds: string[]): Promise<void> {
  if (docIds.length === 0) return

  const duckdb = await getDuckdbClient()
  const placeholders = docIds.map(() => '?').join(', ')

  await duckdb.query(
    `DELETE FROM profile_criteria
     WHERE profile_id IN (
       SELECT profile_id FROM results_profiles WHERE doc_id IN (${placeholders})
     )`,
    docIds,
  )
  await duckdb.query(
    `DELETE FROM results_profiles WHERE doc_id IN (${placeholders})`,
    docIds,
  )
}

export async function persistRfpProfiles(profiles: RfpResultsProfile[]): Promise<void> {
  if (profiles.length === 0) return

  const duckdb = await getDuckdbClient()
  await clearRfpProfilesForDocs(profiles.map((profile) => profile.source_doc_id))

  for (const profile of profiles) {
    await duckdb.query(
      `INSERT OR REPLACE INTO results_profiles
        (profile_id, mode, doc_id, verdict, subject_json, summary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        profile.profile_id,
        'rfp',
        profile.source_doc_id,
        profile.verdict,
        JSON.stringify(profile.subject),
        profile.summary,
      ],
    )

    for (const criterion of profile.criteria) {
      await duckdb.query(
        `INSERT OR REPLACE INTO profile_criteria
          (profile_id, criterion_id, status, label, detail, block_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          profile.profile_id,
          criterion.id,
          criterion.status,
          criterion.label,
          criterion.detail ?? null,
          criterion.citation?.block_id ?? null,
        ],
      )
    }
  }
}

async function citationForBlockId(blockId: string): Promise<CriterionResult['citation']> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<{
    block_id: string
    doc_id: string
    page_num: number | null
    section_path: string | null
    text: string
    x: number | null
    y: number | null
    width: number | null
    height: number | null
  }>(
    `SELECT block_id, doc_id, page_num, section_path, text, x, y, width, height
     FROM blocks WHERE block_id = ?`,
    [blockId],
  )

  const row = rows[0]
  if (!row) return undefined

  const block = {
    block_id: row.block_id,
    doc_id: row.doc_id,
    text: row.text,
    ...(row.page_num != null ? { page_num: row.page_num } : {}),
    ...(row.section_path != null ? { section_path: row.section_path } : {}),
    ...(row.x != null ? { x: row.x } : {}),
    ...(row.y != null ? { y: row.y } : {}),
    ...(row.width != null ? { width: row.width } : {}),
    ...(row.height != null ? { height: row.height } : {}),
  }

  return blockToCitation(block)
}

export async function fetchRfpProfilesFromDuckdb(): Promise<RfpResultsProfile[]> {
  const duckdb = await getDuckdbClient()
  const profileRows = await duckdb.query<ResultsProfileRow>(
    `SELECT profile_id, mode, doc_id, verdict, subject_json, summary
     FROM results_profiles
     WHERE mode = 'rfp'
     ORDER BY doc_id`,
  )

  const profiles: RfpResultsProfile[] = []

  for (const row of profileRows) {
    const criteriaRows = await duckdb.query<ProfileCriterionRow>(
      `SELECT profile_id, criterion_id, status, label, detail, block_id
       FROM profile_criteria
       WHERE profile_id = ?
       ORDER BY criterion_id`,
      [row.profile_id],
    )

    const criteria: CriterionResult[] = []
    for (const criterionRow of criteriaRows) {
      const criterion: CriterionResult = {
        id: criterionRow.criterion_id,
        label: criterionRow.label,
        status: criterionRow.status as CriterionStatus,
      }

      if (criterionRow.detail) criterion.detail = criterionRow.detail
      if (criterionRow.block_id) {
        criterion.citation = await citationForBlockId(criterionRow.block_id)
      }

      criteria.push(criterion)
    }

    profiles.push({
      profile_id: row.profile_id,
      source_doc_id: row.doc_id,
      verdict: row.verdict as RfpVerdict,
      subject: JSON.parse(row.subject_json) as RfpResultsProfile['subject'],
      criteria,
      summary: row.summary,
    })
  }

  return profiles
}

export async function countRfpProfilesInDuckdb(): Promise<number> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<{ count: number }>(
    `SELECT COUNT(*)::INTEGER AS count FROM results_profiles WHERE mode = 'rfp'`,
  )
  return rows[0]?.count ?? 0
}
