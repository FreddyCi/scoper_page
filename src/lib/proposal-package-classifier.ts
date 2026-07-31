import type { BlockRecord } from '@/lib/types'

export type ProposalPackageKind = 'solicitation' | 'contract_framework' | 'unknown'

export type ClassifyProposalPackageInput = {
  filename?: string
  blocks?: BlockRecord[]
  /** When blocks are unavailable (tests, previews). */
  documentText?: string
}

export type ProposalPackageClassification = {
  packageKind: ProposalPackageKind
  packageWarnings: string[]
  solicitationScore: number
  contractScore: number
}

const CLASSIFIER_TEXT_SAMPLE_MAX = 120_000

const SOLICITATION_SIGNALS: { pattern: RegExp; weight: number }[] = [
  { pattern: /request\s+for\s+(proposal|quotations?|qualifications?)/i, weight: 4 },
  { pattern: /\brfp\b|\brfq\b|\brfi\b|\bitb\b/i, weight: 3 },
  { pattern: /invitation\s+to\s+(bid|tender)/i, weight: 3 },
  { pattern: /instructions\s+to\s+(offerors?|bidders?)/i, weight: 3 },
  { pattern: /section\s*[lm]\b/i, weight: 2 },
  { pattern: /evaluation\s+(factor|criteria)/i, weight: 2 },
  { pattern: /(submit|due)\s+.*proposal/i, weight: 2 },
  { pattern: /\b(offeror|bidder)\s+shall\b/i, weight: 2 },
  { pattern: /\bbidder\s+must\b/i, weight: 2 },
  { pattern: /\bsolicitation\b/i, weight: 2 },
  { pattern: /proposal\s+requirements/i, weight: 1 },
  { pattern: /volume\s+[i1-9]/i, weight: 1 },
]

const CONTRACT_FRAMEWORK_SIGNALS: { pattern: RegExp; weight: number }[] = [
  { pattern: /master\s+(service|services)\s+agreement/i, weight: 5 },
  { pattern: /\bmsa\b/i, weight: 4 },
  { pattern: /this\s+(master\s+)?(service\s+)?agreement/i, weight: 3 },
  { pattern: /agreement\s+is\s+entered\s+into/i, weight: 3 },
  { pattern: /between\s+.+\s+and\s+.+\s+\("?(client|customer|vendor|supplier)/i, weight: 2 },
  { pattern: /statement\s+of\s+work/i, weight: 2 },
  { pattern: /limitation\s+of\s+liability/i, weight: 2 },
  { pattern: /governing\s+law/i, weight: 2 },
  { pattern: /entire\s+agreement/i, weight: 2 },
  { pattern: /terms\s+and\s+conditions\s+of\s+this\s+agreement/i, weight: 2 },
  { pattern: /amendment\s+to\s+(this\s+)?agreement/i, weight: 2 },
  { pattern: /indemnif(y|ication)\s+.*\b(client|customer|company)\b/i, weight: 1 },
]

function scoreSignals(text: string, signals: { pattern: RegExp; weight: number }[]): number {
  let score = 0
  for (const { pattern, weight } of signals) {
    if (pattern.test(text)) {
      score += weight
    }
  }
  return score
}

function corpusFromInput(input: ClassifyProposalPackageInput): string {
  const parts: string[] = []
  if (input.filename?.trim()) {
    parts.push(input.filename)
  }
  if (input.documentText?.trim()) {
    parts.push(input.documentText)
  }
  if (input.blocks && input.blocks.length > 0) {
    parts.push(input.blocks.map((block) => block.text).join('\n'))
  }
  return parts.join('\n').slice(0, CLASSIFIER_TEXT_SAMPLE_MAX)
}

function warningsForKind(
  packageKind: ProposalPackageKind,
  solicitationScore: number,
  contractScore: number,
): string[] {
  if (packageKind === 'contract_framework') {
    return [
      'This document reads like a contract or master agreement, not a solicitation RFP. ' +
        'Proposal volumes will follow contract-style themes—confirm this is the document you intend to respond to.',
    ]
  }
  if (packageKind === 'unknown') {
    const hint =
      solicitationScore === 0 && contractScore === 0
        ? 'No strong RFP or contract markers were found.'
        : 'RFP and contract signals were mixed or weak.'
    return [`${hint} Using a generic solicitation-style outline.`]
  }
  return []
}

const MIN_KIND_SCORE = 2

/**
 * Classify uploaded package as solicitation RFP vs contract/MSA framework.
 * Pure heuristics over filename + block text (BDA-156).
 */
export function classifyProposalPackage(
  input: ClassifyProposalPackageInput,
): ProposalPackageClassification {
  const corpus = corpusFromInput(input)
  const solicitationScore = scoreSignals(corpus, SOLICITATION_SIGNALS)
  const contractScore = scoreSignals(corpus, CONTRACT_FRAMEWORK_SIGNALS)

  let packageKind: ProposalPackageKind = 'unknown'

  if (solicitationScore >= MIN_KIND_SCORE && solicitationScore > contractScore) {
    packageKind = 'solicitation'
  } else if (contractScore >= MIN_KIND_SCORE && contractScore > solicitationScore) {
    packageKind = 'contract_framework'
  } else if (
    solicitationScore >= MIN_KIND_SCORE &&
    contractScore >= MIN_KIND_SCORE &&
    solicitationScore === contractScore
  ) {
    packageKind = 'unknown'
  } else if (solicitationScore >= MIN_KIND_SCORE) {
    packageKind = 'solicitation'
  } else if (contractScore >= MIN_KIND_SCORE) {
    packageKind = 'contract_framework'
  }

  const packageWarnings = warningsForKind(packageKind, solicitationScore, contractScore)

  return {
    packageKind,
    packageWarnings,
    solicitationScore,
    contractScore,
  }
}

const HARNESS_IT_RFP_TEXT = `
REQUEST FOR PROPOSAL — IT Services Platform
Vendor shall provide cloud migration and managed support services.
Bidder must hold CMMI Level 3 certification or equivalent.
Pricing must be submitted as a fixed-fee schedule.
`.trim()

const HARNESS_MSA_TEXT = `
MASTER SERVICES AGREEMENT
This Master Services Agreement is entered into between Client Corp and Vendor Inc.
Services will be performed under Statements of Work.
Limitation of Liability. Governing Law. Entire Agreement.
`.trim()

/** Dev harness — solicitation vs contract fixtures (BDA-156) */
export function runProposalPackageClassifierHarness(): void {
  const rfp = classifyProposalPackage({
    filename: 'rfp-it-services.pdf',
    documentText: HARNESS_IT_RFP_TEXT,
  })
  if (rfp.packageKind !== 'solicitation') {
    throw new Error(
      `runProposalPackageClassifierHarness: expected solicitation, got ${rfp.packageKind} (scores ${rfp.solicitationScore}/${rfp.contractScore})`,
    )
  }

  const msa = classifyProposalPackage({
    filename: 'acme-msa-template.pdf',
    documentText: HARNESS_MSA_TEXT,
  })
  if (msa.packageKind !== 'contract_framework') {
    throw new Error(
      `runProposalPackageClassifierHarness: expected contract_framework, got ${msa.packageKind} (scores ${msa.solicitationScore}/${msa.contractScore})`,
    )
  }
  if (msa.packageWarnings.length === 0) {
    throw new Error('runProposalPackageClassifierHarness: expected contract_framework warning')
  }

  const empty = classifyProposalPackage({ filename: 'notes.txt', documentText: 'Meeting minutes.' })
  if (empty.packageKind !== 'unknown') {
    throw new Error('runProposalPackageClassifierHarness: sparse doc should be unknown')
  }
}
