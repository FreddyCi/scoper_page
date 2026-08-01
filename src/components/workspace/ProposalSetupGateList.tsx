import { AlertTriangleIcon, CheckIcon, CircleIcon } from 'lucide-react'

import type { CanExportProposalProfileResult } from '@/lib/proposal-export-quality'
import { getProposalContextGateState } from '@/lib/proposal-setup-quality-gates'
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
  /** Responder context — drives BDA-157 quality row when provided. */
  companyContext?: string
  /** Non-blocking classification notes from profile (BDA-159). */
  packageWarnings?: string[]
  className?: string
  /** Shorter copy for the volumes card footer. */
  variant?: 'default' | 'compact'
  /** Full-profile export quality gate (BDA-176). */
  exportGate?: CanExportProposalProfileResult | null
}

/** Gating conditions before proposal volume generation and export (BDA-112 / BDA-166 / BDA-176). */
export function ProposalSetupGateList({
  setup,
  companyContext = '',
  packageWarnings = [],
  className,
  variant = 'default',
  exportGate = null,
}: ProposalSetupGateListProps) {
  const contextGate = getProposalContextGateState(companyContext, setup)

  const labels =
    variant === 'compact'
      ? {
          rfp: 'RFP selected',
          context: 'Responder context quality',
          profile: 'Profile built',
          export: 'Export-ready drafts',
        }
      : {
          rfp: 'RFP document selected',
          context: 'Responder context passes quality checks',
          profile: 'Proposal profile built from RFP',
          export: 'All volumes pass export quality checks',
        }

  const showExportGate = exportGate != null
  const showPackageWarnings = packageWarnings.length > 0

  return (
    <div className={cn('space-y-2', className)}>
      <ul
        className="border-border/70 space-y-2 rounded-lg border bg-muted/20 px-3 py-3"
        aria-label="Requirements to generate and export proposal volumes"
      >
        <GateRow ok={setup.hasRfp} label={labels.rfp} />
        <GateRow ok={contextGate.ok} label={labels.context} />
        <GateRow ok={setup.hasProfile} label={labels.profile} />
        {showExportGate ? <GateRow ok={exportGate.ok} label={labels.export} /> : null}
      </ul>

      {setup.hasContext && !contextGate.ok && contextGate.blockingWarnings.length > 0 ? (
        <div className="space-y-1" role="note" aria-label="Responder context issues">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Edit <span className="text-foreground font-medium">Your company / capabilities</span>{' '}
            — weak context blocks proposal generation.
          </p>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs leading-relaxed">
            {contextGate.blockingWarnings.slice(0, 5).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {showPackageWarnings ? (
        <div
          className="border-amber-500/25 bg-amber-500/5 space-y-1.5 rounded-lg border px-3 py-2.5"
          role="note"
          aria-label="Package classification notes"
        >
          <p className="text-foreground flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangleIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
            Document classification
          </p>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs leading-relaxed">
            {packageWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {variant === 'compact'
              ? 'Rebuild profile if the RFP document changed.'
              : 'If this is the wrong document type, select a different RFP and rebuild the proposal profile.'}
          </p>
        </div>
      ) : null}

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
