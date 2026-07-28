import { getDuckdbClient } from '@/services/duckdb-client'
import type { CommentRecord } from '@/lib/types'

type CommentRow = {
  comment_id: string
  block_id: string
  text: string
  created_at: string
}

function normalizeComment(row: CommentRow): CommentRecord {
  return {
    comment_id: row.comment_id,
    block_id: row.block_id,
    text: row.text,
    created_at: row.created_at,
  }
}

/** Persist a review note on a document block (BDA-082) */
export async function insertBlockComment(blockId: string, text: string): Promise<CommentRecord> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Comment text cannot be empty')
  }

  const comment: CommentRecord = {
    comment_id: `comment-${crypto.randomUUID()}`,
    block_id: blockId,
    text: trimmed,
    created_at: new Date().toISOString(),
  }

  const duckdb = await getDuckdbClient()
  await duckdb.query(
    `INSERT INTO comments (comment_id, block_id, text, created_at)
     VALUES (?, ?, ?, ?)`,
    [comment.comment_id, comment.block_id, comment.text, comment.created_at],
  )

  return comment
}

/** List comments for one block, oldest first (BDA-082) */
export async function fetchCommentsForBlock(blockId: string): Promise<CommentRecord[]> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<CommentRow>(
    `SELECT comment_id, block_id, text, created_at
     FROM comments
     WHERE block_id = ?
     ORDER BY created_at ASC, comment_id ASC`,
    [blockId],
  )

  return rows.map(normalizeComment)
}

/** Block ids in a document that have at least one comment (BDA-082) */
export async function fetchCommentedBlockIds(docId: string): Promise<string[]> {
  const duckdb = await getDuckdbClient()
  const rows = await duckdb.query<{ block_id: string }>(
    `SELECT DISTINCT c.block_id
     FROM comments c
     INNER JOIN blocks b ON b.block_id = c.block_id
     WHERE b.doc_id = ?
     ORDER BY c.block_id`,
    [docId],
  )

  return rows.map((row) => row.block_id)
}

/** Dev harness — comment persists in session DuckDB after re-fetch (BDA-082) */
export async function runBlockCommentsHarness(): Promise<void> {
  const duckdb = await getDuckdbClient()
  const docId = 'comment-harness-doc'
  const blockId = 'comment-harness-block'

  await duckdb.insertDocument({
    doc_id: docId,
    filename: 'comments-harness.pdf',
    mime: 'application/pdf',
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  })

  await duckdb.insertBlock({
    block_id: blockId,
    doc_id: docId,
    page_num: 1,
    text: 'Indemnification clause sample text for comment harness.',
  })

  await insertBlockComment(blockId, 'Flag for legal review before sign-off.')

  const comments = await fetchCommentsForBlock(blockId)
  if (comments.length !== 1 || !comments[0]?.text.includes('legal review')) {
    throw new Error('runBlockCommentsHarness failed: expected saved comment on block')
  }

  const reloaded = await fetchCommentsForBlock(blockId)
  if (reloaded.length !== 1) {
    throw new Error('runBlockCommentsHarness failed: comment missing after re-fetch')
  }

  const commentedIds = await fetchCommentedBlockIds(docId)
  if (!commentedIds.includes(blockId)) {
    throw new Error('runBlockCommentsHarness failed: block comment indicator lookup failed')
  }
}
