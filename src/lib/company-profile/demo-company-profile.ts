import { SAMPLE_FIXTURE_COMPANY } from '@/lib/sample-fixture-company'
import type { CompanyProfile } from '@/lib/company-profile/schema'

/** Full questionnaire answers for Scout proposal / onboarding demos. */
export const DEMO_COMPANY_PROFILE: CompanyProfile = {
  legalName: SAMPLE_FIXTURE_COMPANY.legalName,
  role: 'subcontractor',
  tradeDiscipline: 'fall-protection',
  serviceGeography: 'regional',
  headcountBand: '51-200',
  certifications: ['em385', 'iso-9001'],
  insuranceLimit: '5m-10m',
  bondingCapacity: '1m-5m',
  differentiators: 'EM 385 compliant safety program and documented rescue plans',
  freeformNotes: 'Serving DPR-class GC partners on commercial envelope work.',
}

export function demoCompanyProfile(): CompanyProfile {
  return { ...DEMO_COMPANY_PROFILE, certifications: [...DEMO_COMPANY_PROFILE.certifications] }
}

export function isDemoCompanyProfile(profile: CompanyProfile): boolean {
  return (
    profile.legalName === DEMO_COMPANY_PROFILE.legalName &&
    profile.role === DEMO_COMPANY_PROFILE.role &&
    profile.tradeDiscipline === DEMO_COMPANY_PROFILE.tradeDiscipline &&
    profile.differentiators === DEMO_COMPANY_PROFILE.differentiators
  )
}
