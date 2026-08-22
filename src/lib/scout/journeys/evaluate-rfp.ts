import { SCOUT_JOURNEY_ACCENTS, type ScoutJourney } from '@/lib/scout/types'
import { SCOUT_TARGETS } from '@/lib/scout/targets'

/** Evaluate an RFP — qualify bidder responses with cited evidence (BDA-279). */
export const evaluateRfpJourney: ScoutJourney = {
  id: 'evaluate_rfp',
  title: 'Evaluate an RFP',
  description:
    'Load a sample bid package, qualify a sub against shall/must requirements, and export a compliance matrix CSV — all on your machine.',
  accent: SCOUT_JOURNEY_ACCENTS.evaluate_rfp,
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Scoper Scout',
      body:
        'Scoper parses RFPs and bidder PDFs entirely in your browser — nothing is uploaded to a server. ' +
        'The first qualification run may download the on-device AI model (~290 MB); allow a minute on a slow connection.',
      manualContinue: true,
      action: 'continue',
    },
    {
      id: 'load-sample',
      title: 'Load the sample bid package',
      body:
        'We will ingest a sample IT services RFP and a demo bidder response so you can see qualification cards without uploading your own files.',
      action: 'load_sample_evaluation',
    },
    {
      id: 'open-evaluation',
      title: 'Open the evaluation workspace',
      body:
        'The evaluation view shows bidder qualification cards on the left and setup (baseline RFP, org context) on the right.',
      target: SCOUT_TARGETS.evalPanel,
      action: 'navigate_profiles',
    },
    {
      id: 'run-qualification',
      title: 'Run qualification',
      body:
        'Scoper compares the bidder response against mandatory requirements and produces pass, warn, and fail criteria with citations back to the PDF.',
      target: SCOUT_TARGETS.evalRunQualify,
      action: 'run_qualification',
    },
    {
      id: 'read-criterion',
      title: 'Inspect a criterion citation',
      body:
        'Click any criterion on a bidder card to jump to the exact clause in the document viewer — verify the evidence before you trust the verdict.',
      target: SCOUT_TARGETS.firstProfileCriterion,
    },
    {
      id: 'compliance-matrix',
      title: 'Review the compliance matrix',
      body:
        'The shall/must matrix lists every extracted requirement with editable per-bidder scores. Use it like a lightweight compliance grid for commercial bid reviews.',
      target: SCOUT_TARGETS.complianceMatrix,
    },
    {
      id: 'instructions',
      title: 'Check solicitation instructions',
      body:
        'Due dates, page limits, and volume headings are pulled from the baseline RFP when found — missing fields stay “Not found” rather than guessed.',
      target: SCOUT_TARGETS.instructionsCard,
    },
    {
      id: 'export-csv',
      title: 'Export the matrix CSV',
      body:
        'Download a spreadsheet-ready CSV for your bid log or GC submission — includes an instructions preamble when solicitation meta was found.',
      target: SCOUT_TARGETS.matrixCsvExport,
      action: 'export_matrix_csv',
    },
    {
      id: 'done',
      title: 'You are ready to evaluate real bids',
      body:
        'Upload your own RFP and sub proposals anytime, or export an encrypted share pack to resume this session later. Scout can guide you through proposal drafting or plan takeoff next.',
      target: SCOUT_TARGETS.shareWorkspaceExport,
      manualContinue: true,
      action: 'complete_journey',
    },
  ],
}

/** Expected step count for harness assertions (BDA-279). */
export const EVALUATE_RFP_JOURNEY_STEP_COUNT = 9
