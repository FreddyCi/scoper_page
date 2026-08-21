import { getDuckdbClient } from '@/services/duckdb-client'
import {
  RFP_REQUIREMENT_COLUMNS,
  RFP_REQUIREMENT_SCORE_COLUMNS,
} from '@/lib/duckdb-schema'

async function assertTableColumns(tableName: string, expected: readonly string[]): Promise<void> {
  const duckdb = await getDuckdbClient()
  const describeRows = await duckdb.query<{ column_name: string }>(`DESCRIBE ${tableName}`)
  const columnNames = new Set(describeRows.map((row) => row.column_name))
  for (const column of expected) {
    if (!columnNames.has(column)) {
      throw new Error(
        `runRfpRequirementsSchemaHarness failed: ${tableName} missing column ${column}`,
      )
    }
  }
}

/** Verify `rfp_requirements` + `rfp_requirement_scores` exist and accept rows (BDA-261). */
export async function runRfpRequirementsSchemaHarness(): Promise<void> {
  await assertTableColumns('rfp_requirements', RFP_REQUIREMENT_COLUMNS)
  await assertTableColumns('rfp_requirement_scores', RFP_REQUIREMENT_SCORE_COLUMNS)

  const duckdb = await getDuckdbClient()
  const requirementId = 'req-schema-harness'
  const profileId = 'profile-schema-harness'
  const label = 'The Contractor shall provide weekly status reports.'

  await duckdb.query('DELETE FROM rfp_requirement_scores WHERE requirement_id = ?', [requirementId])
  await duckdb.query('DELETE FROM rfp_requirements WHERE requirement_id = ?', [requirementId])

  await duckdb.query(
    `INSERT INTO rfp_requirements (
       requirement_id, doc_id, label, category, block_id, page_num, excerpt, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      requirementId,
      'doc-schema-harness',
      label,
      'reporting',
      'block-schema-harness',
      3,
      label,
      new Date().toISOString(),
    ],
  )

  await duckdb.query(
    `INSERT INTO rfp_requirement_scores (
       requirement_id, profile_id, status, note, source
     ) VALUES (?, ?, ?, ?, ?)`,
    [requirementId, profileId, 'unknown', null, 'heuristic'],
  )

  const requirements = await duckdb.query<{ label: string; page_num: number }>(
    'SELECT label, page_num FROM rfp_requirements WHERE requirement_id = ?',
    [requirementId],
  )
  if (requirements[0]?.label !== label || requirements[0]?.page_num !== 3) {
    throw new Error('runRfpRequirementsSchemaHarness failed: rfp_requirements smoke insert')
  }

  const scores = await duckdb.query<{ status: string; source: string }>(
    'SELECT status, source FROM rfp_requirement_scores WHERE requirement_id = ? AND profile_id = ?',
    [requirementId, profileId],
  )
  if (scores[0]?.status !== 'unknown' || scores[0]?.source !== 'heuristic') {
    throw new Error('runRfpRequirementsSchemaHarness failed: rfp_requirement_scores smoke insert')
  }

  await duckdb.query('DESCRIBE results_profiles')
  await duckdb.query('DESCRIBE profile_criteria')

  await duckdb.query('DELETE FROM rfp_requirement_scores WHERE requirement_id = ?', [requirementId])
  await duckdb.query('DELETE FROM rfp_requirements WHERE requirement_id = ?', [requirementId])
}
