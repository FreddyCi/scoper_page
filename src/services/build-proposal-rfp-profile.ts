import type { BlockRecord, DocumentMeta, ProposalRequirementsProfile, ProposalVolume } from '@/lib/types'
import {
  commonSectionPathPrefix,
  compactSectionPathLabel,
  fetchDocumentBlocks,
  groupBlocksBySection,
} from '@/services/document-blocks'
import { ingestFile } from '@/services/ingest-router'

export type BuildProposalRfpProfileOptions = {
  rfpDocId: string
  companyContext?: string
}

const PROPOSAL_SUMMARY_MAX = 480
const MAX_VOLUMES = 12
const MIN_SECTION_CHARS = 120

const PROPOSAL_SECTION_HINT =
  /section\s*[lm]\b|instructions\s*to\s*offerors|evaluation\s*factors|proposal\s*requirements|submission\s*requirements|volume\s*\d|technical\s*approach|management\s*approach|past\s*performance|cost\s*proposal|price\s*proposal/i

function volumeIdFromTitle(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `vol-${index}-${slug || 'section'}`
}

function requirementSummaryForSection(blocks: BlockRecord[], title: string): string {
  const text = blocks
    .map((block) => block.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length === 0) {
    return `Respond to ${title} requirements in the solicitation.`
  }
  return text.length > 240 ? `${text.slice(0, 237)}…` : text
}

function deriveVolumesFromBlocks(blocks: BlockRecord[]): ProposalVolume[] {
  const sectionGroups = groupBlocksBySection(blocks)
  const paths = blocks
    .map((block) => block.section_path?.trim())
    .filter((path): path is string => Boolean(path))
  const prefix = commonSectionPathPrefix(paths)

  const candidates = sectionGroups
    .map((group) => {
      const label =
        group.label === 'Document' && paths.length > 0
          ? compactSectionPathLabel(paths[0] ?? group.label, prefix)
          : compactSectionPathLabel(group.label, prefix)
      const charCount = group.blocks.reduce((total, block) => total + block.text.length, 0)
      const hintScore =
        (PROPOSAL_SECTION_HINT.test(label) ? 2 : 0) +
        (PROPOSAL_SECTION_HINT.test(group.blocks.map((b) => b.text).join(' ')) ? 1 : 0)
      return { label, blocks: group.blocks, charCount, hintScore }
    })
    .filter((item) => item.charCount >= MIN_SECTION_CHARS || item.hintScore > 0)

  const ranked =
    candidates.length > 0
      ? [...candidates].sort((left, right) => {
          if (right.hintScore !== left.hintScore) return right.hintScore - left.hintScore
          return right.charCount - left.charCount
        })
      : sectionGroups.map((group) => ({
          label: compactSectionPathLabel(group.label, prefix),
          blocks: group.blocks,
          charCount: group.blocks.reduce((total, block) => total + block.text.length, 0),
          hintScore: 0,
        }))

  const selected = ranked.slice(0, MAX_VOLUMES)

  return selected.map((item, index) => ({
    id: volumeIdFromTitle(item.label, index),
    title: item.label,
    requirementSummary: requirementSummaryForSection(item.blocks, item.label),
    solicitationRefs: item.label.match(/section\s*[a-z0-9.]+/gi) ?? undefined,
    status: 'pending' as const,
  }))
}

function buildProfileSummary(
  filename: string,
  volumes: ProposalVolume[],
  companyContext: string,
): string {
  const titles = volumes.map((volume) => volume.title).join('; ')
  const contextNote =
    companyContext.trim().length > 0
      ? ` Responder context provided (${companyContext.trim().length} chars).`
      : ''
  const summary = `${volumes.length} proposal volume(s) derived from ${filename}: ${titles}.${contextNote}`
  return summary.length > PROPOSAL_SUMMARY_MAX
    ? `${summary.slice(0, PROPOSAL_SUMMARY_MAX - 1)}…`
    : summary
}

/** Extract solicitation-aligned volumes from ingested RFP blocks (in-memory; no DuckDB profile table). */
export async function buildProposalRfpProfile(
  documents: DocumentMeta[],
  options: BuildProposalRfpProfileOptions,
): Promise<ProposalRequirementsProfile | null> {
  const rfpDoc = documents.find((doc) => doc.doc_id === options.rfpDocId)
  if (!rfpDoc) return null

  const blocks = await fetchDocumentBlocks(options.rfpDocId)
  if (blocks.length === 0) return null

  let volumes = deriveVolumesFromBlocks(blocks)
  if (volumes.length === 0) {
    volumes = [
      {
        id: 'vol-complete-proposal',
        title: 'Complete proposal response',
        requirementSummary:
          'Address all instructions and evaluation factors in the solicitation using the attached RFP.',
        status: 'pending',
      },
    ]
  }

  return {
    profile_id: `proposal-req-${options.rfpDocId}-${Date.now()}`,
    rfp_doc_id: options.rfpDocId,
    volumes,
    summary: buildProfileSummary(
      rfpDoc.filename,
      volumes,
      options.companyContext ?? '',
    ),
    built_at: new Date().toISOString(),
  }
}

/** Dev harness — ingest sample PDF and assert ≥1 volume (BDA-116 / BDA-117) */
export async function runProposalRfpProfileHarness(): Promise<void> {
  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`proposal RFP profile harness: failed to load sample PDF (${response.status})`)
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

  const profile = await buildProposalRfpProfile([document], {
    rfpDocId: document.doc_id,
    companyContext: 'Harness responder with 20+ chars of context.',
  })

  if (!profile || profile.volumes.length === 0) {
    throw new Error('proposal RFP profile harness: expected at least one volume')
  }

  if (!profile.volumes[0]?.title.trim()) {
    throw new Error('proposal RFP profile harness: volume title must be non-empty')
  }
}
