import { useCallback, useEffect, useState } from 'react'

import {
  BLOCK_COMMENTS_CHANGED_EVENT,
  type BlockCommentsChangedDetail,
  fetchDocumentComments,
  type DocumentCommentEntry,
} from '@/services/block-comments'

export function useDocumentComments(docId: string | null) {
  const [entries, setEntries] = useState<DocumentCommentEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!docId) {
      setEntries([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const rows = await fetchDocumentComments(docId)
      setEntries(rows)
    } catch (loadError) {
      setEntries([])
      setError(loadError instanceof Error ? loadError : new Error(String(loadError)))
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

  return { entries, loading, error, refresh }
}
