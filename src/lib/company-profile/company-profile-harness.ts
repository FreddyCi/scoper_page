import {
  assertUniqueCompanyOnboardingItemNames,
  COMPANY_ONBOARDING_ITEMS,
} from '@/lib/company-profile/questionnaire-items'
import {
  createEmptyCompanyProfile,
  DIFFERENTIATOR_PRESET_LABELS,
  parseCompanyProfileFromFormData,
  validateCompanyProfile,
} from '@/lib/company-profile/schema'

/** Dev harness — company profile schema + questionnaire items (BDA-304). */
export function runCompanyProfileHarness(): void {
  assertUniqueCompanyOnboardingItemNames()

  if (COMPANY_ONBOARDING_ITEMS.length < 8) {
    throw new Error('runCompanyProfileHarness: expected at least 8 onboarding items')
  }

  const requiredNames = new Set(
    COMPANY_ONBOARDING_ITEMS.filter((item) => item.required).map((item) => item.name),
  )
  const skippableNames = COMPANY_ONBOARDING_ITEMS.filter((item) => item.skippable === true).map(
    (item) => item.name,
  )

  if (!requiredNames.has('legalName') || !requiredNames.has('differentiators')) {
    throw new Error('runCompanyProfileHarness: missing required core items')
  }
  if (!skippableNames.includes('certifications') || !skippableNames.includes('freeformNotes')) {
    throw new Error('runCompanyProfileHarness: expected skippable optional items')
  }

  const emptyValidation = validateCompanyProfile(createEmptyCompanyProfile())
  if (emptyValidation.ok) {
    throw new Error('runCompanyProfileHarness: empty profile should fail validation')
  }
  if (emptyValidation.firstInvalidItem !== 'legalName') {
    throw new Error('runCompanyProfileHarness: first invalid item should be legalName')
  }

  const partialForm = new FormData()
  partialForm.set('legalName', 'Pro-Bel Enterprises Limited')
  partialForm.set('role', 'subcontractor')
  partialForm.set('tradeDiscipline', 'fall-protection')
  partialForm.set('serviceGeography', 'regional')
  partialForm.set('headcountBand', '51-200')

  const partialProfile = parseCompanyProfileFromFormData(partialForm)
  const partialValidation = validateCompanyProfile(partialProfile)
  if (partialValidation.ok) {
    throw new Error('runCompanyProfileHarness: profile without differentiators should fail')
  }

  const skippedForm = new FormData()
  skippedForm.set('legalName', 'Pro-Bel Enterprises Limited')
  skippedForm.set('role', 'subcontractor')
  skippedForm.set('tradeDiscipline', 'building-envelope')
  skippedForm.set('serviceGeography', 'multi-state')
  skippedForm.set('headcountBand', '11-50')
  skippedForm.set('differentiators', 'preset:gc-partnerships')
  skippedForm.append('certifications', 'em385')
  skippedForm.append('certifications', 'iso-9001')

  const skippedProfile = parseCompanyProfileFromFormData(skippedForm, {
    skippedItems: ['insuranceLimit', 'bondingCapacity', 'freeformNotes'],
  })

  if (skippedProfile.insuranceLimit != null || skippedProfile.bondingCapacity != null) {
    throw new Error('runCompanyProfileHarness: skipped optional fields should stay null')
  }
  if (skippedProfile.freeformNotes !== '') {
    throw new Error('runCompanyProfileHarness: skipped freeformNotes should be empty')
  }
  if (skippedProfile.certifications.length !== 2) {
    throw new Error('runCompanyProfileHarness: certifications should parse multiple values')
  }
  if (
    skippedProfile.differentiators !== DIFFERENTIATOR_PRESET_LABELS['gc-partnerships']
  ) {
    throw new Error('runCompanyProfileHarness: preset differentiator label mismatch')
  }

  const completeValidation = validateCompanyProfile(skippedProfile)
  if (!completeValidation.ok) {
    throw new Error(
      `runCompanyProfileHarness: complete profile should validate: ${completeValidation.errors
        .map((error) => error.message)
        .join('; ')}`,
    )
  }

  const freeformForm = new FormData()
  freeformForm.set('legalName', 'Acme Envelope LLC')
  freeformForm.set('role', 'specialty-trade')
  freeformForm.set('tradeDiscipline', 'building-envelope')
  freeformForm.set('serviceGeography', 'local-metro')
  freeformForm.set('headcountBand', '1-10')
  freeformForm.set(
    'differentiators',
    'Design-assist on curtain wall replacements for healthcare campuses.',
  )
  freeformForm.set('freeformNotes', 'Union ironworkers; prevailing wage experience in NYC.')

  const freeformProfile = parseCompanyProfileFromFormData(freeformForm, {
    skippedItems: ['certifications', 'insuranceLimit', 'bondingCapacity'],
  })

  if (!validateCompanyProfile(freeformProfile).ok) {
    throw new Error('runCompanyProfileHarness: freeform differentiators profile should validate')
  }
}
