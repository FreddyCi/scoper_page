/**
 * `data-scout-target` registry — single source of truth for spotlight anchors (BDA-278).
 * Instrument UI with `data-scout-target={SCOUT_TARGETS.evalPanel}` or `scoutTargetProps(...)`.
 */
export const SCOUT_TARGETS = {
  /** Landing — journey picker cards */
  landingJourneyPicker: 'landing-journey-picker',
  /** Landing — upload my own / quick action row */
  quickActions: 'quick-actions',
  /** Header / FAB — upload documents */
  uploadFab: 'upload-fab',
  /** Header — reopen Scout panel */
  scoutLauncher: 'scout-launcher',

  /** RFP evaluation — right panel setup + qualify */
  evalPanel: 'eval-panel',
  /** RFP evaluation — run qualification control */
  evalRunQualify: 'eval-run-qualify',
  /** Profiles grid — bidder cards area */
  resultsProfileGrid: 'results-profile-grid',
  /** First qualification card / criterion row */
  firstProfileCriterion: 'first-profile-criterion',

  /** Compliance matrix table */
  complianceMatrix: 'compliance-matrix',
  /** Matrix CSV export button */
  matrixCsvExport: 'matrix-csv-export',
  /** Solicitation instructions card */
  instructionsCard: 'instructions-card',

  /** Share workspace sheet — export session */
  shareWorkspaceExport: 'share-workspace-export',
  /** Split view — export menu trigger */
  splitExportMenu: 'split-export-menu',

  /** Proposal mode — generation panel root */
  proposalSetupPanel: 'proposal-setup-panel',
  /** Proposal — company profile onboarding CTA / questionnaire entry */
  companyProfileSetup: 'company-profile-setup',
  /** Proposal — company / responder context field */
  proposalCompanyContext: 'proposal-company-context',
  /** Proposal — build requirements profile */
  proposalBuildProfile: 'proposal-build-profile',
  /** Proposal — generate single volume */
  proposalGenerateVolume: 'proposal-generate-volume',
  /** Proposal — export markdown */
  proposalExportMarkdown: 'proposal-export-markdown',

  /** PDF mark — toolbar / mode toggle region */
  markToolbar: 'mark-toolbar',
  /** PDF mark — window stamp tool */
  markStampTool: 'mark-stamp-tool',
  /** Split footer — takeoff sheet pill */
  takeoffFooterPill: 'takeoff-footer-pill',
  /** Takeoff panel / sheet content */
  takeoffPanel: 'takeoff-panel',
  /** Takeoff CSV export control */
  takeoffCsvExport: 'takeoff-csv-export',
} as const

export type ScoutTargetId = (typeof SCOUT_TARGETS)[keyof typeof SCOUT_TARGETS]

export const SCOUT_TARGET_IDS: readonly ScoutTargetId[] = Object.values(SCOUT_TARGETS)

export function isScoutTargetId(value: unknown): value is ScoutTargetId {
  return typeof value === 'string' && (SCOUT_TARGET_IDS as readonly string[]).includes(value)
}

/** React prop helper for instrumentation sites. */
export function scoutTargetProps(target: ScoutTargetId): { 'data-scout-target': ScoutTargetId } {
  return { 'data-scout-target': target }
}

/** DOM query helper for ScoutSpotlight (BDA-288). */
export function queryScoutTarget(target: ScoutTargetId): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(`[data-scout-target="${target}"]`)
}
