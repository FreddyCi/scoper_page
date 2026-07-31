import { EcpAgentRunDeniedError, runEcpAgentTool } from '@/ecp/agent-run'
import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import { ensureScoperEcpReadyBeforeAgentRun } from '@/ecp/environment'
import { buildAgentPrompt, createDocumentContextAttachment } from '@/lib/chat-context'
import type { ProposalPackageKind } from '@/lib/proposal-package-classifier'
import type { ProposalHandoffState } from '@/lib/proposal-context-roll'
import {
  buildSectionPrompt,
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

export function excerptsFromFindClauseResult(findResult: FindClauseResult): string[] {
  return findResult.matches
    .map((match) => match.citation.excerpt.trim())
    .filter((excerpt) => excerpt.length >= 20)
    .slice(0, 4)
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
): Promise<string> {
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

  if (excerpts.length === 0) {
    const findQuery = input.section.findClauseQuery.trim()
    contextTracker.recordText(findQuery)

    findResult = (await runEcpAgentTool({
      capabilityId: DOCUMENT_CAPABILITIES.find_clause,
      input: { query: findQuery, docIds, limit: 6 },
      ecpReady: true,
    })) as FindClauseResult

    const ecpExcerpts = excerptsFromFindClauseResult(findResult)
    excerpts =
      ecpExcerpts.length > 0 ? ecpExcerpts : (input.blockExcerptsFallback ?? [])
  }

  const sectionPrompt = buildSectionPrompt({
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
  })

  const prompt = buildAgentPrompt(sectionPrompt, [rfpAttachment])

  for (const excerpt of excerpts) {
    contextTracker.recordText(excerpt)
  }
  contextTracker.recordText(prompt)
  contextTracker.assertNotHard()

  try {
    if (!input.sendOverride) {
      await ensureScoperLoadedForProposal()
    }

    const result = input.sendOverride
      ? await input.sendOverride(prompt)
      : await scoper.send([{ role: 'user', content: prompt }])

    contextTracker.recordText(result.text)
    const text = result.text.trim()
    if (text.length > 0) return text
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

  return fallbackSectionMarkdown(input.section, input.volume, findResult, excerpts)
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

  const markdown = await generateProposalSectionMarkdownViaEcp({
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

  const markdown = await generateProposalSectionMarkdownViaEcp({
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

export { EcpAgentRunDeniedError, ProposalContextOverflowError }
