import { base64ToBytes } from '@/lib/share-crypto'
import type { DocumentMeta, WorkspaceMode } from '@/lib/types'
import type { SharePackPayload } from '@/lib/share-table'
import { SHARE_PACK_VERSION, type ShareTableId, type ShareTableRow } from '@/lib/share-table'
import { cacheDocumentBytes, clearDocumentBytesCache } from '@/services/document-bytes-cache'
import { assertShareTablesShape, importShareTableRows } from '@/services/share-pack-duckdb'
import { decryptSharePackFile } from '@/services/share-pack-export'
import { fetchSharePackBytes } from '@/services/share-pack-link'
import { fetchRfpProfilesFromDuckdb } from '@/services/rfp-profile-store'
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
  if (mode !== 'proposal') return tables

  return {
    ...tables,
    scope_flags: [],
    results_profiles: (tables.results_profiles ?? []).filter(
      (row) => String(row.mode) !== 'scope_creep',
    ),
  }
}

function emptyShareTables(): Record<ShareTableId, ShareTableRow[]> {
  return {
    documents: [],
    blocks: [],
    comments: [],
    results_profiles: [],
    profile_criteria: [],
    scope_flags: [],
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
  const tablesToImport = filterShareTablesForImport(tables, mode)

  getScoperClient().resetConversation()
  hydrateDocumentBytes(payload)
  await importShareTableRows(tablesToImport)

  const documents = documentsFromSharePayload(payload)
  const profiles = mode === 'rfp' ? await fetchRfpProfilesFromDuckdb() : []

  const evaluationBaselineProfile =
    manifest.evaluationBaselineProfileId != null
      ? profiles.find((profile) => profile.profile_id === manifest.evaluationBaselineProfileId) ??
        null
      : null

  writeReviewerNamePreference(manifest.reviewerName)
  writeCompanyContextPreference(manifest.companyContext)

  useSessionStore.setState({
    mode,
    documents,
    profiles,
    creepProfiles: [],
    proposalRequirementsProfile: null,
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
}
