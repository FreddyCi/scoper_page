import type {
  CitationRef,
  ProposalAnalysisRef,
  ProposalRequirementsProfile,
  ProposalVolume,
  ProposalVolumeSection,
} from '@/lib/types'
import type { ShareTableRow } from '@/lib/share-table'
import type { DuckdbClient } from '@/services/duckdb-client'
import { getDuckdbClient } from '@/services/duckdb-client'

export type ProposalShareTableRows = {
  proposal_profiles: ShareTableRow[]
  proposal_volumes: ShareTableRow[]
  proposal_volume_sections: ShareTableRow[]
}

function jsonString(value: unknown): string {
  return JSON.stringify(value ?? null)
}

function parseJson<T>(raw: string | number | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(String(raw)) as T
  } catch {
    return fallback
  }
}

function boolFromInt(value: string | number | null | undefined): boolean {
  return value === 1 || value === '1'
}

function intFromBool(value: boolean | undefined): number {
  return value ? 1 : 0
}

/** Serialize in-memory proposal profile → share table rows (BDA-215). */
export function proposalProfileToShareRows(
  profile: ProposalRequirementsProfile,
): ProposalShareTableRows {
  const proposal_profiles: ShareTableRow[] = [
    {
      profile_id: profile.profile_id,
      rfp_doc_id: profile.rfp_doc_id,
      summary: profile.summary,
      built_at: profile.built_at,
      package_kind: profile.packageKind,
      package_warnings_json: jsonString(profile.packageWarnings),
    },
  ]

  const proposal_volumes: ShareTableRow[] = []
  const proposal_volume_sections: ShareTableRow[] = []

  for (const volume of profile.volumes) {
    proposal_volumes.push({
      profile_id: profile.profile_id,
      volume_id: volume.id,
      title: volume.title,
      requirement_summary: volume.requirementSummary,
      solicitation_refs_json: volume.solicitationRefs?.length
        ? jsonString(volume.solicitationRefs)
        : null,
      body_markdown: volume.bodyMarkdown ?? null,
      status: volume.status,
      error_message: volume.errorMessage ?? null,
      edited: intFromBool(volume.edited),
      edited_at: volume.editedAt ?? null,
      generation_progress_json: volume.generationProgress
        ? jsonString(volume.generationProgress)
        : null,
      analysis_refs_json: volume.analysisRefs?.length ? jsonString(volume.analysisRefs) : null,
    })

    for (const section of volume.sections ?? []) {
      proposal_volume_sections.push({
        profile_id: profile.profile_id,
        volume_id: volume.id,
        section_id: section.id,
        title: section.title,
        find_clause_query: section.findClauseQuery,
        status: section.status,
        body_markdown: section.bodyMarkdown ?? null,
        error_message: section.errorMessage ?? null,
        edited: intFromBool(section.edited),
        edited_at: section.editedAt ?? null,
        citations_json: section.citations?.length ? jsonString(section.citations) : null,
      })
    }
  }

  return { proposal_profiles, proposal_volumes, proposal_volume_sections }
}

function volumeFromShareRows(
  profileId: string,
  volumeRow: ShareTableRow,
  sectionRows: ShareTableRow[],
): ProposalVolume {
  const volumeId = String(volumeRow.volume_id)
  const sectionsForVolume = sectionRows
    .filter(
      (row) => String(row.profile_id) === profileId && String(row.volume_id) === volumeId,
    )
    .map(sectionRowToSection)

  const volume: ProposalVolume = {
    id: volumeId,
    title: String(volumeRow.title),
    requirementSummary: String(volumeRow.requirement_summary),
    status: volumeRow.status as ProposalVolume['status'],
  }

  const solicitationRefs = parseJson<string[] | null>(
    volumeRow.solicitation_refs_json,
    null,
  )
  if (solicitationRefs?.length) {
    volume.solicitationRefs = solicitationRefs
  }

  if (volumeRow.body_markdown != null) {
    volume.bodyMarkdown = String(volumeRow.body_markdown)
  }
  if (volumeRow.error_message != null) {
    volume.errorMessage = String(volumeRow.error_message)
  }
  if (boolFromInt(volumeRow.edited)) {
    volume.edited = true
    if (volumeRow.edited_at != null) {
      volume.editedAt = String(volumeRow.edited_at)
    }
  }

  const generationProgress = parseJson<ProposalVolume['generationProgress']>(
    volumeRow.generation_progress_json,
    undefined,
  )
  if (generationProgress) {
    volume.generationProgress = generationProgress
  }

  const analysisRefs = parseJson<ProposalAnalysisRef[] | null>(
    volumeRow.analysis_refs_json,
    null,
  )
  if (analysisRefs?.length) {
    volume.analysisRefs = analysisRefs
  }

  if (sectionsForVolume.length > 0) {
    volume.sections = sectionsForVolume
  }

  return volume
}

function sectionRowToSection(row: ShareTableRow): ProposalVolumeSection {
  const section: ProposalVolumeSection = {
    id: String(row.section_id),
    title: String(row.title),
    findClauseQuery: String(row.find_clause_query),
    status: row.status as ProposalVolumeSection['status'],
  }

  if (row.body_markdown != null) {
    section.bodyMarkdown = String(row.body_markdown)
  }
  if (row.error_message != null) {
    section.errorMessage = String(row.error_message)
  }
  if (boolFromInt(row.edited)) {
    section.edited = true
    if (row.edited_at != null) {
      section.editedAt = String(row.edited_at)
    }
  }

  const citations = parseJson<CitationRef[] | null>(row.citations_json, null)
  if (citations?.length) {
    section.citations = citations
  }

  return section
}

/** Rebuild proposal profile from share table rows (BDA-215). */
export function proposalProfileFromShareRows(
  rows: ProposalShareTableRows,
  profileId: string,
): ProposalRequirementsProfile | null {
  const profileRow = rows.proposal_profiles.find((row) => String(row.profile_id) === profileId)
  if (!profileRow) {
    return null
  }

  const volumeRows = rows.proposal_volumes.filter(
    (row) => String(row.profile_id) === profileId,
  )

  const volumes = volumeRows.map((volumeRow) =>
    volumeFromShareRows(profileId, volumeRow, rows.proposal_volume_sections),
  )

  return {
    profile_id: profileId,
    rfp_doc_id: String(profileRow.rfp_doc_id),
    summary: String(profileRow.summary),
    built_at: String(profileRow.built_at),
    packageKind: profileRow.package_kind as ProposalRequirementsProfile['packageKind'],
    packageWarnings: parseJson<string[]>(profileRow.package_warnings_json, []),
    volumes,
  }
}

export async function clearProposalShareTables(duckdb?: DuckdbClient): Promise<void> {
  const client = duckdb ?? (await getDuckdbClient())
  await client.query('DELETE FROM proposal_volume_sections')
  await client.query('DELETE FROM proposal_volumes')
  await client.query('DELETE FROM proposal_profiles')
}

async function insertProposalShareRows(
  duckdb: DuckdbClient,
  rows: ProposalShareTableRows,
): Promise<void> {
  for (const row of rows.proposal_profiles) {
    await duckdb.query(
      `INSERT OR REPLACE INTO proposal_profiles
       (profile_id, rfp_doc_id, summary, built_at, package_kind, package_warnings_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        row.profile_id,
        row.rfp_doc_id,
        row.summary,
        row.built_at,
        row.package_kind,
        row.package_warnings_json,
      ],
    )
  }

  for (const row of rows.proposal_volumes) {
    await duckdb.query(
      `INSERT OR REPLACE INTO proposal_volumes
       (profile_id, volume_id, title, requirement_summary, solicitation_refs_json, body_markdown,
        status, error_message, edited, edited_at, generation_progress_json, analysis_refs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.profile_id,
        row.volume_id,
        row.title,
        row.requirement_summary,
        row.solicitation_refs_json,
        row.body_markdown,
        row.status,
        row.error_message,
        row.edited,
        row.edited_at,
        row.generation_progress_json,
        row.analysis_refs_json,
      ],
    )
  }

  for (const row of rows.proposal_volume_sections) {
    await duckdb.query(
      `INSERT OR REPLACE INTO proposal_volume_sections
       (profile_id, volume_id, section_id, title, find_clause_query, status, body_markdown,
        error_message, edited, edited_at, citations_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.profile_id,
        row.volume_id,
        row.section_id,
        row.title,
        row.find_clause_query,
        row.status,
        row.body_markdown,
        row.error_message,
        row.edited,
        row.edited_at,
        row.citations_json,
      ],
    )
  }
}

/** Persist session proposal profile to DuckDB before share export (BDA-215). */
export async function syncProposalProfileToDuckdb(
  profile: ProposalRequirementsProfile,
  duckdb?: DuckdbClient,
): Promise<void> {
  const client = duckdb ?? (await getDuckdbClient())
  await clearProposalShareTables(client)
  await insertProposalShareRows(client, proposalProfileToShareRows(profile))
}

export async function loadProposalProfileFromDuckdb(
  profileId: string,
  duckdb?: DuckdbClient,
): Promise<ProposalRequirementsProfile | null> {
  const client = duckdb ?? (await getDuckdbClient())

  const profiles = await client.query<Record<string, unknown>>(
    `SELECT profile_id, rfp_doc_id, summary, built_at, package_kind, package_warnings_json
     FROM proposal_profiles WHERE profile_id = ?`,
    [profileId],
  )
  if (profiles.length === 0) {
    return null
  }

  const volumes = await client.query<Record<string, unknown>>(
    `SELECT profile_id, volume_id, title, requirement_summary, solicitation_refs_json, body_markdown,
            status, error_message, edited, edited_at, generation_progress_json, analysis_refs_json
     FROM proposal_volumes WHERE profile_id = ? ORDER BY volume_id`,
    [profileId],
  )

  const sections = await client.query<Record<string, unknown>>(
    `SELECT profile_id, volume_id, section_id, title, find_clause_query, status, body_markdown,
            error_message, edited, edited_at, citations_json
     FROM proposal_volume_sections WHERE profile_id = ? ORDER BY volume_id, section_id`,
    [profileId],
  )

  const normalize = (row: Record<string, unknown>): ShareTableRow => {
    const normalized: ShareTableRow = {}
    for (const [key, value] of Object.entries(row)) {
      if (value == null) {
        normalized[key] = null
      } else if (typeof value === 'number') {
        normalized[key] = value
      } else {
        normalized[key] = String(value)
      }
    }
    return normalized
  }

  return proposalProfileFromShareRows(
    {
      proposal_profiles: profiles.map(normalize),
      proposal_volumes: volumes.map(normalize),
      proposal_volume_sections: sections.map(normalize),
    },
    profileId,
  )
}

/** Dev harness — proposal share row round-trip (BDA-215). */
export function runProposalShareStoreHarness(): void {
  const profile: ProposalRequirementsProfile = {
    profile_id: 'share-prof-1',
    rfp_doc_id: 'rfp-1',
    summary: 'Harness proposal profile.',
    built_at: new Date().toISOString(),
    packageKind: 'contract_framework',
    packageWarnings: ['Sample warning'],
    volumes: [
      {
        id: 'vol-insurance',
        title: 'Insurance and bonding',
        requirementSummary: 'Coverage limits.',
        status: 'draft',
        bodyMarkdown: '## Insurance\n\nDraft body.',
        edited: true,
        editedAt: '2026-01-01T00:00:00.000Z',
        analysisRefs: [
          {
            criterionId: 'crit-1',
            label: 'General liability',
            status: 'fail',
          },
        ],
        sections: [
          {
            id: 'sec-1',
            title: 'General liability',
            findClauseQuery: 'insurance liability',
            status: 'draft',
            bodyMarkdown: 'Section body',
            citations: [
              {
                doc_id: 'rfp-1',
                block_id: 'rfp-1:p2:i1',
                page_num: 2,
                excerpt: 'Minimum general liability coverage required.',
              },
            ],
          },
        ],
      },
    ],
  }

  const rows = proposalProfileToShareRows(profile)
  if (rows.proposal_profiles.length !== 1 || rows.proposal_volumes.length !== 1) {
    throw new Error('runProposalShareStoreHarness: expected profile + volume rows')
  }
  if (rows.proposal_volume_sections.length !== 1) {
    throw new Error('runProposalShareStoreHarness: expected section row')
  }

  const restored = proposalProfileFromShareRows(rows, profile.profile_id)
  if (!restored) {
    throw new Error('runProposalShareStoreHarness: failed to restore profile')
  }

  const volume = restored.volumes[0]
  if (!volume?.edited || volume.analysisRefs?.length !== 1) {
    throw new Error('runProposalShareStoreHarness: volume flags/refs not restored')
  }
  const citation = volume.sections?.[0]?.citations?.[0]
  if (!citation || citation.block_id !== 'rfp-1:p2:i1') {
    throw new Error('runProposalShareStoreHarness: section citations not restored')
  }
}
