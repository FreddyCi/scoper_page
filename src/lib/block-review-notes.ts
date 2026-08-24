import type { CitationRef } from '@/lib/types'

export function citationHasReviewNote(
  commentedBlockIds: ReadonlySet<string>,
  citation?: CitationRef | null,
): boolean {
  const blockId = citation?.block_id
  return Boolean(blockId && commentedBlockIds.has(blockId))
}
