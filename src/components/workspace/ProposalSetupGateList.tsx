import { CheckIcon, CircleIcon } from 'lucide-react'

import type { ProposalSetupState } from '@/lib/proposal-readiness'
import { cn } from '@/lib/utils'

function GateRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <CircleIcon className="text-muted-foreground/50 mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span className={cn(!ok && 'text-muted-foreground')}>{label}</span>
    </li>
  )
}

type ProposalSetupGateListProps = {
  setup: ProposalSetupState
  className?: string
  /** Shorter copy for the volumes card footer. */
  variant?: 'default' | 'compact'
}

/** Three gating conditions before proposal volume generation (BDA-112 / BDA-132). */
export function ProposalSetupGateList({
  setup,
  className,
  variant = 'default',
}: ProposalSetupGateListProps) {
  const labels =
    variant === 'compact'
      ? {
          rfp: 'RFP selected',
          context: 'Responder context',
          profile: 'Profile built',
        }
      : {
          rfp: 'RFP document selected',
          context: 'Responder context provided',
          profile: 'Proposal profile built from RFP',
        }

  return (
    <ul
      className={cn(
        'border-border/70 space-y-2 rounded-lg border bg-muted/20 px-3 py-3',
        className,
      )}
      aria-label="Requirements to generate proposal volumes"
    >
      <GateRow ok={setup.hasRfp} label={labels.rfp} />
      <GateRow ok={setup.hasContext} label={labels.context} />
      <GateRow ok={setup.hasProfile} label={labels.profile} />
    </ul>
  )
}
