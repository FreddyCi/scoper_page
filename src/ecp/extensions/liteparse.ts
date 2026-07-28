import { capabilityId } from '@/ecp/types'
import { getLiteParseClient } from '@/services/liteparse-client'

export const LITEPARSE_EXTENSION_ID = '@demo/liteparse'

export const liteparseExtension = {
  id: LITEPARSE_EXTENSION_ID,
  label: 'LiteParse WASM parser',
  capabilities: {
    ping: async () => {
      const client = await getLiteParseClient()
      return client.ping()
    },
    parse: async (input: unknown) => {
      const payload = input as {
        docId: string
        bytes: Uint8Array | ArrayBuffer
        ocrEnabled?: boolean
      }

      if (!payload.docId || !payload.bytes) {
        throw new Error('@demo/liteparse.parse requires docId and bytes')
      }

      const bytes =
        payload.bytes instanceof Uint8Array ? payload.bytes : new Uint8Array(payload.bytes)

      const client = await getLiteParseClient()
      return client.parsePdf(payload.docId, bytes, { ocrEnabled: payload.ocrEnabled })
    },
  },
} as const

export const LITEPARSE_CAPABILITIES = {
  ping: capabilityId(LITEPARSE_EXTENSION_ID, 'ping'),
  parse: capabilityId(LITEPARSE_EXTENSION_ID, 'parse'),
} as const
