import { runScoutAction } from '@/lib/scout/actions'
import {
  GENERATE_PROPOSAL_JOURNEY_STEP_COUNT,
  generateProposalJourney,
} from '@/lib/scout/journeys/generate-proposal'
import { pickScoutProposalVolumeId } from '@/lib/scout/proposal-scout-helpers'
import { assertValidScoutSteps } from '@/lib/scout/types'
import type { ProposalRequirementsProfile } from '@/lib/types'
import { useSessionStore } from '@/store/session-store'
import { useScoutStore } from '@/store/scout-store'

const GENERATE_PROPOSAL_ACTION_STEPS: Record<string, string | undefined> = {
  'load-sample': 'load_sample_proposal',
  'setup-panel': 'navigate_profiles',
  'build-profile': 'build_proposal_profile',
  'generate-volume': 'generate_proposal_volume',
  'export-markdown': 'export_proposal_markdown',
  done: 'complete_journey',
}

function createHarnessProposalProfile(): ProposalRequirementsProfile {
  return {
    profile_id: 'scout-harness',
    rfp_doc_id: 'rfp',
    summary: 'Harness profile',
    built_at: new Date().toISOString(),
    packageKind: 'solicitation',
    packageWarnings: [],
    volumes: [
      {
        id: 'vol-large',
        title: 'Technical approach',
        requirementSummary: 'Large volume',
        status: 'pending',
        sections: [
          { id: 's1', title: 'A', findClauseQuery: 'a', status: 'pending' },
          { id: 's2', title: 'B', findClauseQuery: 'b', status: 'pending' },
          { id: 's3', title: 'C', findClauseQuery: 'c', status: 'pending' },
        ],
      },
      {
        id: 'vol-small',
        title: 'Pricing',
        requirementSummary: 'Small volume',
        status: 'pending',
        sections: [{ id: 's4', title: 'Price', findClauseQuery: 'price', status: 'pending' }],
      },
    ],
  }
}

/** Dev harness — Generate Proposal journey wiring (BDA-295). */
export async function runScoutGenerateProposalJourneyHarness(): Promise<void> {
  assertValidScoutSteps(generateProposalJourney)

  if (generateProposalJourney.steps.length !== GENERATE_PROPOSAL_JOURNEY_STEP_COUNT) {
    throw new Error('runScoutGenerateProposalJourneyHarness: unexpected proposal journey step count')
  }

  for (const step of generateProposalJourney.steps) {
    const expectedAction = GENERATE_PROPOSAL_ACTION_STEPS[step.id]
    if (expectedAction !== step.action) {
      throw new Error(
        `runScoutGenerateProposalJourneyHarness: step "${step.id}" action mismatch (expected ${expectedAction ?? 'none'}, got ${step.action ?? 'none'})`,
      )
    }
  }

  const profile = createHarnessProposalProfile()
  const picked = pickScoutProposalVolumeId(profile)
  if (picked !== 'vol-small') {
    throw new Error('runScoutGenerateProposalJourneyHarness: expected smallest volume vol-small')
  }

  useSessionStore.getState().resetSession()
  useScoutStore.getState().resetScoutProgress()

  const buildEmpty = await runScoutAction('build_proposal_profile')
  if (buildEmpty.ok) {
    throw new Error('runScoutGenerateProposalJourneyHarness: build_proposal_profile should fail on empty session')
  }

  const generateEmpty = await runScoutAction('generate_proposal_volume')
  if (generateEmpty.ok) {
    throw new Error(
      'runScoutGenerateProposalJourneyHarness: generate_proposal_volume should fail without profile',
    )
  }

  useSessionStore.getState().resetSession()
  useScoutStore.getState().resetScoutProgress()
}
