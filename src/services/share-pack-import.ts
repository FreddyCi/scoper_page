import { base64ToBytes } from '@/lib/share-crypto'
import type { DocumentMeta, ProposalRequirementsProfile, WorkspaceMode } from '@/lib/types'
import type { SharePackPayload, ShareSessionManifest } from '@/lib/share-table'
import { SHARE_PACK_VERSION, type ShareTableId, type ShareTableRow } from '@/lib/share-table'
import { cacheDocumentBytes, clearDocumentBytesCache } from '@/services/document-bytes-cache'
import { assertShareTablesShape, filterShareTablesByDocumentIds, importShareTableRows } from '@/services/share-pack-duckdb'
import { getDuckdbClient } from '@/services/duckdb-client'
import {
  fetchPdfDrawingAnnotationsForDoc,
  insertPdfDrawingAnnotation,
} from '@/services/pdf-drawing-annotations'
import { decryptSharePackFile, exportEncryptedSharePack } from '@/services/share-pack-export'
import { runIngestHarness } from '@/services/ingest-router'
import { fetchSharePackBytes } from '@/services/share-pack-link'
import { proposalProfileFromShareRows } from '@/services/proposal-share-store'
import { fetchRfpProfilesFromDuckdb } from '@/services/rfp-profile-store'
import {
  fetchRfpRequirementScoresForDoc,
  fetchRfpRequirementsForDoc,
} from '@/services/rfp-requirements'
import { fetchRfpInstructionsForDoc } from '@/services/rfp-solicitation-meta'
import { getScoperClient } from '@/services/scoper-client'
import { clearAgentActivityState } from '@/lib/agent-activity'
import { useSessionStore } from '@/store/session-store'

import { writeReviewerNamePreference } from '@/lib/reviewer-profile'

const COMPANY_CONTEXT_STORAGE_KEY = 'bda-company-context'

function writeCompanyContextPreference(value: string) {
  try {
    sessionStorage.setItem(COMPANY_CONTEXT_STORAGE_KEY, value)
  } catch {
    // sessionStorage unavailable
  }
}

function normalizeSharePackMode(mode: string): WorkspaceMode {
  if (mode === 'scope_creep') return 'proposal'
  if (mode === 'rfp' || mode === 'proposal') return mode
  return 'rfp'
}

/** Drop scope-creep DuckDB payloads when opening a proposal workspace (BDA-142). */
function filterShareTablesForImport(
  tables: Record<ShareTableId, ShareTableRow[]>,
  mode: WorkspaceMode,
): Record<ShareTableId, ShareTableRow[]> {
  if (mode === 'proposal') {
    return {
      ...tables,
      scope_flags: [],
      results_profiles: (tables.results_profiles ?? []).filter(
        (row) => String(row.mode) !== 'scope_creep',
      ),
    }
  }

  return {
    ...tables,
    proposal_profiles: [],
    proposal_volumes: [],
    proposal_volume_sections: [],
  }
}

function resolveProposalRequirementsProfile(
  tables: Record<ShareTableId, ShareTableRow[]>,
  manifest: ShareSessionManifest,
  mode: WorkspaceMode,
): ProposalRequirementsProfile | null {
  if (mode !== 'proposal') {
    return null
  }

  const profileRows = tables.proposal_profiles ?? []
  if (profileRows.length === 0) {
    return null
  }

  const profileId =
    manifest.proposalRequirementsProfileId ??
    (profileRows.length === 1 ? String(profileRows[0]!.profile_id) : null)

  if (!profileId) {
    return null
  }

  return proposalProfileFromShareRows(
    {
      proposal_profiles: profileRows,
      proposal_volumes: tables.proposal_volumes ?? [],
      proposal_volume_sections: tables.proposal_volume_sections ?? [],
    },
    profileId,
  )
}

function emptyShareTables(): Record<ShareTableId, ShareTableRow[]> {
  return {
    documents: [],
    blocks: [],
    comments: [],
    pdf_drawing_annotations: [],
    results_profiles: [],
    profile_criteria: [],
    scope_flags: [],
    proposal_profiles: [],
    proposal_volumes: [],
    proposal_volume_sections: [],
    rfp_requirements: [],
    rfp_requirement_scores: [],
    rfp_solicitation_meta: [],
  }
}

function documentsFromSharePayload(payload: SharePackPayload): DocumentMeta[] {
  const rows = payload.tables.documents ?? []
  return rows.map((row) => ({
    doc_id: String(row.doc_id),
    filename: String(row.filename),
    mime: String(row.mime),
    role: row.role as DocumentMeta['role'],
    uploaded_at: String(row.uploaded_at),
  }))
}

function hydrateDocumentBytes(payload: SharePackPayload): void {
  clearDocumentBytesCache()

  for (const document of payload.documents) {
    cacheDocumentBytes(document.doc_id, base64ToBytes(document.data_base64))
  }
}

export async function applySharePackPayload(payload: SharePackPayload): Promise<void> {
  const tables = assertShareTablesShape(payload.tables)
  const manifest = payload.manifest
  const mode = normalizeSharePackMode(String(manifest.mode))
  const sharedDocIds = new Set(payload.documents.map((document) => document.doc_id))
  const scopedTables = filterShareTablesByDocumentIds(tables, sharedDocIds)
  const tablesToImport = filterShareTablesForImport(scopedTables, mode)

  getScoperClient().resetConversation()
  hydrateDocumentBytes(payload)
  await importShareTableRows(tablesToImport)

  const documents = documentsFromSharePayload(payload)
  const profiles = mode === 'rfp' ? await fetchRfpProfilesFromDuckdb() : []

  const evaluationDocId = manifest.evaluationDocId
  const rfpRequirements =
    mode === 'rfp' && evaluationDocId
      ? await fetchRfpRequirementsForDoc(evaluationDocId)
      : []
  const rfpRequirementScores =
    mode === 'rfp' && evaluationDocId
      ? await fetchRfpRequirementScoresForDoc(evaluationDocId)
      : []
  const rfpInstructionsProfile =
    mode === 'rfp' && evaluationDocId
      ? await fetchRfpInstructionsForDoc(evaluationDocId)
      : null

  const evaluationBaselineProfile =
    manifest.evaluationBaselineProfileId != null
      ? profiles.find((profile) => profile.profile_id === manifest.evaluationBaselineProfileId) ??
        null
      : null

  const proposalRequirementsProfile = resolveProposalRequirementsProfile(
    tablesToImport,
    manifest,
    mode,
  )

  writeReviewerNamePreference(manifest.reviewerName)
  writeCompanyContextPreference(manifest.companyContext)

  useSessionStore.setState({
    mode,
    documents,
    profiles,
    creepProfiles: [],
    proposalRequirementsProfile,
    rfpRequirements,
    rfpRequirementScores,
    rfpInstructionsProfile,
    proposalHandoffState: null,
    proposalGenerating: false,
    proposalGenerationError: null,
    evaluationDocId: manifest.evaluationDocId,
    evaluationBaselineProfile,
    companyContext: manifest.companyContext,
    reviewerName: manifest.reviewerName,
    activeDocId: manifest.activeDocId ?? documents[0]?.doc_id ?? null,
    workspaceView: documents.length > 0 ? manifest.workspaceView : 'landing',
    selectedCitation: null,
    citationFocusSeq: 0,
    chatMessages: [],
    chatThreads: [],
    chatFocusMessageId: null,
    chatContextAttachments: [],
    chatGenerating: false,
    chatModelStatus: 'idle',
    uploadPopupOpen: false,
    ...clearAgentActivityState(),
  })
}

export async function importSharePackFromEncryptedBytes(
  encryptedBytes: Uint8Array,
  keyBase64Url: string,
): Promise<SharePackPayload> {
  const payload = await decryptSharePackFile(encryptedBytes, keyBase64Url)
  await applySharePackPayload(payload)
  return payload
}

export async function importSharePackFromLink(
  shareId: string,
  keyBase64Url: string,
): Promise<SharePackPayload> {
  const encryptedBytes = await fetchSharePackBytes(shareId)
  return importSharePackFromEncryptedBytes(encryptedBytes, keyBase64Url)
}

export async function importSharePackFromFile(
  file: File,
  keyBase64Url: string,
): Promise<SharePackPayload> {
  const encryptedBytes = new Uint8Array(await file.arrayBuffer())
  return importSharePackFromEncryptedBytes(encryptedBytes, keyBase64Url)
}

/** Dev harness — legacy `scope_creep` manifests and proposal import (BDA-142). */
export async function runSharePackProposalCompatHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()

  const tables = emptyShareTables()
  tables.scope_flags = [
    {
      flag_id: 'legacy-flag',
      baseline_doc_id: 'base',
      candidate_doc_id: 'cand',
      flag_type: 'extra_work',
      severity: 'high',
      summary: 'Should not surface in proposal mode',
      block_ids: '[]',
    },
  ]
  tables.results_profiles = [
    {
      profile_id: 'creep-profile',
      mode: 'scope_creep',
      doc_id: 'cand',
      verdict: 'warn',
      subject_json: '{}',
      summary: 'Legacy creep profile',
    },
  ]

  const legacyPayload: SharePackPayload = {
    manifest: {
      version: SHARE_PACK_VERSION,
      exported_at: new Date().toISOString(),
      mode: 'scope_creep',
      evaluationDocId: null,
      evaluationBaselineProfileId: null,
      companyContext: 'Legacy responder context for harness.',
      reviewerName: 'Harness',
      activeDocId: null,
      workspaceView: 'profiles',
      proposalRequirementsProfileId: null,
    },
    tables,
    documents: [],
  }

  await applySharePackPayload(legacyPayload)

  let state = useSessionStore.getState()
  if (state.mode !== 'proposal') {
    throw new Error('runSharePackProposalCompatHarness: scope_creep manifest should map to proposal')
  }
  if (state.proposalRequirementsProfile != null) {
    throw new Error('runSharePackProposalCompatHarness: expected empty proposal profile')
  }
  if (state.creepProfiles.length !== 0) {
    throw new Error('runSharePackProposalCompatHarness: creep profiles should stay empty')
  }

  const proposalPayload: SharePackPayload = {
    ...legacyPayload,
    manifest: {
      ...legacyPayload.manifest,
      mode: 'proposal',
      companyContext: 'Explicit proposal manifest context.',
    },
  }

  store.resetSession()
  await applySharePackPayload(proposalPayload)

  state = useSessionStore.getState()
  if (state.mode !== 'proposal') {
    throw new Error('runSharePackProposalCompatHarness: proposal manifest should import')
  }
  if (state.companyContext !== 'Explicit proposal manifest context.') {
    throw new Error('runSharePackProposalCompatHarness: manifest context mismatch')
  }

  const proposalProfileId = 'share-import-prof'
  tables.proposal_profiles = [
    {
      profile_id: proposalProfileId,
      rfp_doc_id: 'rfp-harness',
      summary: 'Imported proposal profile.',
      built_at: new Date().toISOString(),
      package_kind: 'solicitation',
      package_warnings_json: '[]',
    },
  ]
  tables.proposal_volumes = [
    {
      profile_id: proposalProfileId,
      volume_id: 'vol-draft',
      title: 'Technical approach',
      requirement_summary: 'Methodology.',
      solicitation_refs_json: null,
      body_markdown: '## Approach\n\nImported draft body.',
      status: 'draft',
      error_message: null,
      edited: 1,
      edited_at: '2026-02-01T12:00:00.000Z',
      generation_progress_json: null,
      analysis_refs_json: null,
    },
    {
      profile_id: proposalProfileId,
      volume_id: 'vol-pending',
      title: 'Management plan',
      requirement_summary: 'Staffing.',
      solicitation_refs_json: null,
      body_markdown: null,
      status: 'pending',
      error_message: null,
      edited: 0,
      edited_at: null,
      generation_progress_json: null,
      analysis_refs_json: null,
    },
  ]
  tables.proposal_volume_sections = []

  const proposalWithProfilePayload: SharePackPayload = {
    ...proposalPayload,
    tables,
    manifest: {
      ...proposalPayload.manifest,
      proposalRequirementsProfileId: proposalProfileId,
    },
  }

  store.resetSession()
  await applySharePackPayload(proposalWithProfilePayload)

  state = useSessionStore.getState()
  if (state.proposalRequirementsProfile?.profile_id !== proposalProfileId) {
    throw new Error('runSharePackProposalCompatHarness: expected proposal profile from share tables')
  }
  const draftVolume = state.proposalRequirementsProfile.volumes.find((v) => v.id === 'vol-draft')
  const pendingVolume = state.proposalRequirementsProfile.volumes.find((v) => v.id === 'vol-pending')
  if (draftVolume?.status !== 'draft' || !draftVolume.edited) {
    throw new Error('runSharePackProposalCompatHarness: draft volume status/edited not restored')
  }
  if (pendingVolume?.status !== 'pending') {
    throw new Error('runSharePackProposalCompatHarness: pending volume status not restored')
  }
}

/** Dev harness — pdf drawing annotations round-trip in share pack (BDA-236). */
export async function runSharePackDrawingAnnotationsHarness(): Promise<void> {
  useSessionStore.getState().resetSession()
  await runIngestHarness()

  const docId = useSessionStore.getState().documents[0]?.doc_id
  if (!docId) {
    throw new Error('runSharePackDrawingAnnotationsHarness: missing ingested document')
  }

  const duckdb = await getDuckdbClient()
  const orphanDocId = 'share-pack-orphan-drawing-doc'
  await duckdb.query(
    `INSERT OR REPLACE INTO documents (doc_id, filename, mime, role, uploaded_at)
     VALUES (?, ?, ?, ?, ?)`,
    [orphanDocId, 'orphan.pdf', 'application/pdf', 'unknown', new Date().toISOString()],
  )

  const voiceNoteText = 'North elevation window verification'
  await insertPdfDrawingAnnotation({
    doc_id: docId,
    page_num: 1,
    tool: 'stamp',
    color: '#0EA5E9',
    stroke_width: 2,
    geometry: { kind: 'stamp', x: 0.2, y: 0.3, stampKind: 'window' },
    voice_note: voiceNoteText,
  })
  await insertPdfDrawingAnnotation({
    doc_id: docId,
    page_num: 2,
    tool: 'text',
    color: '#18181B',
    geometry: { kind: 'text', x: 0.4, y: 0.5 },
    text_body: 'W-12',
  })
  await insertPdfDrawingAnnotation({
    doc_id: orphanDocId,
    page_num: 1,
    tool: 'pen',
    color: '#E11D48',
    stroke_width: 4,
    geometry: { kind: 'stroke', points: [{ x: 0.1, y: 0.1 }] },
  })

  const summary = await exportEncryptedSharePack()
  const payload = await decryptSharePackFile(summary.encryptedBytes, summary.keyBase64Url)

  const exportedMarks = payload.tables.pdf_drawing_annotations ?? []
  if (exportedMarks.length !== 2) {
    throw new Error('runSharePackDrawingAnnotationsHarness: expected two exported annotations')
  }
  if (exportedMarks.some((row) => String(row.doc_id) === orphanDocId)) {
    throw new Error('runSharePackDrawingAnnotationsHarness: orphan doc annotations must be excluded')
  }
  if (!exportedMarks.some((row) => String(row.voice_note) === voiceNoteText)) {
    throw new Error('runSharePackDrawingAnnotationsHarness: voice_note not exported')
  }

  useSessionStore.getState().resetSession()
  await applySharePackPayload(payload)

  const imported = await fetchPdfDrawingAnnotationsForDoc(docId)
  if (imported.length !== 2) {
    throw new Error('runSharePackDrawingAnnotationsHarness: imported annotation count mismatch')
  }
  if (!imported.some((row) => row.text_body === 'W-12')) {
    throw new Error('runSharePackDrawingAnnotationsHarness: text label not restored')
  }
  if (!imported.some((row) => row.voice_note === voiceNoteText)) {
    throw new Error('runSharePackDrawingAnnotationsHarness: voice_note not restored')
  }

  const orphanRemaining = await fetchPdfDrawingAnnotationsForDoc(orphanDocId)
  if (orphanRemaining.length !== 0) {
    throw new Error('runSharePackDrawingAnnotationsHarness: orphan annotations should not import')
  }

  await duckdb.query('DELETE FROM pdf_drawing_annotations WHERE doc_id = ?', [orphanDocId])
  await duckdb.query('DELETE FROM documents WHERE doc_id = ?', [orphanDocId])
}

/** Dev harness — v4 RFP matrix + instructions round-trip; v3 packs still import (BDA-273). */
export async function runSharePackRfpComplianceHarness(): Promise<void> {
  useSessionStore.getState().resetSession()
  await runIngestHarness()

  const docId = useSessionStore.getState().documents[0]?.doc_id
  if (!docId) {
    throw new Error('runSharePackRfpComplianceHarness: missing ingested document')
  }

  const requirementId = 'share-pack-req-harness'
  const profileId = 'share-pack-profile-harness'
  const label = 'The Contractor shall provide weekly status reports.'
  const dueValue = 'Proposals due March 15, 2026 for share harness'

  const duckdb = await getDuckdbClient()
  await duckdb.query(
    `INSERT OR REPLACE INTO results_profiles
       (profile_id, mode, doc_id, verdict, subject_json, summary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [profileId, 'rfp', docId, 'likely', '{"name":"Harness Bidder"}', 'Share pack bidder'],
  )
  await duckdb.query(
    `INSERT OR REPLACE INTO rfp_requirements
       (requirement_id, doc_id, label, category, block_id, page_num, excerpt, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      requirementId,
      docId,
      label,
      null,
      null,
      3,
      label,
      new Date().toISOString(),
    ],
  )
  await duckdb.query(
    `INSERT OR REPLACE INTO rfp_requirement_scores
       (requirement_id, profile_id, status, note, source)
     VALUES (?, ?, ?, ?, ?)`,
    [requirementId, profileId, 'partial', 'Needs review', 'user'],
  )
  await duckdb.query(
    `INSERT OR REPLACE INTO rfp_solicitation_meta
       (doc_id, due_json, questions_due_json, page_limit_json, volumes_json, block_ids_json, summary, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      docId,
      JSON.stringify({ label: 'Due date', value: dueValue }),
      null,
      null,
      '[]',
      '[]',
      'Harness instructions summary',
      new Date().toISOString(),
    ],
  )

  useSessionStore.setState({
    mode: 'rfp',
    evaluationDocId: docId,
  })

  const summary = await exportEncryptedSharePack()
  const payload = await decryptSharePackFile(summary.encryptedBytes, summary.keyBase64Url)

  if (payload.manifest.version !== SHARE_PACK_VERSION) {
    throw new Error('runSharePackRfpComplianceHarness: export should use latest share pack version')
  }
  if ((payload.tables.rfp_requirements ?? []).length !== 1) {
    throw new Error('runSharePackRfpComplianceHarness: expected exported requirement row')
  }
  if ((payload.tables.rfp_requirement_scores ?? []).length !== 1) {
    throw new Error('runSharePackRfpComplianceHarness: expected exported score row')
  }
  if ((payload.tables.rfp_solicitation_meta ?? []).length !== 1) {
    throw new Error('runSharePackRfpComplianceHarness: expected exported solicitation meta row')
  }

  useSessionStore.getState().resetSession()
  await applySharePackPayload(payload)

  let state = useSessionStore.getState()
  if (state.rfpRequirements.length !== 1 || !state.rfpRequirements[0]?.label.includes('weekly')) {
    throw new Error('runSharePackRfpComplianceHarness: requirements not restored to session')
  }
  if (state.rfpRequirementScores.length !== 1 || state.rfpRequirementScores[0]?.status !== 'partial') {
    throw new Error('runSharePackRfpComplianceHarness: scores not restored to session')
  }
  if (!state.rfpInstructionsProfile?.dueDate?.value.includes('March 15')) {
    throw new Error('runSharePackRfpComplianceHarness: instructions profile not restored')
  }

  const v3Tables = { ...payload.tables } as Record<string, ShareTableRow[] | undefined>
  delete v3Tables.rfp_requirements
  delete v3Tables.rfp_requirement_scores
  delete v3Tables.rfp_solicitation_meta

  const v3Payload: SharePackPayload = {
    manifest: {
      ...payload.manifest,
      version: 3,
    },
    tables: v3Tables as SharePackPayload['tables'],
    documents: payload.documents,
  }

  useSessionStore.getState().resetSession()
  await applySharePackPayload(v3Payload)

  state = useSessionStore.getState()
  if (state.documents.length !== payload.documents.length) {
    throw new Error('runSharePackRfpComplianceHarness: v3 pack document import failed')
  }
  if (state.rfpRequirements.length !== 0 || state.rfpRequirementScores.length !== 0) {
    throw new Error('runSharePackRfpComplianceHarness: v3 pack should import with empty matrix state')
  }

  await duckdb.query('DELETE FROM rfp_requirement_scores WHERE requirement_id = ?', [requirementId])
  await duckdb.query('DELETE FROM rfp_requirements WHERE requirement_id = ?', [requirementId])
  await duckdb.query('DELETE FROM rfp_solicitation_meta WHERE doc_id = ?', [docId])
  await duckdb.query('DELETE FROM results_profiles WHERE profile_id = ?', [profileId])
}
