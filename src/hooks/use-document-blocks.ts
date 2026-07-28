import { useCallback, useEffect, useState } from 'react'

import { fetchDocumentBlocks } from '@/services/document-blocks'
import type { BlockRecord } from '@/lib/types'

export function useDocumentBlocks(docId: string | null) {
  const [blocks, setBlocks] = useState<BlockRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!docId) {
      setBlocks([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const rows = await fetchDocumentBlocks(docId)
      setBlocks(rows)
    } catch (loadError) {
      setBlocks([])
      setError(loadError instanceof Error ? loadError : new Error(String(loadError)))
    } finally {
      setLoading(false)
    }
  }, [docId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    function handleBlocksChanged(event: Event) {
      const detail = (event as CustomEvent<{ docId?: string }>).detail
      if (detail?.docId && detail.docId !== docId) return
      void refresh()
    }

    window.addEventListener('scoper:blocks-changed', handleBlocksChanged)
    return () => window.removeEventListener('scoper:blocks-changed', handleBlocksChanged)
  }, [docId, refresh])

  return { blocks, loading, error, refresh }
}
