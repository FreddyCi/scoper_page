/** Company role in the construction wedge (BDA-304). */
export type CompanyRole =
  | 'subcontractor'
  | 'general-contractor'
  | 'construction-manager'
  | 'specialty-trade'
  | 'supplier'

/** Primary trade / discipline. */
export type TradeDiscipline =
  | 'building-envelope'
  | 'fall-protection'
  | 'glazing-windows'
  | 'roofing-waterproofing'
  | 'concrete-masonry'
  | 'mechanical-hvac'
  | 'electrical'
  | 'other'

/** Geographic service footprint. */
export type ServiceGeography = 'local-metro' | 'regional' | 'multi-state' | 'national'

/** Employee count band. */
export type HeadcountBand = '1-10' | '11-50' | '51-200' | '201-500' | '500-plus'

/** Safety / quality certifications relevant to subs and GC partners. */
export type CertificationId =
  | 'iso-9001'
  | 'iso-14001'
  | 'osha-vpp'
  | 'em385'
  | 'leed-ap'
  | 'nist-800-171'
  | 'other'

/** General liability limit band. */
export type InsuranceLimitBand = 'under-1m' | '1m-5m' | '5m-10m' | '10m-plus' | 'unsure'

/** Bonding / surety capacity band. */
export type BondingCapacity = 'none' | 'under-1m' | '1m-5m' | '5m-plus' | 'unsure'

/** Structured onboarding profile — feeds companyContext serializer (BDA-307). */
export type CompanyProfile = {
  legalName: string
  role: CompanyRole | null
  tradeDiscipline: TradeDiscipline | null
  serviceGeography: ServiceGeography | null
  headcountBand: HeadcountBand | null
  certifications: CertificationId[]
  insuranceLimit: InsuranceLimitBand | null
  bondingCapacity: BondingCapacity | null
  /** Preset or freeform differentiators shown to evaluators and proposal prompts. */
  differentiators: string
  freeformNotes: string
}

export type CompanyProfileField = keyof CompanyProfile

export type CompanyProfileValidationError = {
  field: CompanyProfileField
  message: string
}

export type CompanyProfileValidationResult = {
  ok: boolean
  errors: CompanyProfileValidationError[]
  /** First invalid questionnaire item `name` for return-to-step navigation. */
  firstInvalidItem: string | null
}

const REQUIRED_TEXT_MIN = 2
const DIFFERENTIATORS_MIN = 8

export function createEmptyCompanyProfile(): CompanyProfile {
  return {
    legalName: '',
    role: null,
    tradeDiscipline: null,
    serviceGeography: null,
    headcountBand: null,
    certifications: [],
    insuranceLimit: null,
    bondingCapacity: null,
    differentiators: '',
    freeformNotes: '',
  }
}

function isCompanyRole(value: string): value is CompanyRole {
  return (
    value === 'subcontractor' ||
    value === 'general-contractor' ||
    value === 'construction-manager' ||
    value === 'specialty-trade' ||
    value === 'supplier'
  )
}

function isTradeDiscipline(value: string): value is TradeDiscipline {
  return (
    value === 'building-envelope' ||
    value === 'fall-protection' ||
    value === 'glazing-windows' ||
    value === 'roofing-waterproofing' ||
    value === 'concrete-masonry' ||
    value === 'mechanical-hvac' ||
    value === 'electrical' ||
    value === 'other'
  )
}

function isServiceGeography(value: string): value is ServiceGeography {
  return (
    value === 'local-metro' ||
    value === 'regional' ||
    value === 'multi-state' ||
    value === 'national'
  )
}

function isHeadcountBand(value: string): value is HeadcountBand {
  return (
    value === '1-10' ||
    value === '11-50' ||
    value === '51-200' ||
    value === '201-500' ||
    value === '500-plus'
  )
}

function isCertificationId(value: string): value is CertificationId {
  return (
    value === 'iso-9001' ||
    value === 'iso-14001' ||
    value === 'osha-vpp' ||
    value === 'em385' ||
    value === 'leed-ap' ||
    value === 'nist-800-171' ||
    value === 'other'
  )
}

function isInsuranceLimitBand(value: string): value is InsuranceLimitBand {
  return (
    value === 'under-1m' ||
    value === '1m-5m' ||
    value === '5m-10m' ||
    value === '10m-plus' ||
    value === 'unsure'
  )
}

function isBondingCapacity(value: string): value is BondingCapacity {
  return (
    value === 'none' ||
    value === 'under-1m' ||
    value === '1m-5m' ||
    value === '5m-plus' ||
    value === 'unsure'
  )
}

/** Map questionnaire item names to profile fields for validation errors. */
export const COMPANY_PROFILE_ITEM_FIELD: Record<string, CompanyProfileField> = {
  legalName: 'legalName',
  role: 'role',
  tradeDiscipline: 'tradeDiscipline',
  serviceGeography: 'serviceGeography',
  headcountBand: 'headcountBand',
  certifications: 'certifications',
  insuranceLimit: 'insuranceLimit',
  bondingCapacity: 'bondingCapacity',
  differentiators: 'differentiators',
  freeformNotes: 'freeformNotes',
}

/** Validate parsed profile — plain TS (Zod optional wrapper in BDA-306+). */
export function validateCompanyProfile(profile: CompanyProfile): CompanyProfileValidationResult {
  const errors: CompanyProfileValidationError[] = []

  if (profile.legalName.trim().length < REQUIRED_TEXT_MIN) {
    errors.push({
      field: 'legalName',
      message: 'Enter your company legal name (at least 2 characters).',
    })
  }

  if (profile.role == null) {
    errors.push({ field: 'role', message: 'Select how your company participates on projects.' })
  }

  if (profile.tradeDiscipline == null) {
    errors.push({ field: 'tradeDiscipline', message: 'Select your primary trade or discipline.' })
  }

  if (profile.serviceGeography == null) {
    errors.push({ field: 'serviceGeography', message: 'Select your typical service geography.' })
  }

  if (profile.headcountBand == null) {
    errors.push({ field: 'headcountBand', message: 'Select an employee count band.' })
  }

  if (profile.differentiators.trim().length < DIFFERENTIATORS_MIN) {
    errors.push({
      field: 'differentiators',
      message: `Describe what sets your company apart (at least ${DIFFERENTIATORS_MIN} characters).`,
    })
  }

  const firstInvalidField = errors[0]?.field ?? null
  const firstInvalidItem =
    firstInvalidField != null
      ? (Object.entries(COMPANY_PROFILE_ITEM_FIELD).find(([, field]) => field === firstInvalidField)?.[0] ??
        null)
      : null

  return {
    ok: errors.length === 0,
    errors,
    firstInvalidItem,
  }
}

export function normalizeTextAnswer(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeSingleChoiceAnswer<T extends string>(
  value: FormDataEntryValue | null,
  guard: (value: string) => value is T,
): T | null {
  const text = normalizeTextAnswer(value)
  if (!text || !guard(text)) return null
  return text
}

export function normalizeMultipleChoiceAnswers<T extends string>(
  formData: FormData,
  name: string,
  guard: (value: string) => value is T,
): T[] {
  const seen = new Set<T>()
  const values: T[] = []

  for (const entry of formData.getAll(name)) {
    const text = normalizeTextAnswer(entry)
    if (!text || !guard(text) || seen.has(text)) continue
    seen.add(text)
    values.push(text)
  }

  return values
}

export type ParseCompanyProfileOptions = {
  /** Questionnaire item names the user skipped — omitted from required checks. */
  skippedItems?: readonly string[]
}

/** Build a profile from native Questionnaire form serialization (BDA-304). */
export function parseCompanyProfileFromFormData(
  formData: FormData,
  options: ParseCompanyProfileOptions = {},
): CompanyProfile {
  const skipped = new Set(options.skippedItems ?? [])
  const profile = createEmptyCompanyProfile()

  profile.legalName = normalizeTextAnswer(formData.get('legalName'))
  profile.role = normalizeSingleChoiceAnswer(formData.get('role'), isCompanyRole)
  profile.tradeDiscipline = normalizeSingleChoiceAnswer(
    formData.get('tradeDiscipline'),
    isTradeDiscipline,
  )
  profile.serviceGeography = normalizeSingleChoiceAnswer(
    formData.get('serviceGeography'),
    isServiceGeography,
  )
  profile.headcountBand = normalizeSingleChoiceAnswer(formData.get('headcountBand'), isHeadcountBand)

  if (!skipped.has('certifications')) {
    profile.certifications = normalizeMultipleChoiceAnswers(
      formData,
      'certifications',
      isCertificationId,
    )
  }

  if (!skipped.has('insuranceLimit')) {
    profile.insuranceLimit = normalizeSingleChoiceAnswer(
      formData.get('insuranceLimit'),
      isInsuranceLimitBand,
    )
  }

  if (!skipped.has('bondingCapacity')) {
    profile.bondingCapacity = normalizeSingleChoiceAnswer(
      formData.get('bondingCapacity'),
      isBondingCapacity,
    )
  }

  profile.differentiators = resolveDifferentiatorsAnswer(formData)

  if (!skipped.has('freeformNotes')) {
    profile.freeformNotes = normalizeTextAnswer(formData.get('freeformNotes'))
  }

  return profile
}

function resolveDifferentiatorsAnswer(formData: FormData): string {
  const raw = normalizeTextAnswer(formData.get('differentiators'))
  if (!raw) return ''

  if (raw.startsWith('preset:')) {
    return DIFFERENTIATOR_PRESET_LABELS[raw.slice('preset:'.length)] ?? raw.slice('preset:'.length)
  }

  return raw
}

function normalizeCertifications(value: unknown): CertificationId[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<CertificationId>()
  const next: CertificationId[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !isCertificationId(item) || seen.has(item)) continue
    seen.add(item)
    next.push(item)
  }
  return next
}

/** Safe JSON → profile for localStorage hydration (BDA-305). */
export function parsePersistedCompanyProfile(value: unknown): CompanyProfile {
  const defaults = createEmptyCompanyProfile()
  if (!value || typeof value !== 'object') return defaults

  const raw = value as Record<string, unknown>

  return {
    legalName: typeof raw.legalName === 'string' ? raw.legalName : defaults.legalName,
    role:
      typeof raw.role === 'string' && isCompanyRole(raw.role) ? raw.role : defaults.role,
    tradeDiscipline:
      typeof raw.tradeDiscipline === 'string' && isTradeDiscipline(raw.tradeDiscipline)
        ? raw.tradeDiscipline
        : defaults.tradeDiscipline,
    serviceGeography:
      typeof raw.serviceGeography === 'string' && isServiceGeography(raw.serviceGeography)
        ? raw.serviceGeography
        : defaults.serviceGeography,
    headcountBand:
      typeof raw.headcountBand === 'string' && isHeadcountBand(raw.headcountBand)
        ? raw.headcountBand
        : defaults.headcountBand,
    certifications: normalizeCertifications(raw.certifications),
    insuranceLimit:
      typeof raw.insuranceLimit === 'string' && isInsuranceLimitBand(raw.insuranceLimit)
        ? raw.insuranceLimit
        : defaults.insuranceLimit,
    bondingCapacity:
      typeof raw.bondingCapacity === 'string' && isBondingCapacity(raw.bondingCapacity)
        ? raw.bondingCapacity
        : defaults.bondingCapacity,
    differentiators:
      typeof raw.differentiators === 'string' ? raw.differentiators : defaults.differentiators,
    freeformNotes:
      typeof raw.freeformNotes === 'string' ? raw.freeformNotes : defaults.freeformNotes,
  }
}

/** Preset differentiator values use `preset:<id>` in form posts. */
export const DIFFERENTIATOR_PRESET_LABELS: Record<string, string> = {
  'em385-safety': 'EM 385 compliant safety program and documented rescue plans',
  'gc-partnerships': 'Long-term GC partnerships on commercial and institutional work',
  'design-assist': 'Design-assist and value engineering on envelope systems',
  'self-perform': 'Self-perform crews with dedicated QC foreman on every site',
}
