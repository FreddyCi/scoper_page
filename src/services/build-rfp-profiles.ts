import { fetchDocumentBlocks } from '@/services/document-blocks'
import { ingestFile } from '@/services/ingest-router'
import {
  countRfpProfilesInDuckdb,
  fetchRfpProfilesFromDuckdb,
  persistRfpProfiles,
} from '@/services/rfp-profile-store'
import type {
  BlockRecord,
  CriterionResult,
  CriterionStatus,
  DocumentMeta,
  RfpResultsProfile,
  RfpVerdict,
} from '@/lib/types'
import { blockToCitation } from '@/lib/types'

type CriterionRule = {
  id: string
  label: string
  detail: string
  keywords: RegExp[]
  statusWhenFound: CriterionStatus
  statusWhenMissing: CriterionStatus
}

const CRITERION_RULES: CriterionRule[] = [
  {
    id: 'certification',
    label: 'Certification requirement',
    detail: 'CMMI, ISO, or equivalent certification language',
    keywords: [
      /cmmi/i,
      /certification/i,
      /certified/i,
      /accredited/i,
      /qualification/i,
      /compliance/i,
      /standard/i,
    ],
    statusWhenFound: 'pass',
    statusWhenMissing: 'fail',
  },
  {
    id: 'pricing',
    label: 'Pricing or commercial terms',
    detail: 'Pricing tiers, seats, or subscription language',
    keywords: [
      /pricing/i,
      /price/i,
      /subscription/i,
      /per seat/i,
      /license/i,
      /cost/i,
      /fee/i,
      /commercial/i,
      /payment/i,
    ],
    statusWhenFound: 'warn',
    statusWhenMissing: 'fail',
  },
  {
    id: 'insurance',
    label: 'Insurance minimums',
    detail: 'General liability or insurance coverage',
    keywords: [
      /insurance/i,
      /liability/i,
      /indemnif/i,
      /coverage/i,
      /bond/i,
      /warrant/i,
    ],
    statusWhenFound: 'pass',
    statusWhenMissing: 'warn',
  },
]

function findMatchingBlock(blocks: BlockRecord[], keywords: RegExp[]): BlockRecord | null {
  let best: BlockRecord | null = null
  let bestScore = 0

  for (const block of blocks) {
    const score = keywords.reduce(
      (total, pattern) => total + (pattern.test(block.text) ? 1 : 0),
      0,
    )
    if (score > bestScore) {
      best = block
      bestScore = score
    }
  }

  return bestScore > 0 ? best : null
}

/** Spread fallback anchors across pages when keyword rules miss (e.g. sample PDFs). */
function selectFallbackBlocks(blocks: BlockRecord[], count: number): BlockRecord[] {
  if (blocks.length === 0 || count === 0) return []

  const sorted = [...blocks].sort((left, right) => {
    const pageLeft = left.page_num ?? Number.MAX_SAFE_INTEGER
    const pageRight = right.page_num ?? Number.MAX_SAFE_INTEGER
    if (pageLeft !== pageRight) return pageLeft - pageRight
    return left.block_id.localeCompare(right.block_id)
  })

  if (sorted.length <= count) return sorted

  const picks: BlockRecord[] = []
  const step = (sorted.length - 1) / Math.max(count - 1, 1)

  for (let index = 0; index < count; index += 1) {
    picks.push(sorted[Math.round(index * step)]!)
  }

  return picks
}

function buildCriterionFromRule(
  docId: string,
  rule: CriterionRule,
  blocks: BlockRecord[],
  fallbackBlock?: BlockRecord,
): CriterionResult {
  const match = findMatchingBlock(blocks, rule.keywords)
  const linkedBlock = match ?? fallbackBlock
  const status = match ? rule.statusWhenFound : rule.statusWhenMissing

  const criterion: CriterionResult = {
    id: `${docId}-${rule.id}`,
    label: rule.label,
    status,
    detail: match
      ? rule.detail
      : linkedBlock
        ? `${rule.detail} · Jump to extracted text for manual review`
        : rule.detail,
  }

  if (linkedBlock) {
    criterion.citation = blockToCitation(linkedBlock)
  }

  return criterion
}

function verdictFromCriteria(criteria: CriterionResult[], isSourceDoc: boolean): RfpVerdict {
  if (isSourceDoc) return 'likely'

  const failCount = criteria.filter((item) => item.status === 'fail').length
  const warnCount = criteria.filter((item) => item.status === 'warn').length

  if (failCount >= 2) return 'unlikely'
  if (failCount >= 1 || warnCount >= 2) return 'might'
  return 'likely'
}

function summaryForProfile(
  doc: DocumentMeta,
  criteria: CriterionResult[],
  isSourceDoc: boolean,
): string {
  const citedCount = criteria.filter((item) => item.citation).length

  if (isSourceDoc) {
    return `Source document defines ${criteria.length} tracked requirement areas with ${citedCount} linked clauses in extracted text.`
  }

  const failCount = criteria.filter((item) => item.status === 'fail').length
  if (failCount > 0) {
    return `Response is missing evidence for ${failCount} requirement area${failCount === 1 ? '' : 's'}; review linked clauses before qualifying.`
  }

  return `Response for ${doc.filename.replace(/\.[^.]+$/, '')} references ${citedCount} requirement area${citedCount === 1 ? '' : 's'} in extracted text; no hard failures detected by rule scan.`
}

export function buildProfileFromBlocks(
  doc: DocumentMeta,
  blocks: BlockRecord[],
  docIndex: number,
): RfpResultsProfile {
  const isSourceDoc = docIndex === 0
  const fallbacks = selectFallbackBlocks(blocks, CRITERION_RULES.length)
  const criteria = CRITERION_RULES.map((rule, index) =>
    buildCriterionFromRule(doc.doc_id, rule, blocks, fallbacks[index]),
  )

  return {
    profile_id: `profile-${doc.doc_id}`,
    source_doc_id: doc.doc_id,
    verdict: verdictFromCriteria(criteria, isSourceDoc),
    subject: {
      name: doc.filename.replace(/\.[^.]+$/, ''),
      role: isSourceDoc ? 'RFP source' : 'Bidder response',
    },
    criteria,
    summary: summaryForProfile(doc, criteria, isSourceDoc),
  }
}

/**
 * Rule-based RFP profile builder — scans DuckDB blocks and maps criteria to citations.
 * Replace with bitgpu JSON schema extract when BDA-050 lands.
 */
export async function buildRfpProfiles(
  documents: DocumentMeta[],
): Promise<RfpResultsProfile[]> {
  if (documents.length === 0) return []

  const profiles: RfpResultsProfile[] = []

  for (const [index, doc] of documents.entries()) {
    const blocks = await fetchDocumentBlocks(doc.doc_id)
    profiles.push(buildProfileFromBlocks(doc, blocks, index))
  }

  await persistRfpProfiles(profiles)
  return profiles
}

export async function buildRfpProfilesForDocuments(
  documents: DocumentMeta[],
): Promise<RfpResultsProfile[]> {
  await buildRfpProfiles(documents)
  return fetchRfpProfilesFromDuckdb()
}

/** Dev harness — ingest sample PDF, build profiles, verify DuckDB + criteria (BDA-042) */
export async function runBuildRfpProfilesHarness(): Promise<void> {
  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`buildRfpProfiles harness: failed to load sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const file = new File([blob], 'minimal.pdf', { type: 'application/pdf' })
  const ingested = await ingestFile(file, { ocrEnabled: false })

  const document: DocumentMeta = {
    doc_id: ingested.doc_id,
    filename: ingested.filename,
    mime: ingested.mime,
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  }

  const profiles = await buildRfpProfiles([document])

  if (profiles.length < 1) {
    throw new Error('buildRfpProfiles harness: expected at least one profile')
  }

  const profile = profiles[0]
  if (!profile || profile.criteria.length === 0) {
    throw new Error('buildRfpProfiles harness: expected criteria on profile')
  }

  const citedCriteria = profile.criteria.filter((item) => item.citation)
  if (ingested.block_count > 0 && citedCriteria.length === 0) {
    throw new Error('buildRfpProfiles harness: expected criteria citations when blocks exist')
  }

  const storedCount = await countRfpProfilesInDuckdb()
  if (storedCount < 1) {
    throw new Error('buildRfpProfiles harness: expected DuckDB results_profiles row')
  }

  const reloaded = await fetchRfpProfilesFromDuckdb()
  if (reloaded.length < 1 || reloaded[0]?.criteria.length === 0) {
    throw new Error('buildRfpProfiles harness: fetchRfpProfilesFromDuckdb failed')
  }
}
