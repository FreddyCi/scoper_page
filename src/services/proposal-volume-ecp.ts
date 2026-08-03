import { EcpAgentRunDeniedError, runEcpAgentTool } from '@/ecp/agent-run'
import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import { ensureScoperEcpReadyBeforeAgentRun } from '@/ecp/environment'
import { buildAgentPrompt, createDocumentContextAttachment } from '@/lib/chat-context'
import { buildProposalHandoffBlock } from '@/lib/proposal-context-roll'
import type { ProposalPackageKind } from '@/lib/proposal-package-classifier'
import type { ProposalHandoffState } from '@/lib/proposal-context-roll'
import {
  buildSectionPrompt,
  buildSectionPromptParts,
  buildVolumeFindClauseQuery,
} from '@/lib/proposal-prompts'
import {
  createProposalContextTracker,
  ProposalContextOverflowError,
  type ProposalContextTracker,
} from '@/lib/proposal-context-tracker'
import type {
  DocumentMeta,
  FindClauseResult,
  ProposalVolume,
  ProposalVolumeSection,
  CitationRef,
} from '@/lib/types'
import { getScoperClient, ScoperWebGpuUnavailableError } from '@/services/scoper-client'
import type { ScoperGenerateResult } from '@/lib/scoper-protocol'

export type ProposalSectionEcpInput = {
  section: ProposalVolumeSection
  volume: ProposalVolume
  packageKind: ProposalPackageKind
  handoff: ProposalHandoffState | null
  companyContext: string
  rfpDoc: DocumentMeta
  /** Pre-retrieved ECP excerpts; when empty, find_clause runs using section.findClauseQuery. */
  excerpts?: string[]
  /** Citations aligned with pre-supplied excerpts (review retrieve). */
  citations?: CitationRef[]
  blockExcerptsFallback?: string[]
  contextTracker?: ProposalContextTracker
  handoffChunkIndex?: number
  /** Dev harness — assert exactly one isolated send. */
  sendOverride?: (prompt: string) => Promise<ScoperGenerateResult>
}

export type ProposalVolumeEcpInput = {
  volume: ProposalVolume
  companyContext: string
  rfpDoc: DocumentMeta
  blockExcerpts: string[]
  packageKind?: ProposalPackageKind
  contextTracker?: ProposalContextTracker
}

export type ProposalSectionEcpResult = {
  markdown: string
  citations: CitationRef[]
}

const FIND_CLAUSE_EXCERPT_MIN_CHARS = 20
const FIND_CLAUSE_PROMPT_MAX_MATCHES = 4

function findClauseMatchesForPrompt(findResult: FindClauseResult): FindClauseResult['matches'] {
  return findResult.matches
    .filter((match) => match.citation.excerpt.trim().length >= FIND_CLAUSE_EXCERPT_MIN_CHARS)
    .slice(0, FIND_CLAUSE_PROMPT_MAX_MATCHES)
}

export function excerptsFromFindClauseResult(findResult: FindClauseResult): string[] {
  return findClauseMatchesForPrompt(findResult).map((match) => match.citation.excerpt.trim())
}

export function citationsFromFindClauseResult(findResult: FindClauseResult): CitationRef[] {
  return findClauseMatchesForPrompt(findResult).map((match) => match.citation)
}

async function ensureScoperLoadedForProposal(): Promise<void> {
  const scoper = getScoperClient()
  const env = await scoper.probeEnvironment()

  if (!env.webGpuAvailable) {
    throw new ScoperWebGpuUnavailableError(
      env.webGpuError ?? 'WebGPU is required for on-device proposal generation.',
    )
  }

  if (scoper.getState().status !== 'ready') {
    await scoper.load()
  }
}

function fallbackSectionMarkdown(
  section: ProposalVolumeSection,
  volume: ProposalVolume,
  findResult: FindClauseResult,
  excerpts: string[],
): string {
  if (findResult.summary.trim().length > 0) {
    return [
      `## ${section.title}`,
      '',
      findResult.summary.trim(),
      '',
      '### RFP evidence',
      ...excerpts.map((line) => `- ${line}`),
    ].join('\n')
  }

  if (excerpts.length > 0) {
    return [
      `## ${section.title}`,
      '',
      `_Draft for ${volume.title} — evidence excerpts:_`,
      '',
      ...excerpts.map((line) => `- ${line}`),
    ].join('\n')
  }

  return ''
}

/**
 * Isolated sectional turn: optional ECP find_clause → section prompt → one Scoper send (BDA-163).
 */
export async function generateProposalSectionMarkdownViaEcp(
  input: ProposalSectionEcpInput,
): Promise<ProposalSectionEcpResult> {
  if (!input.sendOverride) {
    await ensureScoperEcpReadyBeforeAgentRun()
  }

  const scoper = getScoperClient()
  const contextTracker =
    input.contextTracker ??
    createProposalContextTracker({ effectiveMaxSeqLen: scoper.getState().maxSeqLen })

  const rfpAttachment = createDocumentContextAttachment(input.rfpDoc)
  const docIds = [input.rfpDoc.doc_id]

  let findResult: FindClauseResult = { matches: [], summary: '' }
  let excerpts = input.excerpts ?? []
  let citations = input.citations ?? []

  if (excerpts.length === 0) {
    const findQuery = input.section.findClauseQuery.trim()
    contextTracker.recordSegment('ecp_tool', findQuery)

    findResult = (await runEcpAgentTool({
      capabilityId: DOCUMENT_CAPABILITIES.find_clause,
      input: { query: findQuery, docIds, limit: 6 },
      ecpReady: true,
    })) as FindClauseResult

    const ecpExcerpts = excerptsFromFindClauseResult(findResult)
    citations = citationsFromFindClauseResult(findResult)
    excerpts =
      ecpExcerpts.length > 0 ? ecpExcerpts : (input.blockExcerptsFallback ?? [])
  } else if (input.citations?.length) {
    citations = input.citations
  }

  const sectionPromptInput = {
    section: input.section,
    volume: input.volume,
    handoff: input.handoff,
    excerpts,
    context: {
      companyContext: input.companyContext,
      rfpFilename: input.rfpDoc.filename,
    },
    packageKind: input.packageKind,
    handoffChunkIndex: input.handoffChunkIndex,
  }

  const handoffBlock =
    input.handoff != null
      ? buildProposalHandoffBlock(input.handoff, input.handoffChunkIndex ?? 1)
      : ''
  const parts = buildSectionPromptParts(sectionPromptInput)
  const rfpMeta = [rfpAttachment.label, rfpAttachment.description].filter(Boolean).join('\n')

  contextTracker.recordSegment('system', parts.system)
  if (handoffBlock.length > 0) {
    contextTracker.recordSegment('handoff', handoffBlock)
  }
  contextTracker.recordSegment('rfp_label', rfpMeta)
  const userBody =
    handoffBlock.length > 0 && parts.user.startsWith(handoffBlock)
      ? parts.user.slice(handoffBlock.length).replace(/^\s+/, '')
      : parts.user
  contextTracker.recordSegment('active_turn', userBody)

  const sectionPrompt = buildSectionPrompt(sectionPromptInput)

  const prompt = buildAgentPrompt(sectionPrompt, [rfpAttachment])

  contextTracker.assertNotHard()

  try {
    if (!input.sendOverride) {
      await ensureScoperLoadedForProposal()
    }

    const result = input.sendOverride
      ? await input.sendOverride(prompt)
      : await scoper.send([{ role: 'user', content: prompt }])

    contextTracker.recordSegment('active_turn', result.text)
    const text = result.text.trim()
    if (text.length > 0) {
      return { markdown: text, citations }
    }
  } catch (error) {
    if (error instanceof ProposalContextOverflowError) {
      throw error
    }
    if (error instanceof EcpAgentRunDeniedError) {
      throw error
    }
    if (error instanceof ScoperWebGpuUnavailableError) {
      throw error
    }
    if (import.meta.env.DEV) {
      console.warn('[proposal-volume-ecp] sectional Scoper generation failed', error)
    }
  }

  return {
    markdown: fallbackSectionMarkdown(input.section, input.volume, findResult, excerpts),
    citations,
  }
}

/**
 * Volume-level entry — one synthetic section, same isolated send path (BDA-127 wrapper).
 */
export async function generateProposalVolumeMarkdownViaEcp(
  input: ProposalVolumeEcpInput,
): Promise<string> {
  const section: ProposalVolumeSection = {
    id: `sec-whole-${input.volume.id}`,
    title: input.volume.title,
    findClauseQuery: buildVolumeFindClauseQuery(input.volume),
    status: 'pending',
  }

  const { markdown } = await generateProposalSectionMarkdownViaEcp({
    section,
    volume: input.volume,
    packageKind: input.packageKind ?? 'solicitation',
    handoff: null,
    companyContext: input.companyContext,
    rfpDoc: input.rfpDoc,
    excerpts: [],
    blockExcerptsFallback: input.blockExcerpts,
    contextTracker: input.contextTracker,
  })

  if (markdown.length > 0 && !markdown.startsWith('#')) {
    return [`# ${input.volume.title}`, '', markdown].join('\n')
  }

  return markdown
}

/** Dev harness — sectional prompt + single send (BDA-163) */
export async function runProposalSectionEcpHarness(): Promise<void> {
  let sendCount = 0
  let lastPrompt = ''

  const volume: ProposalVolume = {
    id: 'vol-h',
    title: 'Technical approach',
    requirementSummary: 'Methodology per Section L.',
    solicitationRefs: ['Section L.1'],
    status: 'pending',
  }

  const section: ProposalVolumeSection = {
    id: 'sec-1',
    title: 'Methodology',
    findClauseQuery: 'methodology Section L installation',
    status: 'pending',
  }

  const { markdown } = await generateProposalSectionMarkdownViaEcp({
    section,
    volume,
    packageKind: 'solicitation',
    handoff: null,
    companyContext: 'Acme Systems — twenty years of delivery experience.',
    rfpDoc: {
      doc_id: 'rfp-1',
      filename: 'RFP.pdf',
      mime: 'application/pdf',
      role: 'unknown',
      uploaded_at: new Date().toISOString(),
    },
    excerpts: ['Section L.1 requires a detailed methodology.'],
    sendOverride: async (prompt) => {
      sendCount += 1
      lastPrompt = prompt
      return {
        text: '## Methodology\n\nHarness section body.',
        tokensPerSecond: 1,
        finishReason: 'stop',
      }
    },
  })

  if (sendCount !== 1) {
    throw new Error(`runProposalSectionEcpHarness: expected 1 send, got ${sendCount}`)
  }
  if (!lastPrompt.includes('Methodology') || !lastPrompt.includes('Write only this section')) {
    throw new Error('runProposalSectionEcpHarness: prompt missing section guardrails')
  }
  if (!markdown.includes('Harness section body')) {
    throw new Error('runProposalSectionEcpHarness: expected markdown from send override')
  }
}

/** Dev harness — find_clause citations persist alongside excerpts (BDA-212). */
export function runProposalSectionCitationsHarness(): void {
  const findResult: FindClauseResult = {
    matches: [
      {
        relevance: 'high',
        citation: {
          doc_id: 'rfp-1',
          block_id: 'rfp-1:p2:i3',
          page_num: 2,
          excerpt: 'Section L.1 requires a detailed methodology and schedule.',
        },
      },
      {
        relevance: 'low',
        citation: {
          doc_id: 'rfp-1',
          block_id: 'rfp-1:p2:i4',
          excerpt: 'too short',
        },
      },
    ],
    summary: '',
  }

  const citations = citationsFromFindClauseResult(findResult)
  if (citations.length !== 1 || citations[0]?.block_id !== 'rfp-1:p2:i3') {
    throw new Error('runProposalSectionCitationsHarness: expected one citation from find_clause matches')
  }

  const excerpts = excerptsFromFindClauseResult(findResult)
  if (excerpts.length !== 1 || !excerpts[0]?.includes('methodology')) {
    throw new Error('runProposalSectionCitationsHarness: excerpt filter should mirror citations')
  }
}

export { EcpAgentRunDeniedError, ProposalContextOverflowError }
