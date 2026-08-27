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
  differentiators:
    'EM 385-compliant site safety program with documented rescue and fall-arrest plans; ISO 9001 quality management on envelope installs; trained crews for rooftop anchors, horizontal lifelines, and atrium netting.',
  freeformNotes:
    'Past performance on DPR-class commercial envelope and fall-protection packages across regional metros — anchor layout, lifeline runs, perimeter netting, and compliance submittals for GC partners. Typical subcontract packages $500K–$4M with dedicated safety director and QC walkdowns on weatherproofing tie-ins. Bonding and insurance aligned with large CM/GC master agreements.',
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
