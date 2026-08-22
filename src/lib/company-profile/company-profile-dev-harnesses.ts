import { runCompanyOnboardingQuestionnaireHarness } from '@/components/onboarding/company-onboarding-questionnaire-harness'
import { runCompanyProfileHarness } from '@/lib/company-profile/company-profile-harness'
import { runCompanyOnboardingEntryHarness } from '@/lib/company-profile/onboarding-entry'
import { runCompanyContextSerializerHarness } from '@/lib/company-profile/to-company-context'
import { runCompanyProfileStoreHarness } from '@/store/company-profile-store'

/**
 * Sync company profile dev harness chain — schema, store, serializer, entry, UI smoke (BDA-309).
 * Chained from App.tsx after questionnaire primitive harness.
 */
export function runCompanyProfileUnitHarnesses(): void {
  runCompanyProfileHarness()
  runCompanyOnboardingEntryHarness()
  runCompanyContextSerializerHarness()
  runCompanyProfileStoreHarness()
  runCompanyOnboardingQuestionnaireHarness()
}
