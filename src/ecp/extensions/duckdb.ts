import { capabilityId } from '@/ecp/types'
import type { DuckdbQueryParam } from '@/lib/duckdb-protocol'
import type { BlockRecord, DocumentMeta } from '@/lib/types'
import { getDuckdbClient } from '@/services/duckdb-client'

export const DUCKDB_EXTENSION_ID = '@demo/duckdb'

export const duckdbExtension = {
  id: DUCKDB_EXTENSION_ID,
  label: 'DuckDB WASM session store',
  capabilities: {
    ping: async () => {
      const client = await getDuckdbClient()
      return client.ping()
    },
    query: async (input: unknown) => {
      const payload = input as { sql: string; params?: DuckdbQueryParam[] }
      if (!payload.sql?.trim()) {
        throw new Error('@demo/duckdb.query requires sql')
      }

      const client = await getDuckdbClient()
      return client.query(payload.sql, payload.params)
    },
    insertDocument: async (input: unknown) => {
      const document = input as DocumentMeta
      if (!document?.doc_id) {
        throw new Error('@demo/duckdb.insertDocument requires DocumentMeta')
      }

      const client = await getDuckdbClient()
      await client.insertDocument(document)
      return { ok: true }
    },
    insertBlock: async (input: unknown) => {
      const block = input as BlockRecord
      if (!block?.block_id) {
        throw new Error('@demo/duckdb.insertBlock requires BlockRecord')
      }

      const client = await getDuckdbClient()
      await client.insertBlock(block)
      return { ok: true }
    },
  },
} as const

export const DUCKDB_CAPABILITIES = {
  ping: capabilityId(DUCKDB_EXTENSION_ID, 'ping'),
  query: capabilityId(DUCKDB_EXTENSION_ID, 'query'),
  insertDocument: capabilityId(DUCKDB_EXTENSION_ID, 'insertDocument'),
  insertBlock: capabilityId(DUCKDB_EXTENSION_ID, 'insertBlock'),
} as const
