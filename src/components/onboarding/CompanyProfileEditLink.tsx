import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCompanyProfileStore } from '@/store/company-profile-store'

type CompanyProfileEditLinkProps = {
  className?: string
  label?: string
}

/** Opens company profile questionnaire for edits — does not clear workspace docs (BDA-308). */
export function CompanyProfileEditLink({
  className,
  label = 'Edit company profile',
}: CompanyProfileEditLinkProps) {
  const openCompanyOnboardingDialog = useCompanyProfileStore((state) => state.openCompanyOnboardingDialog)

  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className={cn('text-muted-foreground h-auto px-0 text-xs font-normal', className)}
      onClick={() => openCompanyOnboardingDialog()}
    >
      {label}
    </Button>
  )
}
