import type { ProposalRequirementsProfile } from '@/lib/types'
import { runAssembleProposalMarkdownHarness } from '@/lib/assemble-proposal-markdown'
import {
  runBuildProposalRfpProfileBaselineMappingHarness,
} from '@/services/build-proposal-rfp-profile'
import { patchProposalVolume, runBuildProposalVolumeSiblingHandoffHarness } from '@/services/build-proposal-volumes'
import { runProposalShareStoreHarness } from '@/services/proposal-share-store'
import { runProposalVolumeBodyEditHarness } from '@/services/proposal-store-generate-harness'
import { runProposalSectionCitationsHarness } from '@/services/proposal-volume-ecp'

/** Patching one volume for generate must not mutate edited sibling drafts (BDA-218). */
export function runAnalyzeProposeEditedSiblingHarness(): void {
  const editedBody = '## User edit\n\nHand-edited technical volume markdown.'
  const profile: ProposalRequirementsProfile = {
    profile_id: 'prof-edited-sibling',
    rfp_doc_id: 'rfp-1',
    summary: 'Two-volume harness.',
    built_at: new Date().toISOString(),
    packageKind: 'solicitation',
    packageWarnings: [],
    volumes: [
      {
        id: 'vol-a',
        title: 'Technical approach',
        requirementSummary: 'Methodology.',
        status: 'draft',
        bodyMarkdown: editedBody,
        edited: true,
        editedAt: '2026-08-02T12:00:00.000Z',
      },
      {
        id: 'vol-b',
        title: 'Management plan',
        requirementSummary: 'Staffing.',
        status: 'pending',
      },
    ],
  }

  const generatingSibling = patchProposalVolume(profile, 'vol-b', {
    status: 'generating',
    errorMessage: undefined,
  })

  const volA = generatingSibling.volumes.find((volume) => volume.id === 'vol-a')
  if (
    !volA ||
    volA.bodyMarkdown !== editedBody ||
    !volA.edited ||
    volA.status !== 'draft'
  ) {
    throw new Error(
      'runAnalyzeProposeEditedSiblingHarness: edited sibling must stay draft with same body',
    )
  }

  const volB = generatingSibling.volumes.find((volume) => volume.id === 'vol-b')
  if (!volB || volB.status !== 'generating') {
    throw new Error(
      'runAnalyzeProposeEditedSiblingHarness: only target volume should enter generating',
    )
  }
}

/** Single-volume profile patches leave other volume rows untouched (BDA-218 / BDA-202). */
export function runAnalyzeProposeSingleVolumePatchHarness(): void {
  const profile: ProposalRequirementsProfile = {
    profile_id: 'prof-single-patch',
    rfp_doc_id: 'rfp-1',
    summary: 'Isolation harness.',
    built_at: new Date().toISOString(),
    packageKind: 'solicitation',
    packageWarnings: [],
    volumes: [
      {
        id: 'vol-1',
        title: 'Volume one',
        requirementSummary: 'First.',
        status: 'pending',
      },
      {
        id: 'vol-2',
        title: 'Volume two',
        requirementSummary: 'Second.',
        status: 'draft',
        bodyMarkdown: '## Draft two\n\nExisting draft body.',
      },
    ],
  }

  const next = patchProposalVolume(profile, 'vol-1', { status: 'generating' })
  const untouched = next.volumes.find((volume) => volume.id === 'vol-2')
  if (
    !untouched ||
    untouched.status !== 'draft' ||
    untouched.bodyMarkdown !== '## Draft two\n\nExisting draft body.'
  ) {
    throw new Error(
      'runAnalyzeProposeSingleVolumePatchHarness: non-target volumes must not change',
    )
  }

  const target = next.volumes.find((volume) => volume.id === 'vol-1')
  if (!target || target.status !== 'generating') {
    throw new Error(
      'runAnalyzeProposeSingleVolumePatchHarness: only target volume should be patched',
    )
  }
}

/**
 * Consolidated analyze→propose loop coverage (BDA-218):
 * baseline analysisRefs, sibling handoff, body edits, citations, partial export + Sources, share round-trip.
 */
export function runAnalyzeProposeLoopHarness(): void {
  runBuildProposalRfpProfileBaselineMappingHarness()
  runBuildProposalVolumeSiblingHandoffHarness()
  runProposalVolumeBodyEditHarness()
  runProposalSectionCitationsHarness()
  runAssembleProposalMarkdownHarness()
  runProposalShareStoreHarness()
  runAnalyzeProposeEditedSiblingHarness()
  runAnalyzeProposeSingleVolumePatchHarness()
}
