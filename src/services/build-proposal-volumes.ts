import { ensureScoperEcpReadyBeforeAgentRun } from '@/ecp/environment'
import { buildVolumePrompt } from '@/lib/proposal-prompts'
import type {
  BlockRecord,
  DocumentMeta,
  ProposalRequirementsProfile,
  ProposalVolume,
} from '@/lib/types'
import { fetchDocumentBlocks, groupBlocksBySection } from '@/services/document-blocks'
import { getScoperClient, ScoperWebGpuUnavailableError } from '@/services/scoper-client'

export type BuildProposalVolumesOptions = {
  documents: DocumentMeta[]
  profile: ProposalRequirementsProfile
  companyContext: string
  onProfileUpdate: (profile: ProposalRequirementsProfile) => void
}

export function patchProposalVolume(
  profile: ProposalRequirementsProfile,
  volumeId: string,
  patch: Partial<ProposalVolume>,
): ProposalRequirementsProfile {
  return {
    ...profile,
    volumes: profile.volumes.map((volume) =>
      volume.id === volumeId ? { ...volume, ...patch } : volume,
    ),
  }
}

function excerptsForVolume(blocks: BlockRecord[], volume: ProposalVolume): string[] {
  const groups = groupBlocksBySection(blocks)
  const titleNeedle = volume.title.toLowerCase()
  const matched =
    groups.find((group) => group.label.toLowerCase() === titleNeedle) ??
    groups.find((group) => group.label.toLowerCase().includes(titleNeedle.slice(0, 24)))

  const sourceBlocks = matched?.blocks ?? blocks
  const lines: string[] = []

  for (const block of sourceBlocks) {
    const line = block.text.replace(/\s+/g, ' ').trim()
    if (line.length < 40) continue
    lines.push(line.slice(0, 320))
    if (lines.length >= 4) break
  }

  return lines
}

function stubVolumeMarkdown(
  volume: ProposalVolume,
  excerpts: string[],
  companyContext: string,
): string {
  const excerptBlock =
    excerpts.length > 0
      ? excerpts.map((line) => `> ${line}`).join('\n\n')
      : '_Draft placeholder — connect the on-device model for full generation._'

  return [
    `# ${volume.title}`,
    '',
    '## Responder context',
    companyContext.trim().slice(0, 600),
    '',
    '## Solicitation alignment',
    volume.requirementSummary,
    '',
    '## Draft response',
    excerptBlock,
  ].join('\n')
}

async function generateVolumeBody(
  prompt: string,
  volume: ProposalVolume,
  excerpts: string[],
  companyContext: string,
): Promise<string> {
  try {
    await ensureScoperEcpReadyBeforeAgentRun()
    const scoper = getScoperClient()
    const result = await scoper.send([{ role: 'user', content: prompt }])
    const text = result.text.trim()
    if (text.length > 0) return text
  } catch (error) {
    if (!(error instanceof ScoperWebGpuUnavailableError) && import.meta.env.DEV) {
      console.warn('[build-proposal-volumes] model generation failed', error)
    }
  }

  return stubVolumeMarkdown(volume, excerpts, companyContext)
}

/** Generate markdown for each volume sequentially; caller owns store busy flags. ECP path: BDA-127. */
export async function buildProposalVolumes(
  options: BuildProposalVolumesOptions,
): Promise<ProposalRequirementsProfile> {
  const rfpDoc = options.documents.find((doc) => doc.doc_id === options.profile.rfp_doc_id)
  const blocks = await fetchDocumentBlocks(options.profile.rfp_doc_id)

  let profile: ProposalRequirementsProfile = {
    ...options.profile,
    volumes: options.profile.volumes.map((volume) => ({ ...volume })),
  }

  for (const volume of profile.volumes) {
    profile = patchProposalVolume(profile, volume.id, {
      status: 'generating',
      errorMessage: undefined,
    })
    options.onProfileUpdate(profile)

    try {
      const excerpts = excerptsForVolume(blocks, volume)
      const prompt = buildVolumePrompt(
        volume,
        {
          companyContext: options.companyContext,
          rfpFilename: rfpDoc?.filename,
        },
        excerpts,
      )

      const bodyMarkdown = await generateVolumeBody(
        prompt,
        volume,
        excerpts,
        options.companyContext,
      )

      profile = patchProposalVolume(profile, volume.id, {
        status: 'draft',
        bodyMarkdown,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Volume generation failed'
      profile = patchProposalVolume(profile, volume.id, {
        status: 'error',
        errorMessage: message,
      })
    }

    options.onProfileUpdate(profile)
  }

  return profile
}
