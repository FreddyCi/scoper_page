import { assessProposalContextQuality } from '@/lib/proposal-context-quality'
import type { ProposalSetupState } from '@/lib/proposal-readiness'

export type ProposalContextGateState = {
  /** Meets min length (readiness) and passes quality heuristics (BDA-157). */
  ok: boolean
  qualityOk: boolean
  blockingWarnings: string[]
}

export function getProposalContextGateState(
  companyContext: string,
  setup: Pick<ProposalSetupState, 'hasContext'>,
): ProposalContextGateState {
  const quality = assessProposalContextQuality(companyContext)
  const qualityOk = setup.hasContext && quality.ok
  const blockingWarnings = setup.hasContext ? quality.warnings : []

  return {
    ok: qualityOk,
    qualityOk: quality.ok,
    blockingWarnings,
  }
}

/** Dev harness — setup gate quality inputs (BDA-166) */
export function runProposalSetupQualityGatesHarness(): void {
  const weak = getProposalContextGateState('TBD — company info pending review soon.', {
    hasContext: true,
  })
  if (weak.ok || weak.blockingWarnings.length === 0) {
    throw new Error('runProposalSetupQualityGatesHarness: weak context should block quality gate')
  }

  const short = getProposalContextGateState('Too short', { hasContext: false })
  if (short.ok || short.blockingWarnings.length > 0) {
    throw new Error('runProposalSetupQualityGatesHarness: missing min context should not list quality warnings')
  }

  const good = getProposalContextGateState(
    'Acme Systems is a CMMI Level 3 integrator specializing in cloud migration since 2004.',
    { hasContext: true },
  )
  if (!good.ok || good.blockingWarnings.length > 0) {
    throw new Error('runProposalSetupQualityGatesHarness: substantive context should pass')
  }

  const msaWarning =
    'This document reads like a contract or master agreement, not a solicitation RFP. ' +
    'Proposal volumes will follow contract-style themes—confirm this is the document you intend to respond to.'
  if (!msaWarning.toLowerCase().includes('contract')) {
    throw new Error('runProposalSetupQualityGatesHarness: MSA fixture warning shape unexpected')
  }
}
