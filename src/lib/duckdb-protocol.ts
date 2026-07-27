import type { BlockRecord, DocumentMeta } from '@/lib/types'

export type DuckdbWorkerRequest =
  | { type: 'init' }
  | { type: 'ping' }
  | { type: 'query'; sql: string; params?: DuckdbQueryParam[] }
  | { type: 'insertDocument'; row: DocumentMeta }
  | { type: 'insertBlock'; row: BlockRecord }

export type DuckdbQueryParam = string | number | null

export type DuckdbWorkerSuccess = {
  ok: true
  result?: unknown
}

export type DuckdbWorkerFailure = {
  ok: false
  error: string
}

export type DuckdbWorkerResponse = (DuckdbWorkerSuccess | DuckdbWorkerFailure) & {
  id: string
}

export type DuckdbWorkerMessage = { id: string } & DuckdbWorkerRequest
