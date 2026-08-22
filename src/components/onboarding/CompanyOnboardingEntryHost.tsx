import { useCallback, useEffect, useRef } from 'react'

import { CompanyOnboardingQuestionnaireDialog } from '@/components/onboarding/CompanyOnboardingQuestionnaire'
import { shouldAutoOpenCompanyOnboardingDialog } from '@/lib/company-profile/onboarding-entry'
import { readShareLinkFromLocation } from '@/services/share-pack-link'
import {
  selectHasCompletedOnboarding,
  useCompanyProfileStore,
} from '@/store/company-profile-store'

/** Global onboarding dialog — first-visit auto-open + panel CTAs (BDA-308). */
export function CompanyOnboardingEntryHost() {
  const dialogOpen = useCompanyProfileStore((state) => state.onboardingDialogOpen)
  const hasCompletedOnboarding = useCompanyProfileStore(selectHasCompletedOnboarding)
  const onboardingPromptDismissed = useCompanyProfileStore((state) => state.onboardingPromptDismissed)
  const closeCompanyOnboardingDialog = useCompanyProfileStore((state) => state.closeCompanyOnboardingDialog)
  const dismissOnboardingPrompt = useCompanyProfileStore((state) => state.dismissOnboardingPrompt)
  const openCompanyOnboardingDialog = useCompanyProfileStore((state) => state.openCompanyOnboardingDialog)

  const autoOpenRef = useRef(false)

  useEffect(() => {
    if (autoOpenRef.current) return

    if (
      !shouldAutoOpenCompanyOnboardingDialog({
        hasCompletedOnboarding,
        onboardingPromptDismissed,
        hasShareLink: readShareLinkFromLocation() != null,
      })
    ) {
      return
    }

    autoOpenRef.current = true
    openCompanyOnboardingDialog()
  }, [hasCompletedOnboarding, onboardingPromptDismissed, openCompanyOnboardingDialog])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openCompanyOnboardingDialog()
        return
      }

      closeCompanyOnboardingDialog()
      if (!selectHasCompletedOnboarding(useCompanyProfileStore.getState())) {
        dismissOnboardingPrompt()
      }
    },
    [closeCompanyOnboardingDialog, dismissOnboardingPrompt, openCompanyOnboardingDialog],
  )

  return <CompanyOnboardingQuestionnaireDialog open={dialogOpen} onOpenChange={handleOpenChange} />
}
