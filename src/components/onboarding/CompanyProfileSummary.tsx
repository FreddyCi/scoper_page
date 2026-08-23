import { Building2Icon } from 'lucide-react'

import { CompanyProfileEditLink } from '@/components/onboarding/CompanyProfileEditLink'
import { Badge } from '@/components/ui/badge'
import { companyProfileToContextSnippet } from '@/lib/company-profile/to-company-context'
import { overlaySectionTitleClass } from '@/lib/overlay-chrome'
import { SCOUT_TARGETS, scoutTargetProps } from '@/lib/scout/targets'
import { cn } from '@/lib/utils'
import {
  selectCompanyProfile,
  selectHasCompletedOnboarding,
  useCompanyProfileStore,
} from '@/store/company-profile-store'

type CompanyProfileSummaryProps = {
  className?: string
  /** `compact` — inline above context fields; `panel` — drawer body */
  variant?: 'compact' | 'panel'
  showEdit?: boolean
}

function ProfileDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">{label}</dt>
      <dd className="text-foreground mt-0.5 text-sm leading-snug">{value}</dd>
    </div>
  )
}

/** Structured company profile — shown after onboarding completes (BDA-308). */
export function CompanyProfileSummary({
  className,
  variant = 'compact',
  showEdit = true,
}: CompanyProfileSummaryProps) {
  const profile = useCompanyProfileStore(selectCompanyProfile)
  const hasCompletedOnboarding = useCompanyProfileStore(selectHasCompletedOnboarding)

  if (!hasCompletedOnboarding) return null

  const snippet = companyProfileToContextSnippet(profile)
  const identityLine = [snippet.role, snippet.tradeDiscipline].filter(Boolean).join(' · ')
  const footprintLine = [snippet.serviceGeography, snippet.headcountBand].filter(Boolean).join(' · ')
  const coverageParts: string[] = []

  if (snippet.insuranceLimit) {
    coverageParts.push(`GL ${snippet.insuranceLimit}`)
  }
  if (snippet.bondingCapacity) {
    coverageParts.push(`Bonding ${snippet.bondingCapacity}`)
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'border-border/70 bg-primary/5 space-y-2 rounded-lg border px-3 py-2.5',
          className,
        )}
        {...scoutTargetProps(SCOUT_TARGETS.companyProfilePanel)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-foreground text-sm font-medium leading-snug">{snippet.legalName}</p>
            {identityLine ? (
              <p className="text-muted-foreground text-xs leading-relaxed">{identityLine}</p>
            ) : null}
          </div>
          {showEdit ? <CompanyProfileEditLink className="shrink-0" /> : null}
        </div>
        {snippet.certifications.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {snippet.certifications.map((cert) => (
              <Badge key={cert} variant="secondary" className="text-[10px]">
                {cert}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn('space-y-4', className)}
      {...scoutTargetProps(SCOUT_TARGETS.companyProfilePanel)}
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Building2Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn(overlaySectionTitleClass, 'text-lg')}>{snippet.legalName}</p>
          {identityLine ? (
            <p className="text-muted-foreground text-sm leading-relaxed">{identityLine}</p>
          ) : null}
          {footprintLine ? (
            <p className="text-muted-foreground text-xs leading-relaxed">{footprintLine}</p>
          ) : null}
        </div>
      </div>

      {snippet.certifications.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            Certifications & programs
          </p>
          <div className="flex flex-wrap gap-1.5">
            {snippet.certifications.map((cert) => (
              <Badge key={cert} variant="outline" className="text-xs">
                {cert}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {coverageParts.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          {snippet.insuranceLimit ? (
            <ProfileDetailRow label="General liability" value={snippet.insuranceLimit} />
          ) : null}
          {snippet.bondingCapacity ? (
            <ProfileDetailRow label="Bonding capacity" value={snippet.bondingCapacity} />
          ) : null}
        </dl>
      ) : null}

      {snippet.differentiators ? (
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            Differentiators
          </p>
          <p className="text-foreground text-sm leading-relaxed">{snippet.differentiators}</p>
        </div>
      ) : null}

      {snippet.freeformNotes ? (
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Notes</p>
          <p className="text-muted-foreground text-sm leading-relaxed">{snippet.freeformNotes}</p>
        </div>
      ) : null}

      {showEdit ? (
        <div className="border-border/70 border-t pt-3">
          <CompanyProfileEditLink label="Edit company profile" className="text-xs" />
        </div>
      ) : null}
    </div>
  )
}
