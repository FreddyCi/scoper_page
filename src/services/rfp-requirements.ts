import { extractRfpRequirements } from '@/services/extract-rfp-requirements'
import { getDuckdbClient } from '@/services/duckdb-client'
import type {
  BlockRecord,
  CitationRef,
  RfpRequirement,
  RfpRequirementScore,
  RfpRequirementScoreSource,
  RfpRequirementScoreStatus,
  RfpRequirementsExtract,
} from '@/lib/types'

const TOKEN_PATTERN = /[a-z0-9]{4,}/gi
const COVERAGE_MET = 0.5
const COVERAGE_PARTIAL = 0.25

const SCORE_STATUSES = new Set<RfpRequirementScoreStatus>(['met', 'partial', 'gap', 'unknown'])
const SCORE_SOURCES = new Set<RfpRequirementScoreSource>(['heuristic', 'user'])

type RequirementRow = {
  requirement_id: string
  doc_id: string
  label: string
  category: string | null
  block_id: string | null
  page_num: number | null
  excerpt: string | null
  created_at: string
}

type ScoreRow = {
  requirement_id: string
  profile_id: string
  status: string
  note: string | null
  source: string | null
}

export type RfpScoreProfileInput = {
  profile_id: string
  blocks: BlockRecord[]
}

export type PersistRfpRequirementsInput = {
  docId: string
  extract: RfpRequirementsExtract
  profiles: RfpScoreProfileInput[]
}

function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().match(TOKEN_PATTERN) ?? [])
}

function coverageRatio(requirementLabel: string, bidderText: string): number {
  const required = tokenSet(requirementLabel)
  if (required.size === 0) return 0
  const bidder = tokenSet(bidderText)
  let shared = 0
  for (const token of required) {
    if (bidder.has(token)) shared += 1
  }
  return shared / required.size
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
}

function scoreKey(requirementId: string, profileId: string): string {
  return `${requirementId}::${profileId}`
}

function parseStatus(value: string): RfpRequirementScoreStatus {
  return SCORE_STATUSES.has(value as RfpRequirementScoreStatus)
    ? (value as RfpRequirementScoreStatus)
    : 'unknown'
}

function parseSource(value: string | null): RfpRequirementScoreSource {
  return value && SCORE_SOURCES.has(value as RfpRequirementScoreSource)
    ? (value as RfpRequirementScoreSource)
    : 'heuristic'
}

/**
 * Token coverage of a shall label against a bidder’s blocks.
 * Tokens are `[a-z0-9]{4,}` (same family as compare-scope).
 * Coverage = |reqTokens ∩ bidderTokens| / |reqTokens|.
 * - `unknown` — no bidder blocks (or no bidder tokens)
 * - `met` — coverage ≥ 0.5
 * - `partial` — coverage ≥ 0.25
 * - `gap` — otherwise
 */
export function scoreRequirementAgainstBlocks(
  label: string,
  bidderBlocks: BlockRecord[],
): RfpRequirementScoreStatus {
  if (bidderBlocks.length === 0) return 'unknown'
  const bidderText = bidderBlocks.map((block) => block.text).join('\n')
  if (tokenSet(bidderText).size === 0) return 'unknown'
  const coverage = coverageRatio(label, bidderText)
  if (coverage >= COVERAGE_MET) return 'met'
  if (coverage >= COVERAGE_PARTIAL) return 'partial'
  return 'gap'
}

function citationFromRow(row: RequirementRow): CitationRef | undefined {
  if (!row.block_id) return undefined
  const citation: CitationRef = {
    doc_id: row.doc_id,
    block_id: row.block_id,
    excerpt: row.excerpt ?? row.label.slice(0, 280),
  }
  if (row.page_num != null) citation.page_num = row.page_num
  return citation
}

function mapRequirement(row: RequirementRow): RfpRequirement {
  const requirement: RfpRequirement = {
    id: row.requirement_id,
    label: row.label,
  }
  if (row.category) requirement.category = row.category
  const citation = citationFromRow(row)
  if (citation) requirement.citation = citation
  return requirement
}

function mapScore(row: ScoreRow): RfpRequirementScore {
  const score: RfpRequirementScore = {
    requirement_id: row.requirement_id,
    profile_id: row.profile_id,
    status: parseStatus(row.status),
    source: parseSource(row.source),
  }
  if (row.note) score.note = row.note
  return score
}

export async function fetchRfpRequirementsForDoc(docId: string): Promise<RfpRequirement[]> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<RequirementRow>(
    `SELECT requirement_id, doc_id, label, category, block_id, page_num, excerpt, created_at
     FROM rfp_requirements
     WHERE doc_id = ?
     ORDER BY created_at ASC, requirement_id ASC`,
    [docId],
  )
  return rows.map(mapRequirement)
}

export async function fetchRfpRequirementScoresForDoc(docId: string): Promise<RfpRequirementScore[]> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<ScoreRow>(
    `SELECT s.requirement_id, s.profile_id, s.status, s.note, s.source
     FROM rfp_requirement_scores s
     WHERE s.requirement_id IN (
       SELECT requirement_id FROM rfp_requirements WHERE doc_id = ?
     )
     ORDER BY s.requirement_id ASC, s.profile_id ASC`,
    [docId],
  )
  return rows.map(mapScore)
}

export async function upsertRfpRequirementScore(score: RfpRequirementScore): Promise<void> {
  const duckdb = await getDuckdbClient()
  await duckdb.query(
    `INSERT OR REPLACE INTO rfp_requirement_scores
       (requirement_id, profile_id, status, note, source)
     VALUES (?, ?, ?, ?, ?)`,
    [
      score.requirement_id,
      score.profile_id,
      score.status,
      score.note ?? null,
      score.source ?? 'user',
    ],
  )
}

async function replaceRequirementsForDoc(
  docId: string,
  requirements: RfpRequirement[],
): Promise<void> {
  const duckdb = await getDuckdbClient()
  await duckdb.query(
    `DELETE FROM rfp_requirement_scores
     WHERE requirement_id IN (
       SELECT requirement_id FROM rfp_requirements WHERE doc_id = ?
     )`,
    [docId],
  )
  await duckdb.query('DELETE FROM rfp_requirements WHERE doc_id = ?', [docId])

  const createdAt = new Date().toISOString()
  for (const requirement of requirements) {
    await duckdb.query(
      `INSERT INTO rfp_requirements (
         requirement_id, doc_id, label, category, block_id, page_num, excerpt, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requirement.id,
        requirement.citation?.doc_id ?? docId,
        requirement.label,
        requirement.category ?? null,
        requirement.citation?.block_id ?? null,
        requirement.citation?.page_num ?? null,
        requirement.citation?.excerpt ?? requirement.label.slice(0, 280),
        createdAt,
      ],
    )
  }
}

function rematchUserScores(
  previousRequirements: RfpRequirement[],
  previousScores: RfpRequirementScore[],
  nextRequirements: RfpRequirement[],
): RfpRequirementScore[] {
  const previousById = new Map(previousRequirements.map((row) => [row.id, row]))
  const nextById = new Map(nextRequirements.map((row) => [row.id, row]))
  const nextByLabel = new Map(nextRequirements.map((row) => [normalizeLabel(row.label), row]))
  const rematched: RfpRequirementScore[] = []

  for (const score of previousScores) {
    if (score.source !== 'user') continue
    const previous = previousById.get(score.requirement_id)
    const next =
      nextById.get(score.requirement_id) ??
      (previous ? nextByLabel.get(normalizeLabel(previous.label)) : undefined)
    if (!next) continue
    rematched.push({
      ...score,
      requirement_id: next.id,
      source: 'user',
    })
  }

  return rematched
}

/**
 * Replace extracted shalls for a baseline doc, then upsert per-bidder scores.
 * Heuristic overlap seeds empty cells. Rows with `source: 'user'` keep status and note.
 */
export async function persistRfpRequirementsExtract(
  input: PersistRfpRequirementsInput,
): Promise<{ requirements: RfpRequirement[]; scores: RfpRequirementScore[] }> {
  const previousRequirements = await fetchRfpRequirementsForDoc(input.docId)
  const previousScores = await fetchRfpRequirementScoresForDoc(input.docId)
  const userScores = rematchUserScores(
    previousRequirements,
    previousScores,
    input.extract.requirements,
  )
  const userKeys = new Set(userScores.map((score) => scoreKey(score.requirement_id, score.profile_id)))

  await replaceRequirementsForDoc(input.docId, input.extract.requirements)

  for (const score of userScores) {
    await upsertRfpRequirementScore(score)
  }

  for (const requirement of input.extract.requirements) {
    for (const profile of input.profiles) {
      if (userKeys.has(scoreKey(requirement.id, profile.profile_id))) continue
      await upsertRfpRequirementScore({
        requirement_id: requirement.id,
        profile_id: profile.profile_id,
        status: scoreRequirementAgainstBlocks(requirement.label, profile.blocks),
        source: 'heuristic',
      })
    }
  }

  return {
    requirements: await fetchRfpRequirementsForDoc(input.docId),
    scores: await fetchRfpRequirementScoresForDoc(input.docId),
  }
}

function fixtureBlock(
  block_id: string,
  text: string,
  doc_id: string,
  page_num = 1,
): BlockRecord {
  return { block_id, doc_id, page_num, text }
}

/** Dev harness — extract → persist → fetch → user override survives re-seed (BDA-262). */
export async function runRfpRequirementsCrudHarness(): Promise<void> {
  const unknown = scoreRequirementAgainstBlocks('The contractor shall provide bonding.', [])
  if (unknown !== 'unknown') {
    throw new Error(`runRfpRequirementsCrudHarness: empty bidder should be unknown, got ${unknown}`)
  }
  const gap = scoreRequirementAgainstBlocks(
    'The contractor shall provide weekly status reports.',
    [fixtureBlock('unrelated', 'This proposal discusses only parking lot paving.', 'bid')],
  )
  if (gap !== 'gap') {
    throw new Error(`runRfpRequirementsCrudHarness: unrelated bidder should be gap, got ${gap}`)
  }

  const docId = 'rfp-req-crud-harness'
  const profileId = 'profile-crud-harness'
  const knownShall =
    'The Contractor shall provide weekly status reports to the Contracting Officer.'
  const extract = extractRfpRequirements([fixtureBlock('b-shall', knownShall, docId, 3)])
  if (!extract.requirements.some((row) => row.label.includes('weekly status reports'))) {
    throw new Error('runRfpRequirementsCrudHarness: extract missing known shall')
  }

  const bidderBlocks = [
    fixtureBlock(
      'b-bid',
      'We will provide weekly status reports to the Contracting Officer.',
      'bidder-crud',
    ),
  ]

  const first = await persistRfpRequirementsExtract({
    docId,
    extract,
    profiles: [{ profile_id: profileId, blocks: bidderBlocks }],
  })
  const requirement = first.requirements.find((row) => row.label.includes('weekly status reports'))
  if (!requirement) {
    throw new Error('runRfpRequirementsCrudHarness: persist/fetch missing requirement')
  }
  if (requirement.citation?.block_id !== 'b-shall' || requirement.citation.page_num !== 3) {
    throw new Error('runRfpRequirementsCrudHarness: citation did not round-trip')
  }

  const seeded = first.scores.find(
    (score) => score.requirement_id === requirement.id && score.profile_id === profileId,
  )
  if (!seeded || seeded.status === 'gap' || seeded.status === 'unknown') {
    throw new Error(
      `runRfpRequirementsCrudHarness: expected overlapping bidder to seed met/partial, got ${seeded?.status}`,
    )
  }
  if (seeded.source !== 'heuristic') {
    throw new Error('runRfpRequirementsCrudHarness: initial score should be heuristic')
  }

  await upsertRfpRequirementScore({
    requirement_id: requirement.id,
    profile_id: profileId,
    status: 'gap',
    note: 'User override note',
    source: 'user',
  })

  const second = await persistRfpRequirementsExtract({
    docId,
    extract,
    profiles: [{ profile_id: profileId, blocks: bidderBlocks }],
  })
  const kept = second.scores.find(
    (score) => score.requirement_id === requirement.id && score.profile_id === profileId,
  )
  if (kept?.status !== 'gap' || kept.note !== 'User override note' || kept.source !== 'user') {
    throw new Error(
      `runRfpRequirementsCrudHarness: user override did not survive re-seed (${kept?.status}, ${kept?.source})`,
    )
  }

  const duckdb = await getDuckdbClient()
  await duckdb.query(
    `DELETE FROM rfp_requirement_scores
     WHERE requirement_id IN (SELECT requirement_id FROM rfp_requirements WHERE doc_id = ?)`,
    [docId],
  )
  await duckdb.query('DELETE FROM rfp_requirements WHERE doc_id = ?', [docId])
}
