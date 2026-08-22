import { Building2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SCOUT_TARGETS, scoutTargetProps } from '@/lib/scout/targets'
import { cn } from '@/lib/utils'
import { useCompanyProfileStore } from '@/store/company-profile-store'

type CompanyProfileSetupPromptProps = {
  className?: string
  disabled?: boolean
  variant?: 'card' | 'compact'
}

/** Empty-state CTA — opens company onboarding questionnaire (BDA-308). */
export function CompanyProfileSetupPrompt({
  className,
  disabled = false,
  variant = 'card',
}: CompanyProfileSetupPromptProps) {
  const openCompanyOnboardingDialog = useCompanyProfileStore((state) => state.openCompanyOnboardingDialog)

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-2', className)} {...scoutTargetProps(SCOUT_TARGETS.companyProfileSetup)}>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Responder context is empty. Complete your company profile to pre-fill capabilities for proposal
          drafts.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          disabled={disabled}
          onClick={() => openCompanyOnboardingDialog()}
        >
          Complete company profile
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'border-border/70 bg-muted/20 flex flex-col items-start gap-3 rounded-lg border px-4 py-4',
        className,
      )}
      {...scoutTargetProps(SCOUT_TARGETS.companyProfileSetup)}
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Building2Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-foreground text-sm font-medium">Tell us about your company</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            A short questionnaire pre-fills responder context for proposal drafts and RFP qualification.
            You can edit the text afterward — nothing leaves this browser.
          </p>
        </div>
      </div>
      <Button type="button" size="sm" disabled={disabled} onClick={() => openCompanyOnboardingDialog()}>
        Complete company profile
      </Button>
    </div>
  )
}
