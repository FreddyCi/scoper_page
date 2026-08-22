import { DIFFERENTIATOR_PRESET_LABELS, type CompanyProfile } from '@/lib/company-profile/schema'

export type CompanyProfileFormDefaults = Record<string, string | readonly string[]>

function differentiatorFormValue(differentiators: string): string {
  if (!differentiators.trim()) return ''

  for (const [presetId, label] of Object.entries(DIFFERENTIATOR_PRESET_LABELS)) {
    if (label === differentiators.trim()) {
      return `preset:${presetId}`
    }
  }

  return differentiators.trim()
}

/** Map persisted profile → native form defaults for Questionnaire resume (BDA-306). */
export function companyProfileToFormDefaults(profile: CompanyProfile): CompanyProfileFormDefaults {
  const defaults: CompanyProfileFormDefaults = {}

  if (profile.legalName.trim()) defaults.legalName = profile.legalName.trim()
  if (profile.role) defaults.role = profile.role
  if (profile.tradeDiscipline) defaults.tradeDiscipline = profile.tradeDiscipline
  if (profile.serviceGeography) defaults.serviceGeography = profile.serviceGeography
  if (profile.headcountBand) defaults.headcountBand = profile.headcountBand
  if (profile.certifications.length > 0) defaults.certifications = profile.certifications
  if (profile.insuranceLimit) defaults.insuranceLimit = profile.insuranceLimit
  if (profile.bondingCapacity) defaults.bondingCapacity = profile.bondingCapacity

  const differentiators = differentiatorFormValue(profile.differentiators)
  if (differentiators) defaults.differentiators = differentiators

  if (profile.freeformNotes.trim()) defaults.freeformNotes = profile.freeformNotes.trim()

  return defaults
}

export function formDefaultString(
  defaults: CompanyProfileFormDefaults,
  name: string,
): string | undefined {
  const value = defaults[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function formDefaultIncludes(
  defaults: CompanyProfileFormDefaults,
  name: string,
  choiceValue: string,
): boolean {
  const value = defaults[name]
  if (Array.isArray(value)) return value.includes(choiceValue)
  return value === choiceValue
}
