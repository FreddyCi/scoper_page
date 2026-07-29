import { getLocalSharePack } from '@/services/share-pack-storage'

function resolveShareApiUrl(): string | undefined {
  const value = import.meta.env.VITE_SHARE_API_URL
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().replace(/\/$/, '') : undefined
}

export function buildShareLink(shareId: string, keyBase64Url: string): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  const path = basePath === '' || basePath === '/' ? '' : basePath
  return `${window.location.origin}${path}#share=${shareId},${keyBase64Url}`
}

export function parseShareLinkHash(hash: string): { shareId: string; keyBase64Url: string } | null {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash
  if (!normalized.startsWith('share=')) return null

  const payload = normalized.slice('share='.length)
  const separatorIndex = payload.indexOf(',')
  if (separatorIndex <= 0) return null

  const shareId = payload.slice(0, separatorIndex).trim()
  const keyBase64Url = payload.slice(separatorIndex + 1).trim()
  if (!shareId || !keyBase64Url) return null

  return { shareId, keyBase64Url }
}

export function clearShareLinkHash(): void {
  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState(null, '', url.toString())
}

export async function uploadSharePackToApi(
  apiUrl: string,
  shareId: string,
  encryptedBytes: Uint8Array,
): Promise<void> {
  const response = await fetch(`${apiUrl}/v1/shares/${shareId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: encryptedBytes as BlobPart,
  })

  if (!response.ok) {
    throw new Error(`Share upload failed (${response.status})`)
  }
}

export async function fetchSharePackBytes(shareId: string): Promise<Uint8Array> {
  const apiUrl = resolveShareApiUrl()
  if (apiUrl) {
    const response = await fetch(`${apiUrl}/v1/shares/${shareId}`)
    if (!response.ok) {
      throw new Error(`Share download failed (${response.status})`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }

  const local = await getLocalSharePack(shareId)
  if (!local) {
    throw new Error(
      'Share pack not found. Ask the sender for the .scoper-share file or configure VITE_SHARE_API_URL.',
    )
  }

  return local
}

export function readShareLinkFromLocation(): { shareId: string; keyBase64Url: string } | null {
  return parseShareLinkHash(window.location.hash)
}
