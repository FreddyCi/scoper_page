import { PROPOSAL_CONTEXT_MIN_LENGTH } from '@/lib/proposal-readiness'
import type { CompanyProfileState } from '@/store/company-profile-store'

export type CompanyOnboardingEntryContext = {
  hasCompletedOnboarding: boolean
  onboardingPromptDismissed: boolean
  hasShareLink: boolean
}

/** True when the first-visit company profile dialog should auto-open (BDA-308). */
export function shouldAutoOpenCompanyOnboardingDialog(
  context: CompanyOnboardingEntryContext,
): boolean {
  if (context.hasCompletedOnboarding) return false
  if (context.onboardingPromptDismissed) return false
  if (context.hasShareLink) return false
  return true
}

/** Proposal setup should show questionnaire CTA instead of empty textarea. */
export function shouldShowCompanyProfileSetupCta(
  hasCompletedOnboarding: boolean,
  companyContext: string,
): boolean {
  if (hasCompletedOnboarding) return false
  return companyContext.trim().length < PROPOSAL_CONTEXT_MIN_LENGTH
}

export function readCompanyOnboardingEntryContext(
  state: Pick<CompanyProfileState, 'completedAt' | 'onboardingPromptDismissed'>,
): Pick<CompanyOnboardingEntryContext, 'hasCompletedOnboarding' | 'onboardingPromptDismissed'> {
  return {
    hasCompletedOnboarding: state.completedAt != null,
    onboardingPromptDismissed: state.onboardingPromptDismissed,
  }
}

/** Dev harness — onboarding entry predicates (BDA-308). */
export function runCompanyOnboardingEntryHarness(): void {
  const base: CompanyOnboardingEntryContext = {
    hasCompletedOnboarding: false,
    onboardingPromptDismissed: false,
    hasShareLink: false,
  }

  if (!shouldAutoOpenCompanyOnboardingDialog(base)) {
    throw new Error('runCompanyOnboardingEntryHarness: fresh profile should auto-open onboarding')
  }

  if (shouldAutoOpenCompanyOnboardingDialog({ ...base, onboardingPromptDismissed: true })) {
    throw new Error('runCompanyOnboardingEntryHarness: dismissed should block auto-open')
  }

  if (shouldAutoOpenCompanyOnboardingDialog({ ...base, hasCompletedOnboarding: true })) {
    throw new Error('runCompanyOnboardingEntryHarness: completed profile should block auto-open')
  }

  if (shouldAutoOpenCompanyOnboardingDialog({ ...base, hasShareLink: true })) {
    throw new Error('runCompanyOnboardingEntryHarness: share link should block auto-open')
  }

  if (!shouldShowCompanyProfileSetupCta(false, '')) {
    throw new Error('runCompanyOnboardingEntryHarness: empty context should show setup CTA')
  }

  if (shouldShowCompanyProfileSetupCta(true, '')) {
    throw new Error('runCompanyOnboardingEntryHarness: completed profile should hide setup CTA')
  }

  if (shouldShowCompanyProfileSetupCta(false, 'x'.repeat(PROPOSAL_CONTEXT_MIN_LENGTH))) {
    throw new Error('runCompanyOnboardingEntryHarness: long context should hide setup CTA')
  }
}
