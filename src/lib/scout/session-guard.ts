import { getScoutJourney } from '@/lib/scout/journeys-map'
import type { ScoutJourneyId } from '@/lib/scout/types'
import { useScoutStore } from '@/store/scout-store'
import { useSessionStore } from '@/store/session-store'

export type SessionGuardSnapshot = {
  documentCount: number
  chatMessageCount: number
}

export type JourneyStartConfirmCopy = {
  title: string
  description: string
  confirmLabel: string
}

/** Read session fields that trigger a workspace reset confirm (BDA-289). */
export function readSessionGuardSnapshot(): SessionGuardSnapshot {
  const session = useSessionStore.getState()
  return {
    documentCount: session.documents.length,
    chatMessageCount: session.chatMessages.length,
  }
}

export function sessionHasWorkspaceContent(snapshot: SessionGuardSnapshot): boolean {
  return snapshot.documentCount > 0 || snapshot.chatMessageCount > 0
}

/** Whether starting a Scout journey should prompt before clearing the workspace. */
export function shouldConfirmJourneyStart(snapshot: SessionGuardSnapshot): boolean {
  return sessionHasWorkspaceContent(snapshot)
}

export function journeyStartConfirmCopy(
  journeyId: ScoutJourneyId,
  snapshot: SessionGuardSnapshot,
): JourneyStartConfirmCopy {
  const journey = getScoutJourney(journeyId)
  const parts: string[] = []

  if (snapshot.documentCount > 0) {
    parts.push(`${snapshot.documentCount} document${snapshot.documentCount === 1 ? '' : 's'}`)
  }
  if (snapshot.chatMessageCount > 0) {
    parts.push(
      `${snapshot.chatMessageCount} chat message${snapshot.chatMessageCount === 1 ? '' : 's'}`,
    )
  }

  const inventory = parts.length > 0 ? parts.join(' and ') : 'your current workspace'

  return {
    title: 'Start a new Scout tour?',
    description: `Starting "${journey.title}" will clear ${inventory} from this browser session. Your files stay on your machine — this only resets the in-app workspace.`,
    confirmLabel: `Start ${journey.title}`,
  }
}

/** Reset workspace and begin the journey at step 0 (BDA-289). */
export function applyJourneyStart(journeyId: ScoutJourneyId): void {
  useSessionStore.getState().resetSession()
  useScoutStore.getState().startJourney(journeyId)
}

export type ConfirmStartJourneyOptions = {
  onConfirmRequired: (journeyId: ScoutJourneyId) => void
}

/**
 * Entry point for journey picker / header switch — starts immediately or asks UI to confirm.
 */
export function confirmStartJourney(
  journeyId: ScoutJourneyId,
  options: ConfirmStartJourneyOptions,
): void {
  const snapshot = readSessionGuardSnapshot()
  if (shouldConfirmJourneyStart(snapshot)) {
    options.onConfirmRequired(journeyId)
    return
  }
  applyJourneyStart(journeyId)
}

/** Dev harness — session guard predicates (BDA-289). */
export function runScoutSessionGuardHarness(): void {
  useSessionStore.getState().resetSession()
  useScoutStore.getState().resetScoutProgress()

  const empty = readSessionGuardSnapshot()
  if (shouldConfirmJourneyStart(empty)) {
    throw new Error('runScoutSessionGuardHarness: empty session should not require confirm')
  }

  useSessionStore.setState({
    documents: [
      {
        doc_id: 'harness-doc',
        filename: 'sample.pdf',
        mime: 'application/pdf',
        role: 'unknown',
        uploaded_at: new Date(0).toISOString(),
      },
    ],
  })

  const withDoc = readSessionGuardSnapshot()
  if (!shouldConfirmJourneyStart(withDoc)) {
    throw new Error('runScoutSessionGuardHarness: documents should require confirm')
  }

  const copy = journeyStartConfirmCopy('evaluate_rfp', withDoc)
  if (!copy.description.includes('Evaluate an RFP')) {
    throw new Error('runScoutSessionGuardHarness: confirm copy missing journey title')
  }

  applyJourneyStart('evaluate_rfp')
  const after = useSessionStore.getState()
  if (after.documents.length > 0) {
    throw new Error('runScoutSessionGuardHarness: applyJourneyStart should reset session')
  }
  if (useScoutStore.getState().activeJourney !== 'evaluate_rfp') {
    throw new Error('runScoutSessionGuardHarness: applyJourneyStart should start journey')
  }

  useSessionStore.getState().resetSession()
  useScoutStore.getState().resetScoutProgress()
}
