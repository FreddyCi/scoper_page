import type {
  LiteParseMarkdownResult,
  LiteParsePageResult,
  LiteParseParseResult,
  LiteParseProgress,
  LiteParseWorkerMessage,
  LiteParseWorkerRequest,
  LiteParseWorkerResponse,
} from '@/lib/liteparse-protocol'
import { buildParseResultFromPages } from '@/lib/liteparse-normalize'
import { countPdfPages } from '@/lib/pdf-page-render'
import type { BlockRecord } from '@/lib/types'
import { pageNumbersNeedingOcr } from '@/services/liteparse-main'
import { parsePdfWithOcrFallback } from '@/services/liteparse-ocr-fallback'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

export class LiteParseClient {
  private worker: Worker | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private initPromise: Promise<void> | null = null
  private readonly handleMessage: (event: MessageEvent<LiteParseWorkerResponse>) => void

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

    this.worker = new Worker(new URL('../workers/liteparse.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'LiteParse worker error')
      for (const pending of this.pending.values()) {
        pending.reject(error)
      }
      this.pending.clear()
    })

    return this.worker
  }

  private send<T = unknown>(request: LiteParseWorkerRequest): Promise<T> {
    const worker = this.ensureWorker()
    const id = crypto.randomUUID()

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })

      const message: LiteParseWorkerMessage = { id, ...request }
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

  async parsePdf(
    docId: string,
    bytes: Uint8Array,
    options?: { ocrEnabled?: boolean; onProgress?: (progress: LiteParseProgress) => void },
  ): Promise<LiteParseParseResult> {
    await this.init()
    const parsed = options?.onProgress
      ? await this.parsePdfWithProgress(docId, bytes, options.onProgress)
      : await this.send<LiteParseParseResult>({
          type: 'parse',
          doc_id: docId,
          bytes,
          ocrEnabled: false,
        })

    if (!options?.ocrEnabled) {
      return parsed
    }

    let ocrPages: number[] = []
    if (parsed.blocks.length > 0) {
      ocrPages = await pageNumbersNeedingOcr(bytes).catch(() => [])
      if (ocrPages.length === 0) {
        return parsed
      }
    }

    const targetPages = parsed.blocks.length === 0 ? undefined : ocrPages
    const ocrParsed = await parsePdfWithOcrFallback(
      docId,
      bytes,
      targetPages,
      150,
      options.onProgress,
    )

    if (parsed.blocks.length === 0) {
      return ocrParsed
    }

    return mergeParseResults(docId, parsed, ocrParsed)
  }

  async parsePdfToMarkdown(
    bytes: Uint8Array,
    options?: { onProgress?: (progress: LiteParseProgress) => void },
  ): Promise<LiteParseMarkdownResult> {
    await this.init()

    if (options?.onProgress) {
      return this.parsePdfMarkdownWithProgress(bytes, options.onProgress)
    }

    return this.send<LiteParseMarkdownResult>({
      type: 'parseMarkdown',
      bytes,
    })
  }

  /** Markdown parse plus optional OCR block fallback for scanned pages. */
  async parsePdfToMarkdownWithOcrFallback(
    docId: string,
    bytes: Uint8Array,
    options?: { ocrEnabled?: boolean; onProgress?: (progress: LiteParseProgress) => void },
  ): Promise<{ markdown: LiteParseMarkdownResult; ocrBlocks: BlockRecord[] | null }> {
    const markdown = await this.parsePdfToMarkdown(bytes, options)

    const ocrPages = options?.ocrEnabled
      ? await pageNumbersNeedingOcr(bytes).catch(() => [])
      : []

    const needsOcr =
      options?.ocrEnabled === true &&
      (markdown.markdown.trim().length === 0 || ocrPages.length > 0)

    if (!needsOcr) {
      return { markdown, ocrBlocks: null }
    }

    const parsed = await this.parsePdf(docId, bytes, options)
    return { markdown, ocrBlocks: parsed.blocks }
  }

  private async parsePdfMarkdownWithProgress(
    bytes: Uint8Array,
    onProgress: (progress: LiteParseProgress) => void,
    batchSize = 5,
  ): Promise<LiteParseMarkdownResult> {
    const totalPages = await countPdfPages(bytes)

    if (totalPages <= 1) {
      onProgress({ completedPages: 0, totalPages: 1, percent: 0 })
      const parsed = await this.send<LiteParseMarkdownResult>({
        type: 'parseMarkdown',
        bytes,
      })
      onProgress({ completedPages: 1, totalPages: 1, percent: 100 })
      return parsed
    }

    const merged: LiteParseMarkdownResult = {
      markdown: '',
      pages: [],
      annotations: [],
      formFields: [],
    }

    for (let start = 1; start <= totalPages; start += batchSize) {
      const end = Math.min(start + batchSize - 1, totalPages)
      const targetPages = start === end ? String(start) : `${start}-${end}`

      onProgress({
        completedPages: start - 1,
        totalPages,
        percent: Math.round(((start - 1) / totalPages) * 100),
      })

      const batch = await this.send<LiteParseMarkdownResult>({
        type: 'parseMarkdown',
        bytes,
        targetPages,
      })

      merged.pages.push(...batch.pages)
      merged.annotations.push(...batch.annotations)
      merged.formFields.push(...batch.formFields)
      merged.markdown = merged.markdown
        ? `${merged.markdown}\n\n${batch.markdown}`.trim()
        : batch.markdown

      onProgress({
        completedPages: end,
        totalPages,
        percent: Math.round((end / totalPages) * 100),
      })
    }

    merged.pages.sort((left, right) => left.pageNum - right.pageNum)
    return merged
  }

  private async parsePdfWithProgress(
    docId: string,
    bytes: Uint8Array,
    onProgress: (progress: LiteParseProgress) => void,
    batchSize = 5,
  ): Promise<LiteParseParseResult> {
    const totalPages = await countPdfPages(bytes)

    if (totalPages <= 1) {
      onProgress({ completedPages: 0, totalPages: 1, percent: 0 })
      const parsed = await this.send<LiteParseParseResult>({
        type: 'parse',
        doc_id: docId,
        bytes,
        ocrEnabled: false,
      })
      onProgress({ completedPages: 1, totalPages: 1, percent: 100 })
      return parsed
    }

    const mergedPages: LiteParsePageResult[] = []

    for (let start = 1; start <= totalPages; start += batchSize) {
      const end = Math.min(start + batchSize - 1, totalPages)
      const targetPages = start === end ? String(start) : `${start}-${end}`

      onProgress({
        completedPages: start - 1,
        totalPages,
        percent: Math.round(((start - 1) / totalPages) * 100),
      })

      const batch = await this.send<LiteParseParseResult>({
        type: 'parse',
        doc_id: docId,
        bytes,
        targetPages,
        ocrEnabled: false,
      })

      mergedPages.push(...batch.pages)

      onProgress({
        completedPages: end,
        totalPages,
        percent: Math.round((end / totalPages) * 100),
      })
    }

    mergedPages.sort((left, right) => left.pageNum - right.pageNum)
    const text = mergedPages
      .flatMap((page) => page.textItems.map((item) => item.text))
      .join('\n')

    return buildParseResultFromPages(docId, mergedPages, text)
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

let singletonClient: LiteParseClient | null = null

export function createLiteParseClient(): LiteParseClient {
  return new LiteParseClient()
}

export async function getLiteParseClient(): Promise<LiteParseClient> {
  if (!singletonClient) {
    singletonClient = createLiteParseClient()
    await singletonClient.init()
  }
  return singletonClient
}

function mergeParseResults(
  docId: string,
  base: LiteParseParseResult,
  ocr: LiteParseParseResult,
): LiteParseParseResult {
  const ocrByPage = new Map(ocr.pages.map((page) => [page.pageNum, page]))
  const mergedPages = base.pages.map((page) => ocrByPage.get(page.pageNum) ?? page)

  for (const page of ocr.pages) {
    if (!mergedPages.some((entry) => entry.pageNum === page.pageNum)) {
      mergedPages.push(page)
    }
  }

  mergedPages.sort((left, right) => left.pageNum - right.pageNum)

  const text = mergedPages
    .flatMap((page) => page.textItems.map((item) => item.text))
    .join('\n')

  return buildParseResultFromPages(docId, mergedPages, text)
}

/** Dev harness — parse sample PDF; verify pages and textItems with bbox (BDA-021) */
export async function runLiteParseHarness(): Promise<void> {
  const client = createLiteParseClient()

  try {
    await client.init()
    const pong = await client.ping()
    if (pong !== 'pong') {
      throw new Error('LiteParse worker ping failed')
    }

    const response = await fetch('/sample/minimal.pdf')
    if (!response.ok) {
      throw new Error(`Failed to load sample PDF: ${response.status}`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    const parsed = await client.parsePdf('harness-doc', bytes)

    if (parsed.pages.length === 0) {
      throw new Error('LiteParse harness: expected pages.length > 0')
    }

    const hasCoordinates = parsed.pages.some((page) =>
      page.textItems.some(
        (item) =>
          Number.isFinite(item.x) &&
          Number.isFinite(item.y) &&
          Number.isFinite(item.width) &&
          Number.isFinite(item.height),
      ),
    )
    if (!hasCoordinates) {
      throw new Error('LiteParse harness: expected textItems with coordinates')
    }

    if (parsed.blocks.length === 0) {
      throw new Error('LiteParse harness: expected normalized blocks')
    }
  } finally {
    await client.terminate()
  }
}

/** Dev harness — parse scanned PDF with OCR enabled (BDA-022) */
export async function runLiteParseOcrHarness(): Promise<void> {
  const client = createLiteParseClient()

  try {
    await client.init()

    const withoutOcr = await fetch('/sample/scanned.pdf')
    if (!withoutOcr.ok) {
      throw new Error(`Failed to load scanned PDF: ${withoutOcr.status}`)
    }

    const scannedBytes = new Uint8Array(await withoutOcr.arrayBuffer())
    const noOcrResult = await client.parsePdf('harness-scanned-off', scannedBytes, {
      ocrEnabled: false,
    })

    if (noOcrResult.blocks.length > 0) {
      throw new Error('LiteParse OCR harness: scanned PDF should have no blocks without OCR')
    }

    const withOcrResult = await client.parsePdf('harness-scanned-on', scannedBytes, {
      ocrEnabled: true,
    })

    if (withOcrResult.pages.length === 0) {
      throw new Error('LiteParse OCR harness: expected pages.length > 0')
    }

    if (withOcrResult.blocks.length === 0) {
      throw new Error('LiteParse OCR harness: expected blocks with OCR enabled')
    }

    const hasCoordinates = withOcrResult.pages.some((page) =>
      page.textItems.some(
        (item) =>
          Number.isFinite(item.x) &&
          Number.isFinite(item.y) &&
          Number.isFinite(item.width) &&
          Number.isFinite(item.height),
      ),
    )
    if (!hasCoordinates) {
      throw new Error('LiteParse OCR harness: expected textItems with coordinates')
    }
  } finally {
    await client.terminate()
  }
}
