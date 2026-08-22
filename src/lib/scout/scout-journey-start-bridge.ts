import { applyJourneyStart, confirmStartJourney } from '@/lib/scout/session-guard'
import type { ScoutJourneyId } from '@/lib/scout/types'
import { useScoutStore } from '@/store/scout-store'

type ScoutJourneyStartConfirmHandler = (journeyId: ScoutJourneyId) => void

let confirmHandler: ScoutJourneyStartConfirmHandler | null = null

/** ScoutProvider registers the confirm dialog handler for out-of-tree entry points (BDA-297). */
export function registerScoutJourneyStartConfirmHandler(
  handler: ScoutJourneyStartConfirmHandler | null,
): void {
  confirmHandler = handler
}

/** Header launcher / journey switcher — same guard as landing picker. */
export function requestScoutJourneyStart(journeyId: ScoutJourneyId): void {
  confirmStartJourney(journeyId, {
    onConfirmRequired: (id) => {
      if (confirmHandler) {
        confirmHandler(id)
        return
      }
      applyJourneyStart(id)
    },
  })
}

export function scoutCanResumeTour(
  activeJourney: ScoutJourneyId | null,
  panelOpen: boolean,
): boolean {
  return activeJourney != null && !panelOpen
}

export function scoutLauncherTooltipLabel(options: {
  activeJourney: ScoutJourneyId | null
  panelOpen: boolean
}): string {
  if (scoutCanResumeTour(options.activeJourney, options.panelOpen)) {
    return 'Resume tour'
  }
  if (options.activeJourney && options.panelOpen) {
    return 'Close Scout guide'
  }
  return 'Scoper Scout'
}

/** Dev harness — header launcher helpers (BDA-297). */
export function runScoutHeaderLauncherHarness(): void {
  if (!scoutCanResumeTour('evaluate_rfp', false)) {
    throw new Error('runScoutHeaderLauncherHarness: should resume when journey active and panel closed')
  }
  if (scoutCanResumeTour('evaluate_rfp', true)) {
    throw new Error('runScoutHeaderLauncherHarness: should not resume when panel open')
  }
  if (scoutCanResumeTour(null, false)) {
    throw new Error('runScoutHeaderLauncherHarness: should not resume without active journey')
  }

  if (scoutLauncherTooltipLabel({ activeJourney: 'evaluate_rfp', panelOpen: false }) !== 'Resume tour') {
    throw new Error('runScoutHeaderLauncherHarness: resume tooltip mismatch')
  }
  if (scoutLauncherTooltipLabel({ activeJourney: null, panelOpen: false }) !== 'Scoper Scout') {
    throw new Error('runScoutHeaderLauncherHarness: default tooltip mismatch')
  }

  const store = useScoutStore.getState()
  store.resetScoutProgress()
  store.startJourney('evaluate_rfp')
  store.advanceStep()
  store.setPanelOpen(false)

  const midTour = useScoutStore.getState()
  if (midTour.stepIndex !== 1 || midTour.activeJourney !== 'evaluate_rfp') {
    throw new Error('runScoutHeaderLauncherHarness: mid-tour state setup failed')
  }

  store.dismissScout()
  if (!useScoutStore.getState().dismissed) {
    throw new Error('runScoutHeaderLauncherHarness: dismissScout should set dismissed')
  }

  store.setPanelOpen(true)
  if (!useScoutStore.getState().panelOpen) {
    throw new Error('runScoutHeaderLauncherHarness: manual launcher should reopen after dismiss')
  }
  if (useScoutStore.getState().stepIndex !== 1) {
    throw new Error('runScoutHeaderLauncherHarness: reload resume should preserve step index')
  }

  store.resetScoutProgress()
}
