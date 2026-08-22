import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { ScoutPanel } from '@/components/scout/ScoutPanel'
import { ScoutJourneyStartConfirmDialog } from '@/components/scout/ScoutJourneyStartConfirmDialog'
import { ScoutSpotlight } from '@/components/scout/ScoutSpotlight'
import { ScoutContextProvider, type ScoutContextValue } from '@/components/scout/scout-context'
import type { ScoutCompletionContext } from '@/lib/scout/completion'
import { getScoutJourney } from '@/lib/scout/journeys-map'
import { SCOUT_UI_EVENTS } from '@/lib/scout/scout-ui-events'
import { shouldAutoAdvanceScoutStep } from '@/lib/scout/scout-step-engine'
import {
  applyJourneyStart,
  confirmStartJourney,
} from '@/lib/scout/session-guard'
import { shouldAutoOpenScoutWelcomePanel } from '@/lib/scout/scout-first-visit'
import { registerScoutJourneyStartConfirmHandler } from '@/lib/scout/scout-journey-start-bridge'
import type { ScoutJourneyId } from '@/lib/scout/types'
import { readShareLinkFromLocation } from '@/services/share-pack-link'
import { fetchPdfDrawingAnnotationsForDoc } from '@/services/pdf-drawing-annotations'
import { useSessionStore } from '@/store/session-store'
import {
  selectActiveScoutJourney,
  selectScoutDismissed,
  selectScoutPanelOpen,
  selectScoutStepIndex,
  useScoutStore,
} from '@/store/scout-store'

type ScoutProviderProps = {
  children: ReactNode
}

function useScoutCompletionContext(activeJourney: ScoutJourneyId | null): ScoutCompletionContext {
  const activeDocId = useSessionStore((s) => s.activeDocId)
  const documentCount = useSessionStore((s) => s.documents.length)
  const [context, setContext] = useState<ScoutCompletionContext>({})

  useEffect(() => {
    function onTakeoffOpen() {
      setContext((previous) => ({ ...previous, takeoffPanelOpen: true }))
    }

    function onMarkJump() {
      setContext((previous) => ({ ...previous, markJumpTriggered: true }))
    }

    window.addEventListener(SCOUT_UI_EVENTS.openTakeoffPanel, onTakeoffOpen)
    window.addEventListener(SCOUT_UI_EVENTS.markJumpTriggered, onMarkJump)
    return () => {
      window.removeEventListener(SCOUT_UI_EVENTS.openTakeoffPanel, onTakeoffOpen)
      window.removeEventListener(SCOUT_UI_EVENTS.markJumpTriggered, onMarkJump)
    }
  }, [])

  useEffect(() => {
    if (activeJourney !== 'mark_takeoff' || !activeDocId) {
      setContext((previous) => ({ ...previous, stampCount: undefined }))
      return undefined
    }

    let cancelled = false

    async function refreshStampCount() {
      try {
        const rows = await fetchPdfDrawingAnnotationsForDoc(activeDocId!)
        if (cancelled) return
        const stampCount = rows.filter((row) => row.geometry.kind === 'stamp').length
        setContext((previous) => ({ ...previous, stampCount }))
      } catch {
        if (!cancelled) {
          setContext((previous) => ({ ...previous, stampCount: 0 }))
        }
      }
    }

    void refreshStampCount()
    return () => {
      cancelled = true
    }
  }, [activeDocId, activeJourney, documentCount])

  return context
}

/** Session + scout subscription, auto-advance engine, panel + spotlight chrome (BDA-287). */
export function ScoutProvider({ children }: ScoutProviderProps) {
  const sessionSlice = useSessionStore(
    useShallow((state) => ({
      documents: state.documents,
      mode: state.mode,
      workspaceView: state.workspaceView,
      profiles: state.profiles,
      evaluationDocId: state.evaluationDocId,
      selectedCitation: state.selectedCitation,
      rfpRequirements: state.rfpRequirements,
      rfpInstructionsProfile: state.rfpInstructionsProfile,
      proposalRequirementsProfile: state.proposalRequirementsProfile,
      companyContext: state.companyContext,
      pdfMarkDrawingMode: state.pdfMarkDrawingMode,
      contractReviewProfile: state.contractReviewProfile,
    })),
  )

  const activeJourney = useScoutStore(selectActiveScoutJourney)
  const stepIndex = useScoutStore(selectScoutStepIndex)
  const panelOpen = useScoutStore(selectScoutPanelOpen)
  const dismissed = useScoutStore(selectScoutDismissed)
  const awaitingManualContinue = useScoutStore((s) => s.awaitingManualContinue)
  const exportTriggered = useScoutStore((s) => s.exportTriggered)
  const completedJourneys = useScoutStore((s) => s.completedJourneys)

  const advanceStep = useScoutStore((s) => s.advanceStep)
  const setPanelOpen = useScoutStore((s) => s.setPanelOpen)
  const setAwaitingManualContinue = useScoutStore((s) => s.setAwaitingManualContinue)
  const dismissScout = useScoutStore((s) => s.dismissScout)

  const [pendingJourneyId, setPendingJourneyId] = useState<ScoutJourneyId | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const completionContext = useScoutCompletionContext(activeJourney)
  const autoAdvanceLockRef = useRef<string | null>(null)
  const firstVisitAutoOpenRef = useRef(false)

  const scoutSnapshot = useMemo(
    () => ({
      activeJourney,
      stepIndex,
      completedJourneys,
      panelOpen,
      dismissed,
      awaitingManualContinue,
      exportTriggered,
    }),
    [
      activeJourney,
      stepIndex,
      completedJourneys,
      panelOpen,
      dismissed,
      awaitingManualContinue,
      exportTriggered,
    ],
  )

  useEffect(() => {
    registerScoutJourneyStartConfirmHandler((journeyId) => {
      setPendingJourneyId(journeyId)
      setConfirmOpen(true)
    })
    return () => registerScoutJourneyStartConfirmHandler(null)
  }, [])

  useEffect(() => {
    if (firstVisitAutoOpenRef.current) return

    const scout = useScoutStore.getState()
    const session = useSessionStore.getState()

    if (
      !shouldAutoOpenScoutWelcomePanel({
        dismissed: scout.dismissed,
        panelOpen: scout.panelOpen,
        activeJourney: scout.activeJourney,
        documentCount: session.documents.length,
        hasShareLink: readShareLinkFromLocation() != null,
      })
    ) {
      return
    }

    firstVisitAutoOpenRef.current = true
    setPanelOpen(true)
  }, [setPanelOpen])

  useEffect(() => {
    if (!activeJourney) return
    const step = getScoutJourney(activeJourney).steps[stepIndex]
    setAwaitingManualContinue(step?.manualContinue === true)
  }, [activeJourney, stepIndex, setAwaitingManualContinue])

  useEffect(() => {
    autoAdvanceLockRef.current = null
  }, [activeJourney, stepIndex])

  useEffect(() => {
    if (!shouldAutoAdvanceScoutStep(sessionSlice, scoutSnapshot, completionContext)) {
      return
    }

    const lockKey = `${activeJourney}:${stepIndex}`
    if (autoAdvanceLockRef.current === lockKey) {
      return
    }

    autoAdvanceLockRef.current = lockKey
    advanceStep()
  }, [
    activeJourney,
    stepIndex,
    advanceStep,
    sessionSlice,
    scoutSnapshot,
    completionContext,
  ])

  const togglePanel = useCallback(() => {
    setPanelOpen(!useScoutStore.getState().panelOpen)
  }, [setPanelOpen])

  const openPanel = useCallback(() => {
    setPanelOpen(true)
  }, [setPanelOpen])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
  }, [setPanelOpen])

  const startJourneySafe = useCallback((journeyId: ScoutJourneyId) => {
    confirmStartJourney(journeyId, {
      onConfirmRequired: (id) => {
        setPendingJourneyId(id)
        setConfirmOpen(true)
      },
    })
  }, [])

  const handleConfirmJourneyStart = useCallback(() => {
    if (pendingJourneyId) {
      applyJourneyStart(pendingJourneyId)
    }
    setConfirmOpen(false)
    setPendingJourneyId(null)
  }, [pendingJourneyId])

  const handleConfirmOpenChange = useCallback((open: boolean) => {
    setConfirmOpen(open)
    if (!open) {
      setPendingJourneyId(null)
    }
  }, [])

  const contextValue = useMemo<ScoutContextValue>(
    () => ({
      activeJourney,
      stepIndex,
      panelOpen,
      dismissed,
      awaitingManualContinue,
      hasActiveTour: activeJourney != null,
      canResume: activeJourney != null && !panelOpen,
      togglePanel,
      openPanel,
      closePanel,
      startJourney: startJourneySafe,
      startJourneySafe,
      dismissScout,
    }),
    [
      activeJourney,
      stepIndex,
      panelOpen,
      dismissed,
      awaitingManualContinue,
      togglePanel,
      openPanel,
      closePanel,
      startJourneySafe,
      dismissScout,
    ],
  )

  return (
    <ScoutContextProvider value={contextValue}>
      {children}
      <ScoutSpotlight />
      <ScoutPanel />
      <ScoutJourneyStartConfirmDialog
        open={confirmOpen}
        journeyId={pendingJourneyId}
        onOpenChange={handleConfirmOpenChange}
        onConfirm={handleConfirmJourneyStart}
      />
    </ScoutContextProvider>
  )
}
