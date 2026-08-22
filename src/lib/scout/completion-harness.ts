import {
  createScoutCompletionSession,
  isStepComplete,
  scoutStepKey,
} from '@/lib/scout/completion'
import { createDefaultScoutSnapshot } from '@/store/scout-store'
import type { ProposalRequirementsProfile, RfpInstructionsProfile } from '@/lib/types'

function assertComplete(
  journeyId: 'evaluate_rfp' | 'generate_proposal' | 'mark_takeoff',
  stepId: string,
  session: ReturnType<typeof createScoutCompletionSession>,
  scout: ReturnType<typeof createDefaultScoutSnapshot>,
  context: Parameters<typeof isStepComplete>[4] = {},
): void {
  if (!isStepComplete(journeyId, stepId, session, scout, context)) {
    throw new Error(`runScoutCompletionHarness: expected complete ${scoutStepKey(journeyId, stepId)}`)
  }
}

function assertIncomplete(
  journeyId: 'evaluate_rfp' | 'generate_proposal' | 'mark_takeoff',
  stepId: string,
  session: ReturnType<typeof createScoutCompletionSession>,
  scout: ReturnType<typeof createDefaultScoutSnapshot>,
  context: Parameters<typeof isStepComplete>[4] = {},
): void {
  if (isStepComplete(journeyId, stepId, session, scout, context)) {
    throw new Error(`runScoutCompletionHarness: expected incomplete ${scoutStepKey(journeyId, stepId)}`)
  }
}

/** Dev harness — step completion predicates with mocked session snapshots (BDA-281). */
export function runScoutCompletionHarness(): void {
  const baseScout = createDefaultScoutSnapshot()

  assertIncomplete('evaluate_rfp', 'welcome', createScoutCompletionSession(), baseScout)
  assertIncomplete('evaluate_rfp', 'load-sample', createScoutCompletionSession(), baseScout)

  assertComplete(
    'evaluate_rfp',
    'load-sample',
    createScoutCompletionSession({
      documents: [
        {
          doc_id: 'rfp',
          filename: 'rfp.pdf',
          mime: 'application/pdf',
          role: 'baseline',
          uploaded_at: '',
        },
        {
          doc_id: 'bid',
          filename: 'bid.pdf',
          mime: 'application/pdf',
          role: 'unknown',
          uploaded_at: '',
        },
      ],
      evaluationDocId: 'rfp',
    }),
    baseScout,
  )

  assertComplete(
    'evaluate_rfp',
    'open-evaluation',
    createScoutCompletionSession({ mode: 'rfp', workspaceView: 'profiles' }),
    baseScout,
  )

  assertComplete(
    'evaluate_rfp',
    'run-qualification',
    createScoutCompletionSession({
      profiles: [
        {
          profile_id: 'p1',
          source_doc_id: 'bid',
          verdict: 'likely',
          subject: { name: 'Demo Vendor' },
          summary: '',
          criteria: [],
        },
      ],
    }),
    baseScout,
  )

  assertComplete(
    'evaluate_rfp',
    'read-criterion',
    createScoutCompletionSession({
      selectedCitation: { doc_id: 'bid', block_id: 'b1', excerpt: 'shall' },
    }),
    baseScout,
  )

  assertComplete(
    'evaluate_rfp',
    'compliance-matrix',
    createScoutCompletionSession({
      rfpRequirements: [{ id: 'r1', label: 'shall provide' }],
    }),
    baseScout,
  )

  const instructionsProfile: RfpInstructionsProfile = {
    doc_id: 'rfp',
    volumes: [],
    block_ids: [],
    summary: '',
  }
  assertComplete(
    'evaluate_rfp',
    'instructions',
    createScoutCompletionSession({ rfpInstructionsProfile: instructionsProfile }),
    baseScout,
  )

  assertComplete(
    'evaluate_rfp',
    'export-csv',
    createScoutCompletionSession(),
    { ...baseScout, exportTriggered: { matrixCsv: true } },
  )

  assertIncomplete('generate_proposal', 'load-sample', createScoutCompletionSession(), baseScout)
  assertComplete(
    'generate_proposal',
    'load-sample',
    createScoutCompletionSession({
      mode: 'proposal',
      documents: [{ doc_id: 'rfp', filename: 'r.pdf', mime: 'application/pdf', role: 'unknown', uploaded_at: '' }],
      evaluationDocId: 'rfp',
    }),
    baseScout,
  )

  const proposalProfile: ProposalRequirementsProfile = {
    profile_id: 'pr',
    rfp_doc_id: 'rfp',
    summary: '',
    built_at: '',
    packageKind: 'solicitation',
    packageWarnings: [],
    volumes: [
      {
        id: 'v1',
        title: 'Technical',
        requirementSummary: '',
        status: 'draft',
        sections: [{ id: 's1', title: 'Approach', findClauseQuery: 'approach', status: 'draft', bodyMarkdown: 'Body' }],
      },
    ],
  }

  assertComplete(
    'generate_proposal',
    'build-profile',
    createScoutCompletionSession({ proposalRequirementsProfile: proposalProfile }),
    baseScout,
  )

  assertComplete(
    'generate_proposal',
    'generate-volume',
    createScoutCompletionSession({ proposalRequirementsProfile: proposalProfile }),
    baseScout,
  )

  assertComplete(
    'generate_proposal',
    'export-markdown',
    createScoutCompletionSession(),
    { ...baseScout, exportTriggered: { proposalMarkdown: true } },
  )

  assertComplete(
    'mark_takeoff',
    'load-sample',
    createScoutCompletionSession({
      documents: [{ doc_id: 'plan', filename: 'plan.pdf', mime: 'application/pdf', role: 'unknown', uploaded_at: '' }],
      workspaceView: 'split',
    }),
    baseScout,
  )

  assertComplete(
    'mark_takeoff',
    'mark-mode',
    createScoutCompletionSession({ pdfMarkDrawingMode: true }),
    baseScout,
  )

  assertIncomplete('mark_takeoff', 'place-stamps', createScoutCompletionSession(), baseScout, {
    stampCount: 1,
  })
  assertComplete(
    'mark_takeoff',
    'place-stamps',
    createScoutCompletionSession(),
    baseScout,
    { stampCount: 2 },
  )

  assertComplete(
    'mark_takeoff',
    'takeoff-panel',
    createScoutCompletionSession(),
    baseScout,
    { takeoffPanelOpen: true },
  )

  assertComplete(
    'mark_takeoff',
    'jump-to-mark',
    createScoutCompletionSession(),
    baseScout,
    { markJumpTriggered: true },
  )

  assertComplete(
    'mark_takeoff',
    'export-csv',
    createScoutCompletionSession(),
    { ...baseScout, exportTriggered: { takeoffCsv: true } },
  )
}
