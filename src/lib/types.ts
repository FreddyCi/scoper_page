/**
 * Core domain types — PRD §9.5, plan §Citation contract, §RFP Results Profiles, §Scope Creep
 */

/** PDF bbox in page coordinates (LiteParse dpi/72 scale at render time) */
export type Bbox = {
  x: number
  y: number
  width: number
  height: number
}

/** Pointer to a document block with optional visual anchor */
export type CitationRef = {
  doc_id: string
  block_id: string
  page_num?: number
  bbox?: Bbox
  excerpt: string
  confidence?: number
}

export type CriterionStatus = 'pass' | 'warn' | 'fail'

export type CriterionResult = {
  id: string
  label: string
  status: CriterionStatus
  detail?: string
  citation?: CitationRef
}

export type RfpVerdict = 'likely' | 'might' | 'unlikely'

/** One qualification card per bidder / response document */
export type RfpResultsProfile = {
  profile_id: string
  source_doc_id: string
  verdict: RfpVerdict
  subject: RfpSubject
  criteria: CriterionResult[]
  summary: string
}

export type RfpSubject = {
  name: string
  role?: string
  location?: string
}

export type ScopeCreepVerdict = 'aligned' | 'possible_creep' | 'creep'

export type ScopeCreepSeverity = 'low' | 'medium' | 'high'

export type ScopeCreepFlag = {
  id: string
  flag_type: string
  severity: ScopeCreepSeverity
  summary: string
  evidence: CitationRef[]
}

/** Cross-document drift profile (baseline vs change request) */
export type ScopeCreepProfile = {
  profile_id: string
  baseline_doc_id: string
  candidate_doc_id: string
  verdict: ScopeCreepVerdict
  flags: ScopeCreepFlag[]
  summary: string
}

export type DocumentRole = 'baseline' | 'change_request' | 'supporting' | 'unknown'

export type DocumentMeta = {
  doc_id: string
  filename: string
  mime: string
  role: DocumentRole
  uploaded_at: string
}

/** Parsed block stored in DuckDB `blocks` table */
export type BlockRecord = {
  block_id: string
  doc_id: string
  page_num?: number
  section_path?: string
  text: string
  x?: number
  y?: number
  width?: number
  height?: number
}

export type CommentRecord = {
  comment_id: string
  block_id: string
  text: string
  created_at: string
}

export type ProfileMode = 'rfp' | 'scope_creep'

/** DuckDB `results_profiles` row (criteria normalized in `profile_criteria`) */
export type ResultsProfileRecord = {
  profile_id: string
  mode: ProfileMode
  doc_id: string
  verdict: string
  subject_json: string
  summary: string
}

export type WorkspaceMode = 'rfp' | 'scope_creep'

export type WorkspaceView = 'landing' | 'profiles' | 'split'

/** Agent tool: find_clause response */
export type FindClauseResult = {
  matches: Array<{
    citation: CitationRef
    relevance: string
  }>
  summary: string
}

/** Step 2 of RFP pipeline — requirements extracted from RFP doc before profiling */
export type RfpRequirement = {
  id: string
  label: string
  category?: string
  citation?: CitationRef
}

export type RfpRequirementsExtract = {
  requirements: RfpRequirement[]
  summary: string
}

export type IngestStatus = 'idle' | 'parsing' | 'done' | 'error'

export type IngestResult = {
  doc_id: string
  filename: string
  mime: string
  block_count: number
  ocr_used: boolean
}

/** Map DuckDB block row → CitationRef (bbox optional for non-PDF) */
export function blockToCitation(
  block: BlockRecord,
  excerptOverride?: string,
): CitationRef {
  const citation: CitationRef = {
    doc_id: block.doc_id,
    block_id: block.block_id,
    excerpt: excerptOverride ?? block.text.slice(0, 280),
  }

  if (block.page_num != null) {
    citation.page_num = block.page_num
  }

  if (
    block.x != null &&
    block.y != null &&
    block.width != null &&
    block.height != null
  ) {
    citation.bbox = {
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
    }
  }

  return citation
}

/** Human-readable verdict labels for UI badges */
export const RFP_VERDICT_LABELS: Record<RfpVerdict, string> = {
  likely: 'Likely qualifies',
  might: 'Might qualify',
  unlikely: 'Does not qualify',
}

export const SCOPE_CREEP_VERDICT_LABELS: Record<ScopeCreepVerdict, string> = {
  aligned: 'Aligned',
  possible_creep: 'Possible creep',
  creep: 'Scope creep',
}
