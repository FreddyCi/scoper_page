import type { BlockRecord } from '@/lib/types'

export type LiteParseTextItem = {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontName?: string
  fontSize?: number
  confidence?: number
}

export type LiteParsePageResult = {
  pageNum: number
  width: number
  height: number
  textItems: LiteParseTextItem[]
}

export type LiteParseParseResult = {
  pages: LiteParsePageResult[]
  blocks: BlockRecord[]
  text: string
}

export type LiteParseProgress = {
  completedPages: number
  totalPages: number
  percent: number
}

export type LiteParseWorkerRequest =
  | { type: 'init' }
  | { type: 'ping' }
  | {
      type: 'parse'
      doc_id: string
      bytes: Uint8Array
      ocrEnabled?: boolean
      targetPages?: string
    }
  | {
      type: 'parseMarkdown'
      bytes: Uint8Array
      targetPages?: string
    }

export type LiteParseMarkdownAnnotation = {
  pageNum: number
  subtype: string
  contents?: string
  title?: string
}

export type LiteParseMarkdownFormField = {
  page: number
  type: string
  name?: string
  value?: string
}

export type LiteParseMarkdownResult = {
  markdown: string
  pages: Array<{ pageNum: number; markdown: string }>
  annotations: LiteParseMarkdownAnnotation[]
  formFields: LiteParseMarkdownFormField[]
}

export type LiteParseWorkerSuccess = {
  ok: true
  result?: unknown
}

export type LiteParseWorkerFailure = {
  ok: false
  error: string
}

export type LiteParseWorkerResponse = (LiteParseWorkerSuccess | LiteParseWorkerFailure) & {
  id: string
}

export type LiteParseWorkerMessage = { id: string } & LiteParseWorkerRequest
