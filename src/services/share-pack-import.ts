import { base64ToBytes } from '@/lib/share-crypto'
import type { DocumentMeta } from '@/lib/types'
import type { SharePackPayload } from '@/lib/share-table'
import { cacheDocumentBytes, clearDocumentBytesCache } from '@/services/document-bytes-cache'
import { assertShareTablesShape, importShareTableRows } from '@/services/share-pack-duckdb'
import { decryptSharePackFile } from '@/services/share-pack-export'
import { fetchSharePackBytes } from '@/services/share-pack-link'
import { fetchRfpProfilesFromDuckdb } from '@/services/rfp-profile-store'
import { fetchScopeCreepProfiles } from '@/services/scope-creep-store'
import { getScoperClient } from '@/services/scoper-client'
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

  getScoperClient().resetConversation()
  hydrateDocumentBytes(payload)
  await importShareTableRows(tables)

  const documents = documentsFromSharePayload(payload)
  const profiles = manifest.mode === 'rfp' ? await fetchRfpProfilesFromDuckdb() : []
  const creepProfiles =
    manifest.mode === 'scope_creep' ? await fetchScopeCreepProfiles() : []

  const evaluationBaselineProfile =
    manifest.evaluationBaselineProfileId != null
      ? profiles.find((profile) => profile.profile_id === manifest.evaluationBaselineProfileId) ??
        null
      : null

  writeReviewerNamePreference(manifest.reviewerName)
  writeCompanyContextPreference(manifest.companyContext)

  useSessionStore.setState({
    mode: manifest.mode,
    documents,
    profiles,
    creepProfiles,
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
