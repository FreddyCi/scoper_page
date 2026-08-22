import { WEBGPU_UNAVAILABLE_BANNER_FALLBACK } from '@/lib/webgpu-user-messages'
import { SCOUT_JOURNEY_ACCENTS, type ScoutJourney } from '@/lib/scout/types'
import { SCOUT_TARGETS } from '@/lib/scout/targets'

const PROPOSAL_WEBGPU_DEGRADED_NOTE = ` If the on-device model is unavailable (${WEBGPU_UNAVAILABLE_BANNER_FALLBACK.toLowerCase()}), you can still walk setup and export any drafted markdown that appears.`

/** Generate a proposal — RFP + responder context to draft volumes (BDA-280). */
export const generateProposalJourney: ScoutJourney = {
  id: 'generate_proposal',
  title: 'Generate a proposal',
  description:
    'Load a sample solicitation and responder notes, build a requirements profile, draft one volume, and export markdown — locally.',
  accent: SCOUT_JOURNEY_ACCENTS.generate_proposal,
  steps: [
    {
      id: 'load-sample',
      title: 'Load the sample solicitation package',
      body:
        'We will ingest the DPR construction MSA as the solicitation plus a buyer rubric markdown attachment so you can walk through proposal setup without uploading your own files.',
      action: 'load_sample_proposal',
    },
    {
      id: 'setup-panel',
      title: 'Review proposal setup',
      body:
        'Confirm the solicitation RFP is selected, add your company as the responder, and check the readiness checklist — context stays on your machine and steers volume outlines.',
      target: SCOUT_TARGETS.proposalSetupPanel,
      action: 'navigate_profiles',
    },
    {
      id: 'build-profile',
      title: 'Build the requirements profile',
      body:
        'Scoper extracts volume headings and section structure from the RFP. This profile drives sectional drafting — allow time for the on-device AI model on first run (~290 MB download).' +
        PROPOSAL_WEBGPU_DEGRADED_NOTE,
      target: SCOUT_TARGETS.proposalBuildProfile,
      action: 'build_proposal_profile',
    },
    {
      id: 'generate-volume',
      title: 'Generate one proposal volume',
      body:
        'Draft the smallest volume first to see cited find-clause retrieval in action. Full multi-volume batch generation works the same way from the panel.' +
        PROPOSAL_WEBGPU_DEGRADED_NOTE,
      target: SCOUT_TARGETS.proposalGenerateVolume,
      action: 'generate_proposal_volume',
    },
    {
      id: 'export-markdown',
      title: 'Export proposal markdown',
      body:
        'Download assembled markdown for drafted volumes — ready to paste into your template or Word workflow. Export uses drafted-only mode when full quality gates are not met.' +
        PROPOSAL_WEBGPU_DEGRADED_NOTE,
      target: SCOUT_TARGETS.proposalExportMarkdown,
      action: 'export_proposal_markdown',
    },
    {
      id: 'done',
      title: 'Proposal drafting tour complete',
      body:
        'Upload your real solicitation and past performance docs to generate full volumes, or switch to Evaluate RFP or Mark/takeoff tours from the Scout launcher.',
      manualContinue: true,
      action: 'complete_journey',
    },
  ],
}

/** Expected step count for harness assertions (BDA-280). */
export const GENERATE_PROPOSAL_JOURNEY_STEP_COUNT = 6
