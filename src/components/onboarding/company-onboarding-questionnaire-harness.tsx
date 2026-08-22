import { act } from 'react'
import { createRoot } from 'react-dom/client'

import { CompanyOnboardingQuestionnaireCard } from '@/components/onboarding/CompanyOnboardingQuestionnaire'
import {
  buildCompanyOnboardingQuestionnaireItems,
  COMPANY_ONBOARDING_ITEMS,
} from '@/lib/company-profile/questionnaire-items'
import { createEmptyCompanyProfile } from '@/lib/company-profile/schema'
import { useCompanyProfileStore } from '@/store/company-profile-store'

/** Dev harness — company onboarding questionnaire smoke render (BDA-306). */
export function runCompanyOnboardingQuestionnaireHarness(): void {
  useCompanyProfileStore.getState().clearCompanyProfile()

  const supplierItems = buildCompanyOnboardingQuestionnaireItems({
    ...createEmptyCompanyProfile(),
    role: 'supplier',
  })
  const bondingItem = supplierItems.find((item) => item.name === 'bondingCapacity')
  if (!bondingItem?.disabled) {
    throw new Error('runCompanyOnboardingQuestionnaireHarness: supplier should disable bonding step')
  }

  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  document.body.appendChild(container)

  try {
    const root = createRoot(container)
    act(() => {
      root.render(<CompanyOnboardingQuestionnaireCard />)
    })

    const progress = container.querySelector('[data-slot="questionnaire-progress"]')
    const next = container.querySelector('[data-slot="questionnaire-next"]')
    const submit = container.querySelector('[data-slot="questionnaire-submit"]')
    const skip = container.querySelector('[data-slot="questionnaire-skip"]')
    const legalInput = container.querySelector('[data-slot="questionnaire-input"]')

    if (!progress?.textContent?.includes('Question')) {
      throw new Error('runCompanyOnboardingQuestionnaireHarness: expected progress label')
    }
    if (!next || !submit) {
      throw new Error('runCompanyOnboardingQuestionnaireHarness: expected navigation controls')
    }
    if (!skip) {
      throw new Error('runCompanyOnboardingQuestionnaireHarness: expected skip control')
    }
    if (!legalInput) {
      throw new Error('runCompanyOnboardingQuestionnaireHarness: expected legal name input')
    }
    if (COMPANY_ONBOARDING_ITEMS.length < 10) {
      throw new Error('runCompanyOnboardingQuestionnaireHarness: expected full onboarding item set')
    }

    act(() => {
      root.unmount()
    })
  } finally {
    container.remove()
    useCompanyProfileStore.getState().clearCompanyProfile()
  }
}
