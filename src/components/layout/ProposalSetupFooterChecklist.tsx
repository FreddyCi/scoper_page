import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { buildProposalSetupSteps } from '@/components/workspace/ProposalSetupGateList'
import { canExportProposalProfile } from '@/lib/proposal-export-quality'
import { cn } from '@/lib/utils'
import {
  useProposalRequirementsProfile,
  useProposalSetupState,
  useSessionStore,
} from '@/store/session-store'

/** Paginated stepper for proposal setup gates in the workspace footer. */
export function ProposalSetupFooterChecklist() {
  const mode = useSessionStore((s) => s.mode)
  const workspaceView = useSessionStore((s) => s.workspaceView)
  const companyContext = useSessionStore((s) => s.companyContext)

  const setup = useProposalSetupState()
  const profile = useProposalRequirementsProfile()

  const exportGate = useMemo(
    () => (profile ? canExportProposalProfile(profile) : null),
    [profile],
  )

  const steps = useMemo(
    () => buildProposalSetupSteps(setup, companyContext, exportGate, 'compact'),
    [setup, companyContext, exportGate],
  )

  const stepSignature = useMemo(() => steps.map((step) => `${step.id}:${step.ok}`).join('|'), [steps])

  const [page, setPage] = useState(0)

  useEffect(() => {
    const firstOpen = steps.findIndex((step) => !step.ok)
    setPage(firstOpen === -1 ? Math.max(0, steps.length - 1) : firstOpen)
  }, [stepSignature, steps.length])

  if (mode !== 'proposal' || workspaceView !== 'profiles' || steps.length === 0) {
    return null
  }

  const safePage = Math.min(page, steps.length - 1)
  const current = steps[safePage]!
  const canPrev = safePage > 0
  const canNext = safePage < steps.length - 1

  return (
    <nav
      className="border-border/70 bg-muted/40 flex h-8 w-[min(100%,28rem)] min-w-[17.5rem] shrink items-center gap-0.5 rounded-lg border px-1 shadow-sm backdrop-blur-sm"
      aria-label="Proposal setup progress"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        disabled={!canPrev}
        aria-label="Previous setup step"
        onClick={() => setPage((p) => Math.max(0, p - 1))}
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-0.5">
        <ol className="flex shrink-0 items-center" aria-hidden>
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-center">
              <button
                type="button"
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[10px] font-medium tabular-nums transition-colors',
                  step.ok && 'bg-primary text-primary-foreground',
                  index === safePage &&
                    !step.ok &&
                    'bg-background text-foreground ring-primary ring-2',
                  index !== safePage && !step.ok && 'bg-muted text-muted-foreground hover:bg-muted/80',
                  index === safePage && step.ok && 'ring-primary/40 ring-2',
                )}
                aria-label={`Step ${index + 1}: ${step.label}${step.ok ? ' (complete)' : ''}`}
                onClick={() => setPage(index)}
              >
                {step.ok ? <CheckIcon className="size-3" aria-hidden /> : index + 1}
              </button>
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    'mx-0.5 h-px w-2 shrink-0',
                    step.ok && steps[index + 1]?.ok ? 'bg-primary/50' : 'bg-border',
                  )}
                />
              ) : null}
            </li>
          ))}
        </ol>

        <p
          className="text-foreground min-w-0 flex-1 truncate text-xs"
          aria-current="step"
          title={current.label}
        >
          <span className="text-muted-foreground tabular-nums">
            {safePage + 1}/{steps.length}
          </span>
          <span className="text-muted-foreground mx-1" aria-hidden>
            ·
          </span>
          <span className={cn(!current.ok && 'text-muted-foreground')}>{current.label}</span>
        </p>

        {current.ok ? (
          <CheckIcon className="text-primary size-3.5 shrink-0" aria-hidden />
        ) : (
          <CircleIcon className="text-muted-foreground/50 size-3.5 shrink-0" aria-hidden />
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        disabled={!canNext}
        aria-label="Next setup step"
        onClick={() => setPage((p) => Math.min(steps.length - 1, p + 1))}
      >
        <ChevronRightIcon className="size-4" aria-hidden />
      </Button>
    </nav>
  )
}
