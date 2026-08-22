import type { ProposalRequirementsProfile } from '@/lib/types'
import { getProposalSetupState } from '@/lib/proposal-readiness'
import {
  resolveWebGpuUnavailableMessage,
  WEBGPU_UNAVAILABLE_BANNER_FALLBACK,
} from '@/lib/webgpu-user-messages'
import { getScoperClient } from '@/services/scoper-client'

/** Scout tour volume — smallest section count for fastest demo generate (BDA-295). */
export function pickScoutProposalVolumeId(
  profile: ProposalRequirementsProfile | null,
): string | null {
  if (!profile || profile.volumes.length === 0) return null

  const sorted = [...profile.volumes].sort((left, right) => {
    const leftSections = left.sections?.length ?? 0
    const rightSections = right.sections?.length ?? 0
    if (leftSections !== rightSections) {
      return leftSections - rightSections
    }
    return left.title.localeCompare(right.title)
  })

  return sorted[0]?.id ?? null
}

/** Sync read of WebGPU banner copy for Scout coach errors (BDA-295). */
export function readScoutWebGpuDegradedHint(): string | null {
  try {
    const state = getScoperClient().getState()
    if (state.webGpuAvailable === false) {
      return resolveWebGpuUnavailableMessage(state.webGpuError)
    }
    return null
  } catch {
    return WEBGPU_UNAVAILABLE_BANNER_FALLBACK
  }
}

export function scoutProposalProfileFailureMessage(
  storeError: string | null | undefined,
): string {
  const degraded = readScoutWebGpuDegradedHint()
  if (storeError?.trim()) {
    return degraded ? `${storeError} ${degraded}` : storeError
  }
  return (
    degraded ??
    'Could not build a proposal profile from the RFP. Check the solicitation PDF and try again.'
  )
}

export function scoutProposalGenerateFailureMessage(
  storeError: string | null | undefined,
  volumeError?: string | null,
): string {
  const degraded = readScoutWebGpuDegradedHint()
  const primary = volumeError?.trim() || storeError?.trim()
  if (primary && degraded) {
    return `${primary} ${degraded}`
  }
  if (primary) return primary
  return (
    degraded ??
    'Proposal volume generation did not complete. Try again from the panel or skip this step.'
  )
}

export function scoutProposalExportFailureMessage(baseMessage: string): string {
  const degraded = readScoutWebGpuDegradedHint()
  if (degraded) {
    return `${baseMessage} ${degraded}`
  }
  return baseMessage
}

export function assertScoutProposalReadyToGenerate(session: {
  documents: Parameters<typeof getProposalSetupState>[0]['documents']
  evaluationDocId: string | null
  companyContext: string
  proposalRequirementsProfile: ProposalRequirementsProfile | null
}): string | null {
  const setup = getProposalSetupState(session)
  if (!setup.readyToGenerate) {
    return 'Complete RFP selection, responder context, and build the requirements profile first.'
  }
  return null
}
