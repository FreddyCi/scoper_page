import type { ProposalPackageKind } from '@/lib/proposal-package-classifier'
import { computeVolumeGenerationProgress } from '@/lib/proposal-volume-section'
import type {
  BlockRecord,
  ProposalRequirementsProfile,
  ProposalVolume,
  ProposalVolumeSection,
} from '@/lib/types'
import {
  commonSectionPathPrefix,
  compactSectionPathLabel,
  groupBlocksBySection,
} from '@/services/document-blocks'
import { buildSectionFindClauseQuery } from '@/lib/proposal-section-find-clause'

export const SOLICITATION_SECTIONS_MAX = 8
export const CONTRACT_FRAMEWORK_SECTIONS_MAX = 12
export const CONTRACT_FRAMEWORK_SECTIONS_MIN = 6
/** Cap OCR/inline-derived outlines so one volume is not 10+ repetitive turns. */
export const CONTRACT_FRAMEWORK_INLINE_SECTIONS_MAX = 6

const MIN_SECTION_BLOCK_CHARS = 80

const VOLUME_SCOPE_STOP_WORDS = new Set([
  'address',
  'how',
  'the',
  'and',
  'any',
  'with',
  'that',
  'this',
  'from',
  'your',
  'respond',
  'requirements',
  'requirement',
  'align',
  'agreement',
  'templates',
  'applicable',
  'explain',
  'describe',
  'cover',
  'clarify',
])

const INLINE_SECTION_HEADING =
  /^(?:section\s+[a-z0-9.]+\s*[-–—:]?\s*.+|(?:\d+\.){1,3}\s+[A-Z][^\n]{4,80})$/im

const KEYWORD_SECTION_HINTS: { pattern: RegExp; title: string }[] = [
  { pattern: /\binsurance\b|\bcoverage\b/i, title: 'Insurance requirements' },
  { pattern: /\bbond(ing)?\b/i, title: 'Bonding' },
  { pattern: /\bindemnif/i, title: 'Indemnification' },
  { pattern: /\blimitation of liability\b/i, title: 'Limitation of liability' },
  { pattern: /\bintellectual property\b|\bwork product\b/i, title: 'Intellectual property' },
  { pattern: /\bconfidential/i, title: 'Confidentiality' },
  { pattern: /\bpayment\b|\binvoic/i, title: 'Payment terms' },
  { pattern: /\btermin(ation|ate)\b/i, title: 'Term and termination' },
  { pattern: /\bwarrant/i, title: 'Warranties' },
  { pattern: /\bgoverning law\b|\bdispute\b/i, title: 'Dispute resolution' },
  { pattern: /\bsecurity\b|\bcyber\b/i, title: 'Security requirements' },
  { pattern: /\bstaff(ing)?\b|\bkey personnel\b/i, title: 'Staffing and key personnel' },
  { pattern: /\bmethodology\b|\bapproach\b/i, title: 'Technical approach' },
  { pattern: /\bprice\b|\bpricing\b|\bcost proposal\b/i, title: 'Pricing' },
  { pattern: /\bpast performance\b/i, title: 'Past performance' },
]

export type DeriveProposalSectionsInput = {
  volume: ProposalVolume
  blocks: BlockRecord[]
  packageKind: ProposalPackageKind
}

export { buildSectionFindClauseQuery } from '@/lib/proposal-section-find-clause'

export function maxSectionsForPackageKind(packageKind: ProposalPackageKind): number {
  return packageKind === 'contract_framework'
    ? CONTRACT_FRAMEWORK_SECTIONS_MAX
    : SOLICITATION_SECTIONS_MAX
}

function sectionIdFromTitle(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36)
  return `sec-${index}-${slug || 'part'}`
}

function blocksScopedToVolume(blocks: BlockRecord[], volume: ProposalVolume): BlockRecord[] {
  const groups = groupBlocksBySection(blocks)
  const titleNeedle = volume.title.toLowerCase()
  const matched =
    groups.find((group) => group.label.toLowerCase() === titleNeedle) ??
    groups.find((group) => group.label.toLowerCase().includes(titleNeedle.slice(0, 24)))

  if (matched?.blocks.length) {
    return matched.blocks
  }

  const tokens = volumeFocusTokens(volume)
  if (tokens.length === 0) {
    return blocks.slice(0, Math.min(blocks.length, 96))
  }

  const focused = blocks.filter((block) => blockMatchesVolumeFocus(block, tokens))
  if (focused.length >= 3) {
    return focused
  }

  return blocks.slice(0, Math.min(blocks.length, 96))
}

function volumeFocusTokens(volume: ProposalVolume): string[] {
  const raw = `${volume.title} ${volume.requirementSummary}`.toLowerCase()
  const tokens = raw.match(/[a-z0-9]{4,}/g) ?? []
  const unique: string[] = []
  for (const token of tokens) {
    if (VOLUME_SCOPE_STOP_WORDS.has(token)) continue
    if (!unique.includes(token)) unique.push(token)
  }
  return unique
}

function blockMatchesVolumeFocus(block: BlockRecord, tokens: string[]): boolean {
  const hay = `${block.section_path ?? ''} ${block.text}`.toLowerCase()
  return tokens.some((token) => hay.includes(token))
}

/** Reject TOC/OCR junk and meta titles before sectional generation (BDA-218 QA). */
export function isRejectedProposalSectionTitle(title: string): boolean {
  const trimmed = title.trim()
  if (trimmed.length < 3) return true
  if (trimmed.length > 100) return true
  if (/\.{3,}/.test(trimmed)) return true
  if (/\s+\d{1,4}\s*$/.test(trimmed) && /[.·…]{2,}/.test(trimmed)) return true
  if (/^section\s+\d+\.?\s*$/i.test(trimmed)) return true
  if (/^##?\s*section\s+\d+/i.test(trimmed)) return true
  if (/source document:/i.test(trimmed)) return true
  if (/\.pdf\b/i.test(trimmed)) return true
  if (trimmed.length > 48 && trimmed === trimmed.toUpperCase() && /[;…]/.test(trimmed)) {
    return true
  }
  return false
}

function filterSectionTitles(titles: string[]): string[] {
  return dedupeTitles(titles).filter((title) => !isRejectedProposalSectionTitle(title))
}

function sectionTitlesFromGroups(scopedBlocks: BlockRecord[]): string[] {
  const paths = scopedBlocks
    .map((block) => block.section_path?.trim())
    .filter((path): path is string => Boolean(path))
  const prefix = commonSectionPathPrefix(paths)
  const groups = groupBlocksBySection(scopedBlocks)

  return groups
    .map((group) => {
      const label =
        group.label === 'Document' && paths.length > 0
          ? compactSectionPathLabel(paths[0] ?? group.label, prefix)
          : compactSectionPathLabel(group.label, prefix)
      const charCount = group.blocks.reduce((total, block) => total + block.text.length, 0)
      return { label, charCount }
    })
    .filter((item) => item.label !== 'Document' && item.charCount >= MIN_SECTION_BLOCK_CHARS)
    .map((item) => item.label)
}

function sectionTitlesFromInlineHeadings(scopedBlocks: BlockRecord[]): string[] {
  const titles: string[] = []
  for (const block of scopedBlocks) {
    for (const line of block.text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length < 8 || trimmed.length > 120) continue
      if (!INLINE_SECTION_HEADING.test(trimmed)) continue
      titles.push(trimmed.replace(/^(?:section\s+[a-z0-9.]+\s*[-–—:]?\s*)/i, '').trim() || trimmed)
    }
  }
  return titles
}

function sectionTitlesFromKeywords(text: string, limit: number): string[] {
  const titles: string[] = []
  for (const hint of KEYWORD_SECTION_HINTS) {
    if (titles.length >= limit) break
    if (hint.pattern.test(text) && !titles.includes(hint.title)) {
      titles.push(hint.title)
    }
  }
  return titles
}

function dedupeTitles(titles: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const title of titles) {
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(title)
  }
  return result
}

function buildSection(
  volume: ProposalVolume,
  title: string,
  index: number,
  packageKind: ProposalPackageKind,
): ProposalVolumeSection {
  return {
    id: sectionIdFromTitle(title, index),
    title,
    findClauseQuery: buildSectionFindClauseQuery(volume, title, packageKind),
    status: 'pending',
  }
}

function wholeVolumeSection(volume: ProposalVolume, packageKind: ProposalPackageKind): ProposalVolumeSection {
  return buildSection(volume, volume.title, 0, packageKind)
}

/**
 * Derive ordered sectional outline for one proposal volume (BDA-161).
 */
export function deriveProposalSectionsForVolume(
  input: DeriveProposalSectionsInput,
): ProposalVolumeSection[] {
  const { volume, blocks, packageKind } = input
  const maxSections = maxSectionsForPackageKind(packageKind)
  const scoped = blocksScopedToVolume(blocks, volume)
  const corpus = scoped.map((block) => block.text).join('\n')

  const groupTitles = sectionTitlesFromGroups(scoped)
  let titles = filterSectionTitles([
    ...groupTitles,
    ...sectionTitlesFromInlineHeadings(scoped),
  ])

  if (titles.length < 2) {
    titles = filterSectionTitles([
      ...titles,
      ...sectionTitlesFromKeywords(corpus, maxSections),
    ])
  }

  if (packageKind === 'contract_framework' && titles.length < CONTRACT_FRAMEWORK_SECTIONS_MIN) {
    const keywordTitles = sectionTitlesFromKeywords(
      `${volume.title}\n${volume.requirementSummary}`,
      maxSections,
    )
    titles = filterSectionTitles([...titles, ...keywordTitles]).slice(0, maxSections)
  }

  if (titles.length === 0) {
    return [wholeVolumeSection(volume, packageKind)]
  }

  if (titles.length === 1 && packageKind !== 'contract_framework') {
    return [wholeVolumeSection(volume, packageKind)]
  }

  const sectionCap =
    groupTitles.length >= 2
      ? maxSections
      : packageKind === 'contract_framework'
        ? Math.min(CONTRACT_FRAMEWORK_INLINE_SECTIONS_MAX, maxSections)
        : maxSections
  const selected = titles.slice(0, sectionCap)
  return selected.map((title, index) => buildSection(volume, title, index, packageKind))
}

/** Lazily attach sections to each volume (generate start or profile enrichment). */
export function attachProposalSectionsToProfile(
  profile: ProposalRequirementsProfile,
  blocks: BlockRecord[],
): ProposalRequirementsProfile {
  return {
    ...profile,
    volumes: profile.volumes.map((volume) => {
      if (volume.sections && volume.sections.length > 0) {
        return volume
      }
      const sections = deriveProposalSectionsForVolume({
        volume,
        blocks,
        packageKind: profile.packageKind,
      })
      return {
        ...volume,
        sections,
        generationProgress: computeVolumeGenerationProgress(sections),
      }
    }),
  }
}

function mockBlock(text: string, section_path?: string): BlockRecord {
  return {
    block_id: `b-${Math.random().toString(36).slice(2, 8)}`,
    doc_id: 'doc-1',
    text,
    section_path,
  }
}

/** Dev harness — section derivation caps and fallback (BDA-161) */
export function runDeriveProposalSectionsHarness(): void {
  const volume: ProposalVolume = {
    id: 'vol-tech',
    title: 'Technical approach',
    requirementSummary: 'Describe methodology and staffing per Section L.',
    solicitationRefs: ['Section L.1'],
    status: 'pending',
  }

  const multiBlocks: BlockRecord[] = [
    mockBlock('Staffing plan content '.repeat(20), 'Technical › Staffing'),
    mockBlock('Methodology details '.repeat(25), 'Technical › Methodology'),
    mockBlock('Insurance must be maintained '.repeat(15), 'Technical › Insurance'),
  ]

  const multi = deriveProposalSectionsForVolume({
    volume,
    blocks: multiBlocks,
    packageKind: 'solicitation',
  })
  if (multi.length < 2) {
    throw new Error('runDeriveProposalSectionsHarness: expected multiple sections from grouped blocks')
  }
  if (multi.length > SOLICITATION_SECTIONS_MAX) {
    throw new Error('runDeriveProposalSectionsHarness: solicitation cap exceeded')
  }
  if (!multi[0]!.findClauseQuery || multi[0]!.findClauseQuery.length > 500) {
    throw new Error('runDeriveProposalSectionsHarness: findClauseQuery missing or too long')
  }

  const empty = deriveProposalSectionsForVolume({
    volume,
    blocks: [],
    packageKind: 'solicitation',
  })
  if (empty.length !== 1 || empty[0]!.title !== volume.title) {
    throw new Error('runDeriveProposalSectionsHarness: empty blocks should fallback to whole volume')
  }

  const contractVolume: ProposalVolume = {
    id: 'vol-ins',
    title: 'Insurance and bonding',
    requirementSummary: 'Respond to insurance, bonding, and indemnification clauses.',
    status: 'pending',
  }
  const contractText = [
    'Insurance coverage required.',
    'Performance bond required.',
    'Indemnification clause.',
    'Limitation of liability cap.',
    'Termination for convenience.',
    'Governing law Virginia.',
  ].join(' ')
  const contractSections = deriveProposalSectionsForVolume({
    volume: contractVolume,
    blocks: [mockBlock(contractText.repeat(5))],
    packageKind: 'contract_framework',
  })
  if (contractSections.length < 2) {
    throw new Error('runDeriveProposalSectionsHarness: contract keyword scan should yield multiple sections')
  }
  if (contractSections.length > CONTRACT_FRAMEWORK_SECTIONS_MAX) {
    throw new Error('runDeriveProposalSectionsHarness: contract cap exceeded')
  }

  if (!isRejectedProposalSectionTitle('ENTIRE AGREEMENT; INVESTIGATION ............ 3')) {
    throw new Error('runDeriveProposalSectionsHarness: TOC title should be rejected')
  }

  const scopeVolume: ProposalVolume = {
    id: 'vol-scope',
    title: 'Scope and statements of work',
    requirementSummary:
      'Address how services, deliverables, and change control align to the agreement and any SOW templates.',
    status: 'pending',
  }
  const msaBlocks: BlockRecord[] = [
    mockBlock(
      'ENTIRE AGREEMENT; INVESTIGATION; PRIME CONTRACT; DEFINITIONS ............ 3',
      'Document',
    ),
    mockBlock(
      'The Subcontractor shall provide crane, hoist, and scaffolding per Section 2.2.2. '.repeat(8),
      'Insurance › General liability',
    ),
    mockBlock(
      'Statement of work and change control procedures for deliverables under the Prime Contract. '.repeat(
        10,
      ),
      'Scope › Statement of work',
    ),
  ]
  const scopeSections = deriveProposalSectionsForVolume({
    volume: scopeVolume,
    blocks: msaBlocks,
    packageKind: 'contract_framework',
  })
  if (scopeSections.some((section) => isRejectedProposalSectionTitle(section.title))) {
    throw new Error('runDeriveProposalSectionsHarness: scope volume should not keep TOC titles')
  }
  if (scopeSections.length > CONTRACT_FRAMEWORK_INLINE_SECTIONS_MAX + 1) {
    throw new Error('runDeriveProposalSectionsHarness: scope volume should cap inline-derived sections')
  }
}
