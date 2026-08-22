import { useCallback, useEffect, useState } from 'react'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  Grid2X2Icon,
  Loader2Icon,
  XIcon,
  type LucideIcon,
} from 'lucide-react'

import { useScout } from '@/components/scout/scout-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrandMenuSection, BrandMenuSectionHeader } from '@/components/ui/brand-menu'
import { runScoutAction } from '@/lib/scout/actions'
import { brandAccentStyles } from '@/lib/brand-accent'
import { getScoutJourney, listDefinedScoutJourneys } from '@/lib/scout/journeys-map'
import type { ScoutJourneyId, ScoutStep } from '@/lib/scout/types'
import {
  scoutActionLabel,
  scoutStepStatus,
} from '@/lib/scout/scout-action-labels'
import { cn } from '@/lib/utils'
import {
  selectActiveScoutJourney,
  selectScoutPanelOpen,
  selectScoutStepIndex,
  useScoutStore,
} from '@/store/scout-store'

type ScoutPanelContentProps = {
  collapsed: boolean
  onToggleCollapsed: () => void
  onClose: () => void
}

function ScoutStepListItem({
  step,
  index,
  activeIndex,
  accent,
}: {
  step: ScoutStep
  index: number
  activeIndex: number
  accent: ReturnType<typeof brandAccentStyles>
}) {
  const status = scoutStepStatus(index, activeIndex)

  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold leading-none tabular-nums',
          status === 'done' && 'bg-primary text-primary-foreground',
          status === 'current' && cn('ring-2', accent.itemSelected, accent.title),
          status === 'upcoming' && 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {status === 'done' ? <CheckIcon className="size-3" /> : index + 1}
      </span>
      <span
        className={cn(
          'min-w-0 text-xs leading-5',
          status === 'current' ? cn('font-medium', accent.title) : 'text-muted-foreground',
          status === 'done' && 'text-foreground/80',
        )}
      >
        {step.title}
      </span>
    </li>
  )
}

const WELCOME_JOURNEY_ICONS: Record<ScoutJourneyId, LucideIcon> = {
  evaluate_rfp: ClipboardCheckIcon,
  generate_proposal: FileTextIcon,
  mark_takeoff: Grid2X2Icon,
}

function ScoutWelcomePanelBody({
  collapsed,
  onToggleCollapsed,
  onClose,
}: ScoutPanelContentProps) {
  const { startJourneySafe } = useScout()
  const completedJourneys = useScoutStore((state) => state.completedJourneys)
  const dismissScout = useScoutStore((state) => state.dismissScout)
  const journeys = listDefinedScoutJourneys()

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Expand Scout panel"
          onClick={onToggleCollapsed}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-muted-foreground mt-3 rotate-180 text-[10px] font-semibold tracking-wide uppercase [writing-mode:vertical-rl]">
          Scout
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-border flex shrink-0 items-start justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">Welcome to Scoper Scout</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Pick a guided tour with sample construction docs — everything parses locally in your
            browser.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="max-md:hidden"
            aria-label="Collapse Scout panel"
            onClick={onToggleCollapsed}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close Scout panel"
            onClick={onClose}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
        <BrandMenuSection accent="neutral" className="mb-3">
          <BrandMenuSectionHeader
            accent="neutral"
            title="Guided tours"
            description="Sample DPR packages, proposal rubrics, and plan sheets"
          />
        </BrandMenuSection>

        <ul className="space-y-2">
          {journeys.map((journey) => {
            const accent = brandAccentStyles(journey.accent)
            const Icon = WELCOME_JOURNEY_ICONS[journey.id]
            const completed = completedJourneys.includes(journey.id)

            return (
              <li key={journey.id}>
                <button
                  type="button"
                  className={cn(
                    'border-border hover:bg-surface/80 flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                    accent.section,
                  )}
                  onClick={() => startJourneySafe(journey.id)}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                      accent.section,
                    )}
                  >
                    <Icon className={cn('size-4', accent.indicator)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn('text-sm font-medium', accent.title)}>{journey.title}</span>
                      {completed ? (
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          Done
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                      {journey.description}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <footer className="border-border flex shrink-0 flex-col gap-2 border-t p-3">
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onClose}>
          Close
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full text-xs font-normal"
          onClick={() => dismissScout()}
        >
          Don&apos;t show again
        </Button>
      </footer>
    </div>
  )
}

function ScoutPanelBody({ collapsed, onToggleCollapsed, onClose }: ScoutPanelContentProps) {
  const activeJourneyId = useScoutStore(selectActiveScoutJourney)
  const stepIndex = useScoutStore(selectScoutStepIndex)
  const advanceStep = useScoutStore((s) => s.advanceStep)
  const completeJourney = useScoutStore((s) => s.completeJourney)
  const setPanelOpen = useScoutStore((s) => s.setPanelOpen)
  const dismissScout = useScoutStore((s) => s.dismissScout)

  const [runningAction, setRunningAction] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (!activeJourneyId) return null

  const journey = getScoutJourney(activeJourneyId)
  const accentToken = journey.accent
  const accent = brandAccentStyles(accentToken)
  const safeIndex = Math.min(Math.max(0, stepIndex), journey.steps.length - 1)
  const currentStep = journey.steps[safeIndex]
  const isLastStep = safeIndex >= journey.steps.length - 1

  const primaryAction = currentStep?.action
  const secondaryActions = currentStep?.secondaryActions ?? []
  const showPrimary = Boolean(primaryAction ?? currentStep?.manualContinue)

  async function handlePrimaryAction() {
    if (!currentStep) return
    setActionError(null)

    const actionId = currentStep.action ?? 'continue'
    setRunningAction(true)
    try {
      const result = await runScoutAction(actionId)
      if (!result.ok) {
        setActionError(result.error ?? 'Action failed')
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setRunningAction(false)
    }
  }

  async function handleSecondaryAction(actionId: typeof secondaryActions[number]) {
    setActionError(null)
    setRunningAction(true)
    try {
      const result = await runScoutAction(actionId)
      if (!result.ok) {
        setActionError(result.error ?? 'Action failed')
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setRunningAction(false)
    }
  }

  function handleSkipStep() {
    setActionError(null)
    if (isLastStep) {
      completeJourney()
      return
    }
    advanceStep()
  }

  function handleEndTour() {
    setActionError(null)
    setPanelOpen(false)
  }

  const primaryLabel = primaryAction
    ? scoutActionLabel(primaryAction)
    : currentStep?.manualContinue
      ? 'Continue'
      : 'Do this'

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Expand Scout panel"
          onClick={onToggleCollapsed}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span
          className={cn(
            'mt-3 rotate-180 text-[10px] font-semibold tracking-wide uppercase [writing-mode:vertical-rl]',
            accent.title,
          )}
        >
          Scout
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-border flex shrink-0 items-start justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', accent.title)}>{journey.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{journey.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="max-md:hidden"
            aria-label="Collapse Scout panel"
            onClick={onToggleCollapsed}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close Scout panel"
            onClick={onClose}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
        <BrandMenuSection accent={accentToken} className="mb-3">
          <BrandMenuSectionHeader
            accent={accentToken}
            title={`Step ${safeIndex + 1} of ${journey.steps.length}`}
            description={currentStep?.title ?? ''}
          />
          {currentStep ? (
            <p className="text-muted-foreground px-3 pb-3 text-xs leading-relaxed">{currentStep.body}</p>
          ) : null}
        </BrandMenuSection>

        <nav aria-label="Scout tour steps">
          <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
            Checklist
          </p>
          <ol className="space-y-2">
            {journey.steps.map((step, index) => (
              <ScoutStepListItem
                key={step.id}
                step={step}
                index={index}
                activeIndex={safeIndex}
                accent={accent}
              />
            ))}
          </ol>
        </nav>

        {actionError ? (
          <p className="text-destructive mt-3 text-xs leading-relaxed" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>

      <footer className="border-border flex shrink-0 flex-col gap-2 border-t p-3">
        {showPrimary ? (
          <Button
            type="button"
            className="w-full"
            disabled={runningAction}
            onClick={() => void handlePrimaryAction()}
          >
            {runningAction ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Working…
              </>
            ) : (
              primaryLabel
            )}
          </Button>
        ) : null}

        {secondaryActions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {secondaryActions.map((actionId) => (
              <Button
                key={actionId}
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={runningAction}
                onClick={() => void handleSecondaryAction(actionId)}
              >
                {scoutActionLabel(actionId)}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={runningAction}
            onClick={handleSkipStep}
          >
            {isLastStep ? 'Finish' : 'Skip step'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1"
            disabled={runningAction}
            onClick={handleEndTour}
          >
            End tour
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full text-xs font-normal"
          disabled={runningAction}
          onClick={() => dismissScout()}
        >
          Don&apos;t show again
        </Button>
      </footer>
    </div>
  )
}

/** Collapsible Scout coach panel — checklist, step copy, and action buttons (BDA-286). */
export function ScoutPanel() {
  const panelOpen = useScoutStore(selectScoutPanelOpen)
  const activeJourneyId = useScoutStore(selectActiveScoutJourney)
  const setPanelOpen = useScoutStore((s) => s.setPanelOpen)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState(true)

  const handleClose = useCallback(() => {
    setPanelOpen(false)
  }, [setPanelOpen])

  useEffect(() => {
    if (!panelOpen) return undefined

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [panelOpen, handleClose])

  if (!panelOpen) {
    return null
  }

  const panelBody = activeJourneyId ? (
    <ScoutPanelBody
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      onClose={handleClose}
    />
  ) : (
    <ScoutWelcomePanelBody
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      onClose={handleClose}
    />
  )

  return (
    <>
      <aside
        className={cn(
          'border-border bg-surface shadow-elevated pointer-events-auto absolute inset-y-0 right-0 z-20 hidden flex-col overflow-hidden rounded-l-2xl border-y border-l md:flex',
          collapsed ? 'w-12' : 'w-80',
        )}
        aria-label="Scoper Scout guide"
      >
        {panelBody}
      </aside>

      <div
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex flex-col md:hidden"
        aria-label="Scoper Scout guide"
      >
        <button
          type="button"
          className="border-border bg-workspace flex cursor-pointer items-center justify-between gap-2 border-t px-4 py-2.5 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
          aria-expanded={mobileExpanded}
          onClick={() => setMobileExpanded((value) => !value)}
        >
          <span className="text-foreground text-sm font-semibold">Scoper Scout</span>
          {mobileExpanded ? (
            <ChevronDownIcon className="text-muted-foreground size-4" aria-hidden />
          ) : (
            <ChevronUpIcon className="text-muted-foreground size-4" aria-hidden />
          )}
        </button>
        {mobileExpanded ? (
          <div className="border-border bg-surface max-h-[min(70svh,28rem)] overflow-hidden rounded-t-2xl border-t">
            {activeJourneyId ? (
              <ScoutPanelBody
                collapsed={false}
                onToggleCollapsed={() => undefined}
                onClose={handleClose}
              />
            ) : (
              <ScoutWelcomePanelBody
                collapsed={false}
                onToggleCollapsed={() => undefined}
                onClose={handleClose}
              />
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}

/** Dev harness — step status + action label helpers (BDA-286). */
export function runScoutPanelHarness(): void {
  if (scoutStepStatus(0, 1) !== 'done') {
    throw new Error('runScoutPanelHarness: step 0 should be done when active is 1')
  }
  if (scoutStepStatus(1, 1) !== 'current') {
    throw new Error('runScoutPanelHarness: step 1 should be current')
  }
  if (scoutStepStatus(2, 1) !== 'upcoming') {
    throw new Error('runScoutPanelHarness: step 2 should be upcoming')
  }
  if (!scoutActionLabel('load_sample_evaluation').includes('sample')) {
    throw new Error('runScoutPanelHarness: action label missing')
  }
}
