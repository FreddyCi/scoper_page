const SHARE_MAGIC = new TextEncoder().encode('SCPSHR1')
const IV_LENGTH = 12

export type ShareCryptoKey = CryptoKey

export async function generateShareKey(): Promise<ShareCryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportShareKeyBase64Url(key: ShareCryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  return bytesToBase64Url(raw)
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export async function importShareKeyFromBase64Url(keyBase64Url: string): Promise<ShareCryptoKey> {
  const raw = base64UrlToBytes(keyBase64Url)
  if (raw.byteLength !== 32) {
    throw new Error('Share key must be 256 bits')
  }

  return crypto.subtle.importKey('raw', toBufferSource(raw), { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encryptSharePayload(
  key: ShareCryptoKey,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, toBufferSource(plaintext)),
  )

  const output = new Uint8Array(SHARE_MAGIC.length + IV_LENGTH + ciphertext.length)
  output.set(SHARE_MAGIC, 0)
  output.set(iv, SHARE_MAGIC.length)
  output.set(ciphertext, SHARE_MAGIC.length + IV_LENGTH)
  return output
}

export async function decryptSharePayload(
  key: ShareCryptoKey,
  encrypted: Uint8Array,
): Promise<Uint8Array> {
  if (encrypted.length < SHARE_MAGIC.length + IV_LENGTH + 16) {
    throw new Error('Share pack file is too small')
  }

  for (let index = 0; index < SHARE_MAGIC.length; index += 1) {
    if (encrypted[index] !== SHARE_MAGIC[index]) {
      throw new Error('Unrecognized share pack format')
    }
  }

  const iv = new Uint8Array(encrypted.subarray(SHARE_MAGIC.length, SHARE_MAGIC.length + IV_LENGTH))
  const ciphertext = new Uint8Array(
    encrypted.subarray(SHARE_MAGIC.length + IV_LENGTH),
  )

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    toBufferSource(ciphertext),
  )
  return new Uint8Array(plaintext)
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toBufferSource(bytes))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function base64UrlToBytes(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return base64ToBytes(`${padded}${padding}`)
}

export async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
