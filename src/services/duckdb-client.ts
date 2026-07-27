import type {
  DuckdbQueryParam,
  DuckdbWorkerMessage,
  DuckdbWorkerRequest,
  DuckdbWorkerResponse,
} from '@/lib/duckdb-protocol'
import type { BlockRecord, DocumentMeta } from '@/lib/types'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

export class DuckdbClient {
  private worker: Worker | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private initPromise: Promise<void> | null = null
  private readonly handleMessage: (event: MessageEvent<DuckdbWorkerResponse>) => void

  constructor() {
    this.handleMessage = (event) => {
      const response = event.data
      const pending = this.pending.get(response.id)
      if (!pending) return

      this.pending.delete(response.id)
      if (response.ok) {
        pending.resolve(response.result)
      } else {
        pending.reject(new Error(response.error))
      }
    }
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker

    this.worker = new Worker(
      new URL('../workers/duckdb.worker.ts', import.meta.url),
      { type: 'module' },
    )
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'DuckDB worker error')
      for (const pending of this.pending.values()) {
        pending.reject(error)
      }
      this.pending.clear()
    })

    return this.worker
  }

  private send<T = unknown>(request: DuckdbWorkerRequest): Promise<T> {
    const worker = this.ensureWorker()
    const id = crypto.randomUUID()

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })

      const message: DuckdbWorkerMessage = { id, ...request }
      worker.postMessage(message)
    })
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.send<void>({ type: 'init' }).then(() => undefined)
    }
    await this.initPromise
  }

  async ping(): Promise<string> {
    await this.init()
    return this.send<string>({ type: 'ping' })
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: DuckdbQueryParam[],
  ): Promise<T[]> {
    await this.init()
    return this.send<T[]>({ type: 'query', sql, params })
  }

  async insertDocument(row: DocumentMeta): Promise<void> {
    await this.init()
    await this.send({ type: 'insertDocument', row })
  }

  async insertBlock(row: BlockRecord): Promise<void> {
    await this.init()
    await this.send({ type: 'insertBlock', row })
  }

  async terminate(): Promise<void> {
    if (!this.worker) return

    this.worker.removeEventListener('message', this.handleMessage)
    this.worker.terminate()
    this.worker = null
    this.initPromise = null
    this.pending.clear()
  }
}

let singletonClient: DuckdbClient | null = null

export function createDuckdbClient(): DuckdbClient {
  return new DuckdbClient()
}

export async function getDuckdbClient(): Promise<DuckdbClient> {
  if (!singletonClient) {
    singletonClient = createDuckdbClient()
    await singletonClient.init()
  }
  return singletonClient
}

/** Dev harness — INSERT document + block; SELECT verifies rows (BDA-020) */
export async function runDuckdbHarness(): Promise<void> {
  const client = createDuckdbClient()

  try {
    await client.init()
    const pong = await client.ping()
    if (pong !== 'pong') {
      throw new Error('DuckDB worker ping failed')
    }

    await client.insertDocument({
      doc_id: 'harness-doc',
      filename: 'harness.pdf',
      mime: 'application/pdf',
      role: 'unknown',
      uploaded_at: new Date().toISOString(),
    })

    await client.insertBlock({
      block_id: 'harness-block',
      doc_id: 'harness-doc',
      page_num: 1,
      text: 'Harness clause text',
      x: 10,
      y: 20,
      width: 100,
      height: 12,
    })

    const documents = await client.query<{ doc_id: string }>(
      'SELECT doc_id FROM documents WHERE doc_id = ?',
      ['harness-doc'],
    )
    const blocks = await client.query<{ block_id: string }>(
      'SELECT block_id FROM blocks WHERE block_id = ?',
      ['harness-block'],
    )

    if (documents.length !== 1 || blocks.length !== 1) {
      throw new Error('DuckDB harness SELECT failed')
    }
  } finally {
    await client.terminate()
  }
}
