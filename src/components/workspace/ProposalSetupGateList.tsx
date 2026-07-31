import { CheckIcon, CircleIcon } from 'lucide-react'

import type { CanExportProposalProfileResult } from '@/lib/proposal-export-quality'
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
  /** Full-profile export quality gate (BDA-176). */
  exportGate?: CanExportProposalProfileResult | null
}

/** Gating conditions before proposal volume generation and export (BDA-112 / BDA-176). */
export function ProposalSetupGateList({
  setup,
  className,
  variant = 'default',
  exportGate = null,
}: ProposalSetupGateListProps) {
  const labels =
    variant === 'compact'
      ? {
          rfp: 'RFP selected',
          context: 'Responder context',
          profile: 'Profile built',
          export: 'Export-ready drafts',
        }
      : {
          rfp: 'RFP document selected',
          context: 'Responder context provided',
          profile: 'Proposal profile built from RFP',
          export: 'All volumes pass export quality checks',
        }

  const showExportGate = exportGate != null

  return (
    <div className={cn('space-y-2', className)}>
      <ul
        className="border-border/70 space-y-2 rounded-lg border bg-muted/20 px-3 py-3"
        aria-label="Requirements to generate and export proposal volumes"
      >
        <GateRow ok={setup.hasRfp} label={labels.rfp} />
        <GateRow ok={setup.hasContext} label={labels.context} />
        <GateRow ok={setup.hasProfile} label={labels.profile} />
        {showExportGate ? <GateRow ok={exportGate.ok} label={labels.export} /> : null}
      </ul>
      {showExportGate && !exportGate.ok && exportGate.reasons.length > 0 ? (
        <ul
          className="text-muted-foreground list-disc space-y-1 pl-5 text-xs leading-relaxed"
          role="note"
          aria-label="Export blocked reasons"
        >
          {exportGate.reasons.slice(0, 6).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
          {exportGate.reasons.length > 6 ? (
            <li>{exportGate.reasons.length - 6} more issue(s)…</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
