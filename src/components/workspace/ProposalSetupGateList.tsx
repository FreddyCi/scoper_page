import { AlertTriangleIcon, CheckIcon, CircleIcon } from 'lucide-react'

import type { CanExportProposalProfileResult } from '@/lib/proposal-export-quality'
import { CompanyProfileSetupPrompt } from '@/components/onboarding/CompanyProfileSetupPrompt'
import { shouldShowCompanyProfileSetupCta } from '@/lib/company-profile/onboarding-entry'
import { getProposalContextGateState } from '@/lib/proposal-setup-quality-gates'
import type { ProposalSetupState } from '@/lib/proposal-readiness'
import { cn } from '@/lib/utils'
import {
  selectHasCompletedOnboarding,
  useCompanyProfileStore,
} from '@/store/company-profile-store'

function gateLabels(variant: 'default' | 'compact') {
  return variant === 'compact'
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
}

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

export type ProposalSetupStep = {
  id: 'rfp' | 'context' | 'profile' | 'export'
  label: string
  ok: boolean
}

export function buildProposalSetupSteps(
  setup: ProposalSetupState,
  companyContext: string,
  exportGate: CanExportProposalProfileResult | null,
  variant: 'default' | 'compact' = 'compact',
): ProposalSetupStep[] {
  const contextGate = getProposalContextGateState(companyContext, setup)
  const labels = gateLabels(variant)
  const steps: ProposalSetupStep[] = [
    { id: 'rfp', label: labels.rfp, ok: setup.hasRfp },
    { id: 'context', label: labels.context, ok: contextGate.ok },
    { id: 'profile', label: labels.profile, ok: setup.hasProfile },
  ]
  if (exportGate != null) {
    steps.push({ id: 'export', label: labels.export, ok: exportGate.ok })
  }
  return steps
}

type ProposalSetupGateChecklistProps = {
  setup: ProposalSetupState
  companyContext?: string
  exportGate?: CanExportProposalProfileResult | null
  variant?: 'default' | 'compact'
  className?: string
}

/** Checklist rows only — vertical in setup notes. Footer uses {@link buildProposalSetupSteps} stepper. */
export function ProposalSetupGateChecklist({
  setup,
  companyContext = '',
  exportGate = null,
  variant = 'default',
  className,
}: ProposalSetupGateChecklistProps) {
  const steps = buildProposalSetupSteps(setup, companyContext, exportGate, variant)

  return (
    <ul
      className={cn(
        'border-border/70 space-y-2 rounded-lg border bg-muted/20 px-3 py-3',
        className,
      )}
      aria-label="Requirements to generate and export proposal volumes"
    >
      {steps.map((step) => (
        <GateRow key={step.id} ok={step.ok} label={step.label} />
      ))}
    </ul>
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
  /** Checklist lives in workspace footer during proposal setup (BDA-112). */
  checklist?: 'vertical' | 'hidden'
}

/** Gating conditions before proposal volume generation and export (BDA-112 / BDA-166 / BDA-176). */
export function ProposalSetupGateList({
  setup,
  companyContext = '',
  packageWarnings = [],
  className,
  variant = 'default',
  exportGate = null,
  checklist = 'vertical',
}: ProposalSetupGateListProps) {
  const contextGate = getProposalContextGateState(companyContext, setup)
  const hasCompletedOnboarding = useCompanyProfileStore(selectHasCompletedOnboarding)
  const showProfileSetupCta = shouldShowCompanyProfileSetupCta(hasCompletedOnboarding, companyContext)

  const showExportGate = exportGate != null
  const showPackageWarnings = packageWarnings.length > 0

  return (
    <div className={cn('space-y-2', className)}>
      {checklist === 'vertical' ? (
        <ProposalSetupGateChecklist
          setup={setup}
          companyContext={companyContext}
          exportGate={exportGate}
          variant={variant}
        />
      ) : null}

      {showProfileSetupCta && checklist === 'vertical' ? (
        <CompanyProfileSetupPrompt variant="compact" />
      ) : null}

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
