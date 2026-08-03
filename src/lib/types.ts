/**
 * Core domain types — PRD §9.5, plan §Citation contract, §RFP Results Profiles, §Scope Creep, §Proposal volumes
 */

import type { ProposalPackageKind } from '@/lib/proposal-package-classifier'

export type { ProposalPackageKind } from '@/lib/proposal-package-classifier'

/** PDF bbox in page coordinates — LiteParse top-left origin, PDF points */
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

export type ProposalVolumeStatus = 'pending' | 'generating' | 'draft' | 'error'

export type ProposalVolumeSectionStatus = ProposalVolumeStatus

/** One sectional draft unit within a proposal volume (sectional ECP pipeline). */
export type ProposalVolumeSection = {
  id: string
  title: string
  /** Compact query for ECP `@demo/document.find_clause`. */
  findClauseQuery: string
  status: ProposalVolumeSectionStatus
  bodyMarkdown?: string
  errorMessage?: string
  /** True when the user saved hand-edited markdown (BDA-203). */
  edited?: boolean
  /** ISO timestamp of the last hand-edit save. */
  editedAt?: string
  /** ECP find_clause matches used while drafting this section (BDA-212). */
  citations?: CitationRef[]
}

/** Per-volume sectional progress for proposal panel UI (BDA-160). */
export type ProposalVolumeGenerationProgress = {
  completedSections: number
  totalSections: number
  /** Section id currently generating, if any. */
  activeSectionId?: string
}

/** RFP Analysis criterion linked to a proposal volume (BDA-207). */
export type ProposalAnalysisRef = {
  criterionId: string
  label: string
  status: CriterionStatus
  citation?: CitationRef
}

/** One solicitation-aligned volume in a complete proposal draft */
export type ProposalVolume = {
  id: string
  title: string
  requirementSummary: string
  solicitationRefs?: string[]
  bodyMarkdown?: string
  status: ProposalVolumeStatus
  /** Set when status is error */
  errorMessage?: string
  /** Populated when sectional generation is enabled (BDA-161+). */
  sections?: ProposalVolumeSection[]
  generationProgress?: ProposalVolumeGenerationProgress
  /** True when the user saved hand-edited volume markdown (BDA-203). */
  edited?: boolean
  /** ISO timestamp of the last hand-edit save. */
  editedAt?: string
  /** Criteria from RFP Analysis mapped to this volume (BDA-207). */
  analysisRefs?: ProposalAnalysisRef[]
}

/** RFP-derived outline used to generate responder proposal volumes */
export type ProposalRequirementsProfile = {
  profile_id: string
  rfp_doc_id: string
  volumes: ProposalVolume[]
  summary: string
  built_at: string
  /** Classified solicitation vs contract/MSA (BDA-159). */
  packageKind: ProposalPackageKind
  packageWarnings: string[]
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
  author_initials: string
  created_at: string
}

/** Point in normalized page space (0–1), top-left origin, PDF media box at scale 1 (BDA-220). */
export type PdfDrawingNormalizedPoint = {
  x: number
  y: number
}

/** Ink and shape tools for plan-sheet markup (drawing PDF markup). */
export type PdfDrawingTool =
  | 'pen'
  | 'highlighter'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'stamp'

/** UI mark tools including eraser (not stored on annotation rows). */
export type PdfMarkSessionTool = PdfDrawingTool | 'eraser' | 'hand' | 'select'

/** Stamp variants; v1 supports window locations on floor plans. */
export type PdfDrawingStampKind = 'window'

export type PdfDrawingStrokeGeometry = {
  kind: 'stroke'
  points: PdfDrawingNormalizedPoint[]
}

export type PdfDrawingRectGeometry = {
  kind: 'rect'
  x: number
  y: number
  width: number
  height: number
}

export type PdfDrawingEllipseGeometry = {
  kind: 'ellipse'
  x: number
  y: number
  width: number
  height: number
}

export type PdfDrawingTextGeometry = {
  kind: 'text'
  x: number
  y: number
}

export type PdfDrawingStampGeometry = {
  kind: 'stamp'
  x: number
  y: number
  stampKind: PdfDrawingStampKind
  /** Normalized size as fraction of page width; render default if omitted. */
  size?: number
}

/** Tool-specific geometry stored in DuckDB `geometry_json` (discriminated by `kind`). */
export type PdfDrawingGeometry =
  | PdfDrawingStrokeGeometry
  | PdfDrawingRectGeometry
  | PdfDrawingEllipseGeometry
  | PdfDrawingTextGeometry
  | PdfDrawingStampGeometry

/** User-drawn markup on a PDF page (persisted in `pdf_drawing_annotations`). */
export type PdfDrawingAnnotation = {
  annotation_id: string
  doc_id: string
  page_num: number
  tool: PdfDrawingTool
  color: string
  stroke_width?: number
  opacity?: number
  geometry: PdfDrawingGeometry
  text_body?: string
  author_initials: string
  created_at: string
  updated_at?: string
}

/** DuckDB row shape — geometry serialized in `geometry_json` (BDA-221). */
export type PdfDrawingAnnotationRecord = {
  annotation_id: string
  doc_id: string
  page_num: number
  tool: PdfDrawingTool
  color: string
  stroke_width?: number
  opacity?: number
  geometry_json: string
  text_body?: string
  author_initials: string
  created_at: string
  updated_at?: string
}

export type ProfileMode = 'rfp' | 'proposal'

/** DuckDB `results_profiles` row (criteria normalized in `profile_criteria`) */
export type ResultsProfileRecord = {
  profile_id: string
  mode: ProfileMode
  doc_id: string
  verdict: string
  subject_json: string
  summary: string
}

export type WorkspaceMode = 'rfp' | 'proposal'

export type WorkspaceView = 'landing' | 'profiles' | 'split'

export type ChatMessageRole = 'user' | 'assistant'

export type ChatActionStatus = 'pending' | 'editing' | 'approved' | 'dismissed'

export type ChatActionKind = 'draft' | 'update' | 'analyze'

export type ChatContextAttachmentKind = 'document' | 'block'

/** PDF / passage context attached to a chat turn */
export type ChatContextAttachment = {
  id: string
  kind: ChatContextAttachmentKind
  docId: string
  blockId?: string
  label: string
  description?: string
  excerpt?: string
  pageNum?: number
}

/** Agent-suggested task row with live-edit + approve/dismiss controls */
export type ChatActionProposal = {
  id: string
  kind: ChatActionKind
  title: string
  subtitle: string
  status: ChatActionStatus
}

/** Embedded evidence card inside an assistant turn */
export type ChatCitationCard = {
  id: string
  citation: CitationRef
  body: string
  highlight: string
  sourceLabel: string
  sourceMeta?: string
}

export type AssistantChatContent = {
  headline?: string
  paragraphs: string[]
  /** Compact inline chips — click opens split view highlight (BDA-034) */
  citationChips?: CitationRef[]
  citations?: ChatCitationCard[]
  actionsIntro?: string
  actions?: ChatActionProposal[]
}

export type ChatMessage = {
  id: string
  role: ChatMessageRole
  text: string
  rich?: AssistantChatContent
  contextAttachments?: ChatContextAttachment[]
  /** True while Scoper tokens are streaming into this assistant turn */
  streaming?: boolean
  created_at: string
}

export type ChatSidebarTab = 'agent' | 'history'

/** Archived chat thread — saved when starting a new conversation */
export type ChatThread = {
  id: string
  title: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

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
  role?: DocumentRole
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
