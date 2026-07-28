/// <reference lib="webworker" />

import { AsyncDuckDB, VoidLogger } from '@duckdb/duckdb-wasm'

import type {
  DuckdbQueryParam,
  DuckdbWorkerMessage,
  DuckdbWorkerResponse,
} from '@/lib/duckdb-protocol'
import { DUCKDB_SCHEMA_STATEMENTS } from '@/lib/duckdb-schema'
import type { BlockRecord, DocumentMeta } from '@/lib/types'

const WASM_URL = '/duckdb/duckdb-eh.wasm'
const EH_WORKER_URL = '/duckdb/duckdb-browser-eh.worker.js'

let db: AsyncDuckDB | null = null
let connection: Awaited<ReturnType<AsyncDuckDB['connect']>> | null = null
let initPromise: Promise<void> | null = null

function postResponse(response: DuckdbWorkerResponse) {
  self.postMessage(response)
}

async function ensureInitialized() {
  if (connection) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    const innerWorker = new Worker(EH_WORKER_URL)
    db = new AsyncDuckDB(new VoidLogger(), innerWorker)
    await db.instantiate(WASM_URL)
    await db.open({ path: ':memory:' })
    connection = await db.connect()

    for (const statement of DUCKDB_SCHEMA_STATEMENTS) {
      await connection.query(statement)
    }
  })()

  return initPromise
}

async function runQuery(sql: string, params: DuckdbQueryParam[] = []) {
  if (!connection) throw new Error('DuckDB connection unavailable')

  if (params.length === 0) {
    const table = await connection.query(sql)
    return table.toArray().map((row) => row.toJSON())
  }

  const statement = await connection.prepare(sql)
  try {
    const table = await statement.query(...params)
    return table.toArray().map((row) => row.toJSON())
  } finally {
    await statement.close()
  }
}

async function insertDocument(row: DocumentMeta) {
  await runQuery(
    `INSERT OR REPLACE INTO documents
      (doc_id, filename, mime, role, uploaded_at)
     VALUES (?, ?, ?, ?, ?)`,
    [row.doc_id, row.filename, row.mime, row.role, row.uploaded_at],
  )
}

async function updateDocumentRole(docId: string, role: string) {
  await runQuery('UPDATE documents SET role = ? WHERE doc_id = ?', [role, docId])
}

async function insertBlock(row: BlockRecord) {
  await runQuery(
    `INSERT OR REPLACE INTO blocks
      (block_id, doc_id, page_num, section_path, text, x, y, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.block_id,
      row.doc_id,
      row.page_num ?? null,
      row.section_path ?? null,
      row.text,
      row.x ?? null,
      row.y ?? null,
      row.width ?? null,
      row.height ?? null,
    ],
  )
}

self.onmessage = async (event: MessageEvent<DuckdbWorkerMessage>) => {
  const { id, type } = event.data

  try {
    switch (type) {
      case 'ping':
        postResponse({ id, ok: true, result: 'pong' })
        return

      case 'init':
        await ensureInitialized()
        postResponse({ id, ok: true })
        return

      case 'query': {
        await ensureInitialized()
        const rows = await runQuery(event.data.sql, event.data.params ?? [])
        postResponse({ id, ok: true, result: rows })
        return
      }

      case 'insertDocument': {
        await ensureInitialized()
        await insertDocument(event.data.row)
        postResponse({ id, ok: true })
        return
      }

      case 'insertBlock': {
        await ensureInitialized()
        await insertBlock(event.data.row)
        postResponse({ id, ok: true })
        return
      }

      case 'updateDocumentRole': {
        await ensureInitialized()
        await updateDocumentRole(event.data.docId, event.data.role)
        postResponse({ id, ok: true })
        return
      }

      default: {
        const exhaustive: never = type
        throw new Error(`Unknown worker request: ${String(exhaustive)}`)
      }
    }
  } catch (error) {
    postResponse({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export {}
