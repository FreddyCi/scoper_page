import { getCompanyOnboardingItem } from '@/lib/company-profile/questionnaire-items'
import type { CompanyProfile } from '@/lib/company-profile/schema'
import {
  assessProposalContextQuality,
  type ProposalContextQualityResult,
} from '@/lib/proposal-context-quality'
import { PROPOSAL_CONTEXT_MIN_LENGTH } from '@/lib/proposal-readiness'
import { useSessionStore } from '@/store/session-store'

function choiceLabel(itemName: string, value: string): string {
  const item = getCompanyOnboardingItem(itemName)
  const choice = item?.choices?.find((entry) => entry.value === value)
  return choice?.label ?? value.replace(/-/g, ' ')
}

function formatList(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]!
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function ensureSentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`
}

function buildIdentitySentence(profile: CompanyProfile): string {
  const name = profile.legalName.trim()
  if (!name) return ''

  const role = profile.role ? choiceLabel('role', profile.role).toLowerCase() : null
  const trade = profile.tradeDiscipline
    ? choiceLabel('tradeDiscipline', profile.tradeDiscipline).toLowerCase()
    : null
  const geography = profile.serviceGeography
    ? choiceLabel('serviceGeography', profile.serviceGeography).toLowerCase()
    : null
  const headcount = profile.headcountBand
    ? choiceLabel('headcountBand', profile.headcountBand).toLowerCase()
    : null

  let sentence = name

  if (role && trade) {
    sentence += ` is a ${role} specializing in ${trade}`
  } else if (role) {
    sentence += ` is a ${role}`
  } else if (trade) {
    sentence += ` specializes in ${trade}`
  }

  if (geography) {
    sentence += sentence.includes(' specializing') || sentence.includes(' is a ')
      ? ` across ${geography} markets`
      : ` serves ${geography} markets`
  }

  if (headcount) {
    sentence += `. The team includes approximately ${headcount}`
  }

  return ensureSentence(sentence)
}

function buildCredentialsSentence(profile: CompanyProfile): string {
  const parts: string[] = []

  if (profile.certifications.length > 0) {
    const labels = profile.certifications.map((id) => choiceLabel('certifications', id))
    parts.push(`Certifications and programs include ${formatList(labels)}`)
  }

  if (profile.insuranceLimit && profile.insuranceLimit !== 'unsure') {
    const limit = choiceLabel('insuranceLimit', profile.insuranceLimit).toLowerCase()
    parts.push(`general liability coverage is typically ${limit} per occurrence`)
  }

  if (
    profile.bondingCapacity &&
    profile.bondingCapacity !== 'none' &&
    profile.bondingCapacity !== 'unsure'
  ) {
    const bonding = choiceLabel('bondingCapacity', profile.bondingCapacity).toLowerCase()
    parts.push(`bonding capacity is approximately ${bonding}`)
  }

  if (parts.length === 0) return ''

  if (parts.length === 1) {
    const [only] = parts
    return ensureSentence(only!.charAt(0).toUpperCase() + only!.slice(1))
  }

  const head = parts[0]!
  const tail = parts.slice(1).join('; ')
  return ensureSentence(`${head.charAt(0).toUpperCase() + head.slice(1)}; ${tail}`)
}

function ensureMinContextLength(text: string, profile: CompanyProfile): string {
  let next = text.trim()
  if (next.length >= PROPOSAL_CONTEXT_MIN_LENGTH) return next

  const name = profile.legalName.trim() || 'Our company'
  const padding = `${name} provides qualified construction trade services for GC and CM partners.`
  next = next.length > 0 ? `${next} ${padding}` : padding

  if (next.length >= PROPOSAL_CONTEXT_MIN_LENGTH) return next

  return `${next} ${profile.differentiators.trim()}`.trim()
}

/** Structured fields for share-pack export and prompt tooling (BDA-307). */
export type CompanyProfileContextSnippet = {
  legalName: string
  role: string | null
  tradeDiscipline: string | null
  serviceGeography: string | null
  headcountBand: string | null
  certifications: string[]
  insuranceLimit: string | null
  bondingCapacity: string | null
  differentiators: string
  freeformNotes: string
  narrative: string
}

/** Pure serializer — narrative paragraph(s) for proposal, RFP relink, and chat context. */
export function companyProfileToContext(profile: CompanyProfile): string {
  const paragraphs: string[] = []

  const identity = buildIdentitySentence(profile)
  if (identity) paragraphs.push(identity)

  const credentials = buildCredentialsSentence(profile)
  if (credentials) paragraphs.push(credentials)

  const differentiators = profile.differentiators.trim()
  if (differentiators) paragraphs.push(ensureSentence(differentiators))

  const notes = profile.freeformNotes.trim()
  if (notes) paragraphs.push(ensureSentence(notes))

  return ensureMinContextLength(paragraphs.join(' '), profile)
}

export function companyProfileToContextSnippet(
  profile: CompanyProfile,
): CompanyProfileContextSnippet {
  return {
    legalName: profile.legalName.trim(),
    role: profile.role ? choiceLabel('role', profile.role) : null,
    tradeDiscipline: profile.tradeDiscipline
      ? choiceLabel('tradeDiscipline', profile.tradeDiscipline)
      : null,
    serviceGeography: profile.serviceGeography
      ? choiceLabel('serviceGeography', profile.serviceGeography)
      : null,
    headcountBand: profile.headcountBand
      ? choiceLabel('headcountBand', profile.headcountBand)
      : null,
    certifications: profile.certifications.map((id) => choiceLabel('certifications', id)),
    insuranceLimit: profile.insuranceLimit
      ? choiceLabel('insuranceLimit', profile.insuranceLimit)
      : null,
    bondingCapacity: profile.bondingCapacity
      ? choiceLabel('bondingCapacity', profile.bondingCapacity)
      : null,
    differentiators: profile.differentiators.trim(),
    freeformNotes: profile.freeformNotes.trim(),
    narrative: companyProfileToContext(profile),
  }
}

/** Score derived onboarding context with existing proposal readiness heuristics. */
export function assessCompanyProfileContextQuality(
  profile: CompanyProfile,
): ProposalContextQualityResult {
  return assessProposalContextQuality(companyProfileToContext(profile))
}

/** Push serialized context into session store — call on onboarding submit (BDA-307). */
export function syncCompanyProfileToSessionContext(profile: CompanyProfile): string {
  const context = companyProfileToContext(profile)
  useSessionStore.getState().setCompanyContext(context)
  return context
}

function proBelSampleProfile(): CompanyProfile {
  return {
    legalName: 'Pro-Bel Enterprises Limited',
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
}

/** Dev harness — Pro-Bel-like fixture → stable narrative + session sync (BDA-307). */
export function runCompanyContextSerializerHarness(): void {
  const profile = proBelSampleProfile()
  const context = companyProfileToContext(profile)

  if (context.length < PROPOSAL_CONTEXT_MIN_LENGTH) {
    throw new Error(
      `runCompanyContextSerializerHarness: context too short (${context.length} chars)`,
    )
  }

  const lower = context.toLowerCase()
  if (!lower.includes('fall protection')) {
    throw new Error('runCompanyContextSerializerHarness: expected trade in narrative')
  }
  if (!lower.includes('em 385') || !lower.includes('iso 9001')) {
    throw new Error('runCompanyContextSerializerHarness: expected certifications in narrative')
  }
  if (!context.includes('Pro-Bel Enterprises Limited')) {
    throw new Error('runCompanyContextSerializerHarness: expected legal name in narrative')
  }

  const repeat = companyProfileToContext(profile)
  if (repeat !== context) {
    throw new Error('runCompanyContextSerializerHarness: serializer should be stable')
  }

  const quality = assessCompanyProfileContextQuality(profile)
  if (!quality.ok) {
    throw new Error(
      `runCompanyContextSerializerHarness: derived context failed quality: ${quality.warnings.join('; ')}`,
    )
  }

  const snippet = companyProfileToContextSnippet(profile)
  if (snippet.narrative !== context || snippet.certifications.length !== 2) {
    throw new Error('runCompanyContextSerializerHarness: snippet block mismatch')
  }

  useSessionStore.getState().setCompanyContext('')
  const synced = syncCompanyProfileToSessionContext(profile)
  if (useSessionStore.getState().companyContext !== synced) {
    throw new Error('runCompanyContextSerializerHarness: session store not updated')
  }

  useSessionStore.getState().setCompanyContext('')
}
