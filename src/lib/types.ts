export type CitationRef = {
  doc_id: string
  block_id: string
  page_num?: number
  bbox?: { x: number; y: number; width: number; height: number }
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

export type RfpResultsProfile = {
  profile_id: string
  doc_id: string
  verdict: RfpVerdict
  subject: { name: string; role?: string; location?: string }
  criteria: CriterionResult[]
  summary: string
}

export type ScopeCreepVerdict = 'aligned' | 'possible_creep' | 'creep'

export type ScopeCreepProfile = {
  profile_id: string
  baseline_doc_id: string
  candidate_doc_id: string
  verdict: ScopeCreepVerdict
  flags: Array<{
    id: string
    type: string
    severity: 'low' | 'medium' | 'high'
    summary: string
    citations: CitationRef[]
  }>
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

export type WorkspaceMode = 'rfp' | 'scope_creep'

export type WorkspaceView = 'landing' | 'profiles' | 'split'
