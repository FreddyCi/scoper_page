import { runScoutPanelHarness } from '@/components/scout/ScoutPanel'
import { runScoutActionsHarness } from '@/lib/scout/actions-harness'
import { runScoutCompletionHarness } from '@/lib/scout/completion-harness'
import { runScoutEvaluateRfpJourneyHarness } from '@/lib/scout/evaluate-rfp-journey-harness'
import { runScoutGenerateProposalJourneyHarness } from '@/lib/scout/generate-proposal-journey-harness'
import { runScoutJourneysHarness } from '@/lib/scout/journeys-harness'
import { evaluateRfpJourney } from '@/lib/scout/journeys/evaluate-rfp'
import { generateProposalJourney } from '@/lib/scout/journeys/generate-proposal'
import { markTakeoffJourney } from '@/lib/scout/journeys/mark-takeoff'
import { runScoutMarkTakeoffJourneyHarness } from '@/lib/scout/mark-takeoff-journey-harness'
import { runScoutRegistryHarness } from '@/lib/scout/registry-harness'
import { runScoutFirstVisitHarness } from '@/lib/scout/scout-first-visit'
import { runScoutHeaderLauncherHarness } from '@/lib/scout/scout-journey-start-bridge'
import { runScoutStepEngineHarness } from '@/lib/scout/scout-step-engine'
import { runScoutSessionGuardHarness } from '@/lib/scout/session-guard'
import { runScoutSpotlightGeometryHarness } from '@/lib/scout/spotlight-geometry'
import {
  fetchSampleFile,
  SAMPLE_CONTRACT_CHECKLIST_FILENAME,
  SAMPLE_CONTRACT_CHECKLIST_URL,
  SAMPLE_EVALUATION_MSA_FILENAME,
  SAMPLE_EVALUATION_MSA_URL,
  SAMPLE_WINDOWS_DRAWING_FILENAME,
  SAMPLE_WINDOWS_DRAWING_URL,
} from '@/services/load-sample-documents'
import {
  SAMPLE_PROPOSAL_RUBRIC_FILENAME,
  SAMPLE_PROPOSAL_RUBRIC_URL,
} from '@/services/load-sample-proposal'
import { runScoutStoreHarness } from '@/store/scout-store'

const SCOUT_SAMPLE_LOAD_ACTIONS: { journeyId: string; action: string }[] = [
  { journeyId: 'evaluate_rfp', action: 'load_sample_evaluation' },
  { journeyId: 'generate_proposal', action: 'load_sample_proposal' },
  { journeyId: 'mark_takeoff', action: 'load_sample_markup' },
]

const SCOUT_JOURNEY_LOAD_SAMPLE = [
  { journey: evaluateRfpJourney, action: 'load_sample_evaluation' },
  { journey: generateProposalJourney, action: 'load_sample_proposal' },
  { journey: markTakeoffJourney, action: 'load_sample_markup' },
] as const

const SCOUT_BUNDLED_SAMPLES: readonly [string, string][] = [
  [SAMPLE_EVALUATION_MSA_URL, SAMPLE_EVALUATION_MSA_FILENAME],
  [SAMPLE_CONTRACT_CHECKLIST_URL, SAMPLE_CONTRACT_CHECKLIST_FILENAME],
  [SAMPLE_PROPOSAL_RUBRIC_URL, SAMPLE_PROPOSAL_RUBRIC_FILENAME],
  [SAMPLE_WINDOWS_DRAWING_URL, SAMPLE_WINDOWS_DRAWING_FILENAME],
]

/** Sync Scout harnesses — store, registry, journeys, completion, UI helpers (BDA-299). */
export function runScoutUnitHarnesses(): void {
  runScoutStoreHarness()
  runScoutRegistryHarness()
  runScoutJourneysHarness()
  runScoutCompletionHarness()
  runScoutPanelHarness()
  runScoutSpotlightGeometryHarness()
  runScoutSessionGuardHarness()
  runScoutStepEngineHarness()
  runScoutHeaderLauncherHarness()
  runScoutFirstVisitHarness()
}

function assertJourneyLoadSampleActions(): void {
  for (const { journey, action } of SCOUT_JOURNEY_LOAD_SAMPLE) {
    const step = journey.steps.find((entry) => entry.id === 'load-sample')
    if (step?.action !== action) {
      throw new Error(
        `runScoutSampleLoaderSmokeHarness: ${journey.id} load-sample action should be ${action}`,
      )
    }
  }

  for (const { journeyId, action } of SCOUT_SAMPLE_LOAD_ACTIONS) {
    const journey = SCOUT_JOURNEY_LOAD_SAMPLE.find((entry) => entry.journey.id === journeyId)?.journey
    const step = journey?.steps.find((entry) => entry.id === 'load-sample')
    if (step?.action !== action) {
      throw new Error(`runScoutSampleLoaderSmokeHarness: registry mismatch for ${journeyId}`)
    }
  }
}

async function runMockFetchSampleLoaderSmoke(): Promise<void> {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.includes('/sample/mock-scout.pdf')) {
      return new Response(new Blob(['%PDF-1.4 scout harness mock']), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      })
    }
    return originalFetch(input, init)
  }

  try {
    const file = await fetchSampleFile('/sample/mock-scout.pdf', 'mock-scout.pdf')
    if (file.size < 8) {
      throw new Error('runScoutSampleLoaderSmokeHarness: mock fetchSampleFile returned empty file')
    }
    if (!file.name.endsWith('.pdf')) {
      throw new Error('runScoutSampleLoaderSmokeHarness: mock fetchSampleFile filename mismatch')
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function runBundledSampleFetchSmoke(): Promise<void> {
  for (const [url, filename] of SCOUT_BUNDLED_SAMPLES) {
    const file = await fetchSampleFile(url, filename)
    if (file.size < 64) {
      throw new Error(`runScoutSampleLoaderSmokeHarness: bundled sample too small — ${filename}`)
    }
    if (file.name !== filename) {
      throw new Error(`runScoutSampleLoaderSmokeHarness: bundled sample filename mismatch — ${filename}`)
    }
  }
}

/** Sample loader wiring + fetch smoke (mock + bundled public samples) (BDA-283–285 / BDA-299). */
export async function runScoutSampleLoaderSmokeHarness(): Promise<void> {
  assertJourneyLoadSampleActions()
  await runMockFetchSampleLoaderSmoke()
  await runBundledSampleFetchSmoke()
}

/** Async Scout harnesses — actions, journey wiring, sample loaders (BDA-299). */
export async function runScoutAsyncUnitHarnesses(): Promise<void> {
  await runScoutActionsHarness()
  await runScoutEvaluateRfpJourneyHarness()
  await runScoutGenerateProposalJourneyHarness()
  await runScoutMarkTakeoffJourneyHarness()
  await runScoutSampleLoaderSmokeHarness()
}

/** Full Scout dev chain (sync + async). */
export async function runScoutDevHarnesses(): Promise<void> {
  runScoutUnitHarnesses()
  await runScoutAsyncUnitHarnesses()
}
