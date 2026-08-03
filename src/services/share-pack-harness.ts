import { runIngestHarness } from '@/services/ingest-router'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { runShareTableRegistryHarness } from '@/services/share-pack-duckdb'
import {
  decryptSharePackFile,
  exportEncryptedSharePack,
} from '@/services/share-pack-export'
import { runDrawingMarkupSharePackHarness } from '@/services/drawing-markup-dev-harnesses'
import { applySharePackPayload, runSharePackProposalCompatHarness } from '@/services/share-pack-import'
import { useSessionStore } from '@/store/session-store'

/** Round-trip share pack export/import against harness-ingested workspace. */
export async function runSharePackHarness(): Promise<void> {
  runShareTableRegistryHarness()

  const store = useSessionStore.getState()
  store.resetSession()
  await runIngestHarness()

  const beforeDocCount = useSessionStore.getState().documents.length
  if (beforeDocCount === 0) {
    throw new Error('SharePackHarness: ingest produced no documents')
  }

  const firstDocId = useSessionStore.getState().documents[0]?.doc_id
  if (!firstDocId || !getDocumentBytes(firstDocId)) {
    throw new Error('SharePackHarness: document bytes missing before export')
  }

  const summary = await exportEncryptedSharePack()
  const payload = await decryptSharePackFile(summary.encryptedBytes, summary.keyBase64Url)

  if (payload.documents.length !== beforeDocCount) {
    throw new Error('SharePackHarness: document count mismatch after decrypt')
  }

  store.resetSession()
  await applySharePackPayload(payload)

  const afterDocCount = useSessionStore.getState().documents.length
  if (afterDocCount !== beforeDocCount) {
    throw new Error('SharePackHarness: document count mismatch after import')
  }

  const rehydratedBytes = getDocumentBytes(firstDocId)
  if (!rehydratedBytes) {
    throw new Error('SharePackHarness: document bytes missing after import')
  }

  if (payload.tables.blocks.length === 0) {
    throw new Error('SharePackHarness: expected blocks in share tables')
  }

  await runSharePackProposalCompatHarness()
  await runDrawingMarkupSharePackHarness()
}
