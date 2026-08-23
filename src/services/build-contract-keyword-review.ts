import { blockToCitation } from '@/lib/types'
import type {
  BlockRecord,
  CriterionResult,
  CriterionStatus,
  DocumentMeta,
  RfpResultsProfile,
  RfpVerdict,
} from '@/lib/types'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import {
  expandClauseTerms,
  scoreBlockText,
} from '@/services/document-search'
import { SAMPLE_FIXTURE_COMPANY } from '@/lib/sample-fixture-company'
import {
  parseContractChecklistText,
  type ContractChecklistItem,
} from '@/services/parse-contract-checklist'

export type BuildContractKeywordReviewOptions = {
  contractDocId: string
  checklistDocId: string
}

function bestBlockForTerms(
  blocks: BlockRecord[],
  terms: string[],
): { block: BlockRecord; matchedTerms: string[]; score: number } | null {
  if (terms.length === 0) return null

  let best: { block: BlockRecord; matchedTerms: string[]; score: number } | null = null

  for (const block of blocks) {
    const { score, matchedTerms } = scoreBlockText(block.text, terms)
    if (score <= 0) continue
    if (!best || score > best.score) {
      best = { block, matchedTerms, score }
    }
  }

  return best
}

function contractFullText(blocks: BlockRecord[]): string {
  return blocks.map((block) => block.text).join('\n')
}

function evaluateContractValue(blocks: BlockRecord[]): CriterionResult {
  const text = contractFullText(blocks)
  const tbd =
    /to be determined by separate work authorization/i.test(text) ||
    /subcontract price.*tbd/i.test(text)
  const priced = /\$\s*[\d,]+/.test(text) && !tbd

  const hit = bestBlockForTerms(blocks, [
    'subcontract',
    'price',
    'authorization',
    'lump sum',
    'compensation',
  ])

  if (priced && hit) {
    return {
      id: 'contract-value',
      label: 'Check value of the contract',
      status: 'pass',
      detail: 'Numeric price language found in the contract.',
      citation: blockToCitation(hit.block),
    }
  }

  if (tbd) {
    return {
      id: 'contract-value',
      label: 'Check value of the contract',
      status: 'warn',
      detail: 'Subcontract price is TBD by separate Work Authorization — review each WA.',
      citation: hit ? blockToCitation(hit.block) : undefined,
    }
  }

  return {
    id: 'contract-value',
    label: 'Check value of the contract',
    status: 'warn',
    detail: 'No clear price or TBD language found — manual review recommended.',
    citation: hit ? blockToCitation(hit.block) : undefined,
  }
}

function parseMoneyMillions(text: string): number[] {
  const values: number[] = []
  for (const match of text.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)) {
    const raw = match[1]?.replace(/,/g, '')
    if (!raw) continue
    const num = Number(raw)
    if (!Number.isFinite(num)) continue
    values.push(num >= 1_000_000 ? num / 1_000_000 : num)
  }
  return values
}

function evaluateLiabilityCap(blocks: BlockRecord[], item: ContractChecklistItem): CriterionResult {
  const capMatch = item.label.match(/maximum\s*\$?\s*([\d,]+(?:\.\d+)?)/i)
  const capMillions = capMatch
    ? Number(capMatch[1]!.replace(/,/g, '')) / 1_000_000
    : 5

  const insuranceBlocks = blocks.filter((block) =>
    /insurance|liability|general aggregate|occurrence/i.test(block.text),
  )
  const text = insuranceBlocks.map((b) => b.text).join('\n')
  const millions = parseMoneyMillions(text)

  const hit = bestBlockForTerms(blocks, expandClauseTerms(['insurance', 'liability', 'coverage']))
  const exceeds = millions.some((value) => value > capMillions + 0.01)

  let status: CriterionStatus = 'warn'
  let detail = `Compare required limits to internal maximum ($${capMillions.toFixed(0)}M).`

  if (millions.length === 0) {
    detail = 'No liability dollar limits found in extracted text — see Attachment A / WA.'
  } else if (exceeds) {
    status = 'warn'
    detail = `Contract requires limits above $${capMillions.toFixed(0)}M internal cap (e.g. ${Math.max(...millions).toFixed(0)}M detected).`
  } else {
    status = 'pass'
    detail = `Required limits appear at or below $${capMillions.toFixed(0)}M internal cap.`
  }

  return {
    id: item.id,
    label: item.label,
    status,
    detail,
    citation: hit ? blockToCitation(hit.block) : undefined,
  }
}

function evaluateItem(item: ContractChecklistItem, blocks: BlockRecord[]): CriterionResult {
  if (item.reviewKind === 'contract_value') {
    return evaluateContractValue(blocks)
  }

  if (item.reviewKind === 'liability_cap') {
    return evaluateLiabilityCap(blocks, item)
  }

  if (item.mustContain) {
    const needle = item.mustContain.toLowerCase()
    const hitBlock = blocks.find((block) => block.text.toLowerCase().includes(needle))
    return {
      id: item.id,
      label: item.label,
      status: hitBlock ? 'pass' : 'fail',
      detail: hitBlock
        ? `Found “${item.mustContain}” in the contract.`
        : `Missing required entity name “${item.mustContain}”.`,
      citation: hitBlock ? blockToCitation(hitBlock) : undefined,
    }
  }

  const terms = expandClauseTerms(item.searchTerms)
  const hit = bestBlockForTerms(blocks, terms)
  const fullText = contractFullText(blocks).toLowerCase()

  if (item.absenceCheck) {
    const found = terms.some((term) => fullText.includes(term.toLowerCase()))
    return {
      id: item.id,
      label: item.label,
      status: found ? 'fail' : 'pass',
      detail: found
        ? 'Language matching this restriction appears in the contract — review scope.'
        : 'No matching restriction language found in extracted text.',
      citation: hit && found ? blockToCitation(hit.block) : undefined,
    }
  }

  if (hit) {
    return {
      id: item.id,
      label: item.label,
      status: 'pass',
      detail:
        hit.matchedTerms.length > 0
          ? `Matched: ${hit.matchedTerms.slice(0, 4).join(', ')}`
          : 'Related language found in the contract.',
      citation: blockToCitation(hit.block),
    }
  }

  return {
    id: item.id,
    label: item.label,
    status: 'warn',
    detail:
      'Not found in master contract text — may be in Work Authorization, specs, or Attachment D.',
  }
}

function verdictFromCriteria(criteria: CriterionResult[]): RfpVerdict {
  const failCount = criteria.filter((item) => item.status === 'fail').length
  const warnCount = criteria.filter((item) => item.status === 'warn').length

  if (failCount >= 1) return 'unlikely'
  if (warnCount >= Math.ceil(criteria.length * 0.4)) return 'might'
  return 'likely'
}

function summaryForReview(doc: DocumentMeta, criteria: CriterionResult[]): string {
  const pass = criteria.filter((item) => item.status === 'pass').length
  const warn = criteria.filter((item) => item.status === 'warn').length
  const fail = criteria.filter((item) => item.status === 'fail').length
  const cited = criteria.filter((item) => item.citation).length

  return `Keyword checklist for ${doc.filename.replace(/\.[^.]+$/, '')}: ${pass} pass, ${warn} review, ${fail} fail (${cited} with citations). Master agreement items may defer to Work Authorizations.`
}

export async function loadChecklistItems(checklistDocId: string): Promise<ContractChecklistItem[]> {
  const blocks = await fetchDocumentBlocks(checklistDocId)
  const text = blocks.map((block) => block.text).join('\n')
  return parseContractChecklistText(text)
}

/** Run construction subcontractor keyword checklist items against a single contract PDF (block search + heuristics). */
export async function buildContractKeywordReview(
  documents: DocumentMeta[],
  options: BuildContractKeywordReviewOptions,
): Promise<RfpResultsProfile | null> {
  const contractDoc = documents.find((doc) => doc.doc_id === options.contractDocId)
  const checklistDoc = documents.find((doc) => doc.doc_id === options.checklistDocId)

  if (!contractDoc || !checklistDoc) return null

  const [contractBlocks, items] = await Promise.all([
    fetchDocumentBlocks(contractDoc.doc_id),
    loadChecklistItems(checklistDoc.doc_id),
  ])

  if (contractBlocks.length === 0 || items.length === 0) return null

  const criteria = items.map((item) => evaluateItem(item, contractBlocks))

  return {
    profile_id: `contract-review-${contractDoc.doc_id}`,
    source_doc_id: contractDoc.doc_id,
    verdict: verdictFromCriteria(criteria),
    subject: {
      name: contractDoc.filename.replace(/\.[^.]+$/, ''),
      role: 'Contract keyword review',
    },
    criteria,
    summary: summaryForReview(contractDoc, criteria),
  }
}

/** Dev harness — parser + empty blocks guard */
export async function runContractKeywordReviewHarness(): Promise<void> {
  const sample = `Check Entity Name. Must Match "${SAMPLE_FIXTURE_COMPANY.legalName}" Check value of the contract. Check value of liability insurance. Maximum $5,000,000.00 Check for liquidated damages.`
  const items = parseContractChecklistText(sample)

  if (items.length < 3) {
    throw new Error('contract-keyword harness: expected at least 3 checklist items')
  }

  const entity = items.find((item) => item.mustContain?.includes(SAMPLE_FIXTURE_COMPANY.shortName))
  if (!entity?.mustContain) {
    throw new Error('contract-keyword harness: expected entity mustContain')
  }
}
