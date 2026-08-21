import {
  base64ToBytes,
  bytesToBase64,
  decryptSharePayload,
  encryptSharePayload,
  exportShareKeyBase64Url,
  generateShareKey,
  gzipCompress,
  gzipDecompress,
  importShareKeyFromBase64Url,
  sha256Hex,
} from '@/lib/share-crypto'
import {
  SHARE_PACK_VERSION,
  SUPPORTED_SHARE_PACK_VERSIONS,
  type ShareDocumentPayload,
  type SharePackExportSummary,
  type SharePackPayload,
  type ShareSessionManifest,
} from '@/lib/share-table'
import { downloadBlob } from '@/lib/download-blob'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { countShareTableRows, exportShareTables, filterShareTablesByDocumentIds } from '@/services/share-pack-duckdb'
import { syncProposalProfileToDuckdb, clearProposalShareTables } from '@/services/proposal-share-store'
import { createShareId, putLocalSharePack } from '@/services/share-pack-storage'
import { buildShareLink, uploadSharePackToApi } from '@/services/share-pack-link'
import { useSessionStore } from '@/store/session-store'

function resolveShareApiUrl(): string | undefined {
  const value = import.meta.env.VITE_SHARE_API_URL
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().replace(/\/$/, '') : undefined
}

function buildManifest(): ShareSessionManifest {
  const state = useSessionStore.getState()

  return {
    version: SHARE_PACK_VERSION,
    exported_at: new Date().toISOString(),
    mode: state.mode,
    evaluationDocId: state.evaluationDocId,
    evaluationBaselineProfileId: state.evaluationBaselineProfile?.profile_id ?? null,
    companyContext: state.companyContext,
    reviewerName: state.reviewerName,
    activeDocId: state.activeDocId,
    workspaceView: state.workspaceView,
    proposalRequirementsProfileId: state.proposalRequirementsProfile?.profile_id ?? null,
  }
}

async function collectDocumentPayloads(): Promise<ShareDocumentPayload[]> {
  const documents = useSessionStore.getState().documents
  const payloads: ShareDocumentPayload[] = []

  for (const document of documents) {
    const bytes = getDocumentBytes(document.doc_id)
    if (!bytes) {
      throw new Error(`Missing source bytes for ${document.filename}. Re-upload before sharing.`)
    }

    payloads.push({
      doc_id: document.doc_id,
      filename: document.filename,
      mime: document.mime,
      sha256: await sha256Hex(bytes),
      data_base64: bytesToBase64(bytes),
    })
  }

  return payloads
}

async function buildSharePackPayload(): Promise<SharePackPayload> {
  const state = useSessionStore.getState()
  await clearProposalShareTables()
  if (state.mode === 'proposal' && state.proposalRequirementsProfile) {
    await syncProposalProfileToDuckdb(state.proposalRequirementsProfile)
  }

  const tables = await exportShareTables()
  const sharedDocIds = new Set(state.documents.map((document) => document.doc_id))
  const scopedTables = filterShareTablesByDocumentIds(tables, sharedDocIds)

  return {
    manifest: buildManifest(),
    tables: scopedTables,
    documents: await collectDocumentPayloads(),
  }
}

async function serializeSharePackPayload(payload: SharePackPayload): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(payload))
  return gzipCompress(json)
}

async function deserializeSharePackPayload(bytes: Uint8Array): Promise<SharePackPayload> {
  const jsonBytes = await gzipDecompress(bytes)
  const parsed = JSON.parse(new TextDecoder().decode(jsonBytes)) as SharePackPayload

  const version = parsed.manifest?.version
  if (!SUPPORTED_SHARE_PACK_VERSIONS.includes(version as (typeof SUPPORTED_SHARE_PACK_VERSIONS)[number])) {
    throw new Error(`Unsupported share pack version: ${String(version)}`)
  }

  return parsed
}

export async function exportEncryptedSharePack(): Promise<SharePackExportSummary> {
  const payload = await buildSharePackPayload()
  const plaintext = await serializeSharePackPayload(payload)
  const key = await generateShareKey()
  const encryptedBytes = await encryptSharePayload(key, plaintext)
  const shareId = createShareId()
  const keyBase64Url = await exportShareKeyBase64Url(key)

  const apiUrl = resolveShareApiUrl()
  if (apiUrl) {
    await uploadSharePackToApi(apiUrl, shareId, encryptedBytes)
  } else {
    await putLocalSharePack(shareId, encryptedBytes)
  }

  return {
    shareId,
    keyBase64Url,
    tableCounts: countShareTableRows(payload.tables),
    documentCount: payload.documents.length,
    encryptedBytes,
  }
}

export async function downloadSharePackFile(summary: SharePackExportSummary): Promise<void> {
  const blob = new Blob([summary.encryptedBytes as BlobPart], {
    type: 'application/octet-stream',
  })
  downloadBlob(blob, `scoper-share-${summary.shareId}.scoper-share`)
}

export async function copyShareLink(summary: SharePackExportSummary): Promise<string> {
  const link = buildShareLink(summary.shareId, summary.keyBase64Url)
  await navigator.clipboard.writeText(link)
  return link
}

export async function decryptSharePackFile(
  encryptedBytes: Uint8Array,
  keyBase64Url: string,
): Promise<SharePackPayload> {
  const key = await importShareKeyFromBase64Url(keyBase64Url)
  const plaintext = await decryptSharePayload(key, encryptedBytes)
  return deserializeSharePackPayload(plaintext)
}

export async function decryptSharePackFromBase64(
  encryptedBase64: string,
  keyBase64Url: string,
): Promise<SharePackPayload> {
  return decryptSharePackFile(base64ToBytes(encryptedBase64), keyBase64Url)
}

export type { SharePackPayload, ShareSessionManifest }
