import type { QuestionnaireItemDefinition } from '@shadcn/react/questionnaire'

export type CompanyOnboardingChoice = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export type CompanyOnboardingInput = {
  label: string
  placeholder?: string
}

/** One step in the company onboarding Questionnaire (BDA-304). */
export type CompanyOnboardingItem = {
  name: string
  required: boolean
  prompt: string
  description: string
  skippable?: boolean
  multiple?: boolean
  disabled?: boolean
  choices?: readonly CompanyOnboardingChoice[]
  input?: CompanyOnboardingInput
}

export const COMPANY_ONBOARDING_ITEMS: readonly CompanyOnboardingItem[] = [
  {
    name: 'legalName',
    required: true,
    prompt: 'Legal company name',
    description: 'As it appears on insurance certificates and bid bonds (e.g. Pro-Bel Enterprises Limited).',
    input: {
      label: 'Legal name',
      placeholder: 'Pro-Bel Enterprises Limited',
    },
  },
  {
    name: 'role',
    required: true,
    prompt: 'How does your company bid work?',
    description: 'This helps Scout tailor qualification and proposal language to subs vs GCs.',
    choices: [
      {
        value: 'subcontractor',
        label: 'Subcontractor',
        description: 'We perform a scoped trade package for a GC or CM.',
      },
      {
        value: 'general-contractor',
        label: 'General contractor',
        description: 'We prime contracts and manage subs.',
      },
      {
        value: 'construction-manager',
        label: 'Construction manager',
        description: 'Agency CM or CM-at-risk delivery.',
      },
      {
        value: 'specialty-trade',
        label: 'Specialty trade partner',
        description: 'Niche installer (fall protection, glazing, envelope, etc.).',
      },
      {
        value: 'supplier',
        label: 'Supplier / manufacturer rep',
        description: 'Materials, equipment, or delegated supply.',
      },
    ],
  },
  {
    name: 'tradeDiscipline',
    required: true,
    prompt: 'Primary trade or discipline',
    description: 'Pick the work you want evaluators and proposal drafts to emphasize.',
    choices: [
      {
        value: 'building-envelope',
        label: 'Building envelope',
        description: 'Curtain wall, waterproofing, air barrier, façade restoration.',
      },
      {
        value: 'fall-protection',
        label: 'Fall protection',
        description: 'Anchors, lifelines, guardrails, EM 385 programs.',
      },
      {
        value: 'glazing-windows',
        label: 'Glazing & windows',
        description: 'Storefront, curtain wall glazing, unitized systems.',
      },
      {
        value: 'roofing-waterproofing',
        label: 'Roofing & waterproofing',
        description: 'Low-slope, steep-slope, plaza decks.',
      },
      {
        value: 'concrete-masonry',
        label: 'Concrete & masonry',
        description: 'Structural concrete, tilt-up, CMU.',
      },
      {
        value: 'mechanical-hvac',
        label: 'Mechanical / HVAC',
        description: 'TAB, controls, plumbing, fire protection.',
      },
      {
        value: 'electrical',
        label: 'Electrical',
        description: 'Power, low voltage, specialty systems.',
      },
      { value: 'other', label: 'Other discipline' },
    ],
  },
  {
    name: 'serviceGeography',
    required: true,
    prompt: 'Typical project geography',
    description: 'Where do you usually perform work for GC partners?',
    choices: [
      { value: 'local-metro', label: 'Single metro / local market' },
      { value: 'regional', label: 'Regional (adjacent states or provinces)' },
      { value: 'multi-state', label: 'Multi-state / multi-region' },
      { value: 'national', label: 'National footprint' },
    ],
  },
  {
    name: 'headcountBand',
    required: true,
    prompt: 'Field + office headcount',
    description: 'Approximate full-time employees including field crews.',
    choices: [
      { value: '1-10', label: '1–10 employees' },
      { value: '11-50', label: '11–50 employees' },
      { value: '51-200', label: '51–200 employees' },
      { value: '201-500', label: '201–500 employees' },
      { value: '500-plus', label: '500+ employees' },
    ],
  },
  {
    name: 'certifications',
    required: false,
    skippable: true,
    multiple: true,
    prompt: 'Certifications & safety programs',
    description: 'Select all that apply — skip if none yet.',
    choices: [
      { value: 'iso-9001', label: 'ISO 9001 quality management' },
      { value: 'iso-14001', label: 'ISO 14001 environmental' },
      { value: 'osha-vpp', label: 'OSHA VPP / SHARP' },
      { value: 'em385', label: 'EM 385 compliant safety program' },
      { value: 'leed-ap', label: 'LEED AP on staff' },
      { value: 'nist-800-171', label: 'NIST 800-171 / CMMC readiness' },
      { value: 'other', label: 'Other certification' },
    ],
  },
  {
    name: 'insuranceLimit',
    required: false,
    skippable: true,
    prompt: 'General liability limits',
    description: 'Typical per-occurrence GL limit on your COI — skip if unknown.',
    choices: [
      { value: 'under-1m', label: 'Under $1M' },
      { value: '1m-5m', label: '$1M – $5M' },
      { value: '5m-10m', label: '$5M – $10M' },
      { value: '10m-plus', label: '$10M or more' },
      { value: 'unsure', label: 'Varies by project / not sure' },
    ],
  },
  {
    name: 'bondingCapacity',
    required: false,
    skippable: true,
    prompt: 'Bonding / surety capacity',
    description: 'Single-project bonding comfort — skip if not applicable.',
    choices: [
      { value: 'none', label: 'Not bonded / not required for our work' },
      { value: 'under-1m', label: 'Under $1M single project' },
      { value: '1m-5m', label: '$1M – $5M single project' },
      { value: '5m-plus', label: '$5M+ single project' },
      { value: 'unsure', label: 'Case-by-case / not sure' },
    ],
  },
  {
    name: 'differentiators',
    required: true,
    prompt: 'What sets your company apart?',
    description: 'Pick a preset or describe your edge in your own words.',
    choices: [
      {
        value: 'preset:em385-safety',
        label: 'EM 385 safety program',
        description: 'Documented rescue plans and compliant anchor installs.',
      },
      {
        value: 'preset:gc-partnerships',
        label: 'GC partnerships',
        description: 'Repeat work with regional GC partners.',
      },
      {
        value: 'preset:design-assist',
        label: 'Design-assist envelope',
        description: 'Early trade involvement and VE on façade systems.',
      },
      {
        value: 'preset:self-perform',
        label: 'Self-perform crews',
        description: 'Dedicated QC foreman on every active site.',
      },
    ],
    input: {
      label: 'Other differentiator',
      placeholder: 'e.g. Pro-Bel — fall protection and envelope sub serving DPR-class GC partners',
    },
  },
  {
    name: 'freeformNotes',
    required: false,
    skippable: true,
    prompt: 'Anything else for evaluators?',
    description: 'Optional context for RFP qualification and proposal drafts — skip if nothing to add.',
    input: {
      label: 'Additional notes',
      placeholder: 'Key clients, union status, prevailing wage experience…',
    },
  },
]

export type CompanyOnboardingItemName =
  | 'legalName'
  | 'role'
  | 'tradeDiscipline'
  | 'serviceGeography'
  | 'headcountBand'
  | 'certifications'
  | 'insuranceLimit'
  | 'bondingCapacity'
  | 'differentiators'
  | 'freeformNotes'

/** Questionnaire `items` prop — choices only (labels rendered in UI). */
export function companyOnboardingQuestionnaireItems(): QuestionnaireItemDefinition[] {
  return COMPANY_ONBOARDING_ITEMS.map((item) => ({
    name: item.name,
    required: item.required,
    disabled: item.disabled,
    choices: item.choices?.map((choice) => ({
      value: choice.value,
      disabled: choice.disabled,
    })),
  }))
}

export function assertUniqueCompanyOnboardingItemNames(): void {
  const names = new Set<string>()
  for (const item of COMPANY_ONBOARDING_ITEMS) {
    if (names.has(item.name)) {
      throw new Error(`assertUniqueCompanyOnboardingItemNames: duplicate name "${item.name}"`)
    }
    names.add(item.name)
  }
}

export function getCompanyOnboardingItem(name: string): CompanyOnboardingItem | undefined {
  return COMPANY_ONBOARDING_ITEMS.find((item) => item.name === name)
}

export function isSkippableCompanyOnboardingItem(name: string): boolean {
  return getCompanyOnboardingItem(name)?.skippable === true
}
