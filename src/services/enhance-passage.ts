import { SCOPER_BONSAI_17B, SCOPER_SEND_DEFAULTS } from '@/lib/scoper-model'
import type { BlockRecord } from '@/lib/types'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import { cacheDocumentBytes } from '@/services/document-bytes-cache'
import { insertBlockComment } from '@/services/block-comments'
import { getDuckdbClient } from '@/services/duckdb-client'
import {
  getScoperClient,
  ScoperWebGpuUnavailableError,
} from '@/services/scoper-client'

export type GeneratePassageEnhancementOptions = {
  instruction?: string
  onDelta?: (delta: string) => void
  signal?: AbortSignal
}

function stripModelWrapper(text: string): string {
  return text
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^(?:here(?:'s| is) (?:the )?(?:revised|updated|enhanced) passage:?\s*)/i, '')
    .trim()
}

async function ensureScoperReady(): Promise<void> {
  const scoper = getScoperClient()
  const env = await scoper.probeEnvironment()

  if (!env.webGpuAvailable) {
    throw new ScoperWebGpuUnavailableError(
      env.webGpuError ?? 'WebGPU is required for on-device enhancement.',
    )
  }

  if (scoper.getState().status !== 'ready') {
    await scoper.load()
  }
}

/** Generate an improved markdown passage with the on-device Scoper 1.7 model. */
export async function generatePassageEnhancement(
  passage: string,
  options: GeneratePassageEnhancementOptions = {},
): Promise<string> {
  await ensureScoperReady()

  const instruction = options.instruction?.trim()
  const scoper = getScoperClient()

  const result = await scoper.send(
    [
      {
        role: 'user',
        content: [
          'Revise this markdown passage for a procurement context document.',
          instruction
            ? `Follow this instruction: ${instruction}`
            : 'Improve clarity, structure, and tone while preserving meaning.',
          'Return only the revised passage. Do not add a title, preamble, or quotes.',
          '',
          'Original passage:',
          passage.trim(),
        ].join('\n'),
      },
    ],
    {
      ...SCOPER_SEND_DEFAULTS,
      maxTokens: 384,
      temperature: 0.45,
      onText: options.onDelta,
      signal: options.signal,
    },
  )

  const enhanced = stripModelWrapper(result.text.trim())
  return enhanced || passage.trim()
}

export function scoperEnhanceModelLabel(): string {
  return SCOPER_BONSAI_17B.label
}

/** Apply an AI enhancement to DuckDB, mark the block, and refresh cached markdown bytes. */
export async function recordPassageEnhancement(
  block: BlockRecord,
  enhancedText: string,
): Promise<void> {
  const trimmed = enhancedText.trim()
  if (!trimmed) {
    throw new Error('Enhanced passage cannot be empty')
  }

  const duckdb = await getDuckdbClient()
  await duckdb.insertBlock({
    ...block,
    text: trimmed,
  })

  await insertBlockComment(block.block_id, 'Recorded enhancement', {
    authorInitials: 'AI',
  })

  const blocks = await fetchDocumentBlocks(block.doc_id)
  const markdown = `${blocks.map((entry) => entry.text.trim()).filter(Boolean).join('\n\n')}\n`
  cacheDocumentBytes(block.doc_id, new TextEncoder().encode(markdown))

  window.dispatchEvent(
    new CustomEvent('scoper:blocks-changed', {
      detail: { docId: block.doc_id },
    }),
  )
}
