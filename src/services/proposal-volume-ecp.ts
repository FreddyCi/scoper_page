import { EcpAgentRunDeniedError, runEcpAgentTool } from '@/ecp/agent-run'
import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import { ensureScoperEcpReadyBeforeAgentRun } from '@/ecp/environment'
import { buildAgentPrompt, createDocumentContextAttachment } from '@/lib/chat-context'
import {
  buildVolumeFindClauseQuery,
  buildVolumePrompt,
} from '@/lib/proposal-prompts'
import {
  createProposalContextTracker,
  ProposalContextOverflowError,
  type ProposalContextTracker,
} from '@/lib/proposal-context-tracker'
import type { DocumentMeta, FindClauseResult, ProposalVolume } from '@/lib/types'
import { getScoperClient, ScoperWebGpuUnavailableError } from '@/services/scoper-client'

export type ProposalVolumeEcpInput = {
  volume: ProposalVolume
  companyContext: string
  rfpDoc: DocumentMeta
  blockExcerpts: string[]
  /** Shared batch tracker; reset by caller before each section/volume send. */
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

function excerptsFromFindResult(findResult: FindClauseResult): string[] {
  return findResult.matches
    .map((match) => match.citation.excerpt.trim())
    .filter((excerpt) => excerpt.length >= 20)
    .slice(0, 4)
}

/**
 * ECP find_clause (RFP-scoped) → enriched volume prompt → Scoper markdown.
 * Does not read or write chat thread state.
 */
export async function generateProposalVolumeMarkdownViaEcp(
  input: ProposalVolumeEcpInput,
): Promise<string> {
  await ensureScoperEcpReadyBeforeAgentRun()

  const scoper = getScoperClient()
  const contextTracker =
    input.contextTracker ??
    createProposalContextTracker({ effectiveMaxSeqLen: scoper.getState().maxSeqLen })

  const rfpAttachment = createDocumentContextAttachment(input.rfpDoc)
  const findQuery = buildVolumeFindClauseQuery(input.volume)
  const docIds = [input.rfpDoc.doc_id]

  contextTracker.recordText(findQuery)

  const findResult = (await runEcpAgentTool({
    capabilityId: DOCUMENT_CAPABILITIES.find_clause,
    input: { query: findQuery, docIds, limit: 6 },
    ecpReady: true,
  })) as FindClauseResult

  const ecpExcerpts = excerptsFromFindResult(findResult)
  const excerpts = ecpExcerpts.length > 0 ? ecpExcerpts : input.blockExcerpts

  const volumePrompt = buildVolumePrompt(
    input.volume,
    {
      companyContext: input.companyContext,
      rfpFilename: input.rfpDoc.filename,
    },
    excerpts,
  )

  const prompt = buildAgentPrompt(volumePrompt, [rfpAttachment])

  for (const excerpt of excerpts) {
    contextTracker.recordText(excerpt)
  }
  contextTracker.recordText(prompt)
  contextTracker.assertNotHard()

  try {
    await ensureScoperLoadedForProposal()
    const result = await scoper.send([{ role: 'user', content: prompt }])
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
      console.warn('[proposal-volume-ecp] Scoper generation failed', error)
    }
  }

  if (findResult.summary.trim().length > 0) {
    return [
      `# ${input.volume.title}`,
      '',
      findResult.summary.trim(),
      '',
      '## RFP evidence',
      ...excerpts.map((line) => `- ${line}`),
    ].join('\n')
  }

  return ''
}

export { EcpAgentRunDeniedError, ProposalContextOverflowError }
