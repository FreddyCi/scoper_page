import { useCallback, useEffect, useState } from 'react'

import {
  BLOCK_COMMENTS_CHANGED_EVENT,
  type BlockCommentsChangedDetail,
  fetchCommentedBlockIds,
  fetchCommentsForBlock,
  insertBlockComment,
} from '@/services/block-comments'
import type { CommentRecord } from '@/lib/types'

export function useCommentedBlockIds(docId: string | null) {
  const [blockIds, setBlockIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!docId) {
      setBlockIds(new Set())
      return
    }

    setLoading(true)
    try {
      const ids = await fetchCommentedBlockIds(docId)
      setBlockIds(new Set(ids))
    } finally {
      setLoading(false)
    }
  }, [docId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    function handleCommentsChanged(event: Event) {
      const detail = (event as CustomEvent<BlockCommentsChangedDetail>).detail
      if (detail?.docId && detail.docId !== docId) return
      void refresh()
    }

    window.addEventListener(BLOCK_COMMENTS_CHANGED_EVENT, handleCommentsChanged)
    window.addEventListener('scoper:comments-imported', handleCommentsChanged)
    return () => {
      window.removeEventListener(BLOCK_COMMENTS_CHANGED_EVENT, handleCommentsChanged)
      window.removeEventListener('scoper:comments-imported', handleCommentsChanged)
    }
  }, [docId, refresh])

  return { blockIds, loading, refresh }
}

export function useBlockComments(blockId: string | null) {
  const [comments, setComments] = useState<CommentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!blockId) {
      setComments([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const rows = await fetchCommentsForBlock(blockId)
      setComments(rows)
    } catch (loadError) {
      setComments([])
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [blockId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addComment = useCallback(
    async (text: string) => {
      if (!blockId) return null

      setSaving(true)
      setError(null)

      try {
        const comment = await insertBlockComment(blockId, text)
        setComments((current) => [...current, comment])
        return comment
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : String(saveError))
        return null
      } finally {
        setSaving(false)
      }
    },
    [blockId],
  )

  return { comments, loading, saving, error, refresh, addComment }
}
