/** In-memory PDF bytes keyed by stable doc_id — populated during ingest for viewer preview. */
const cache = new Map<string, Uint8Array>()

export function cacheDocumentBytes(docId: string, bytes: Uint8Array): void {
  cache.set(docId, bytes)
}

export function getDocumentBytes(docId: string): Uint8Array | undefined {
  return cache.get(docId)
}

export function removeDocumentBytes(docId: string): void {
  cache.delete(docId)
}

export function clearDocumentBytesCache(): void {
  cache.clear()
}
