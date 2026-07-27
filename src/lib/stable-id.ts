/** Stable document id from file bytes (SHA-256 prefix). */
export async function stableDocIdFromBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `doc-${hex.slice(0, 16)}`
}

export async function stableDocIdFromFile(file: File): Promise<string> {
  return stableDocIdFromBytes(await file.arrayBuffer())
}
