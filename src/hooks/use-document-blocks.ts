import { useEffect, useState } from 'react'

import { fetchDocumentBlocks } from '@/services/document-blocks'
import type { BlockRecord } from '@/lib/types'

export function useDocumentBlocks(docId: string | null) {
  const [blocks, setBlocks] = useState<BlockRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!docId) {
      setBlocks([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetchDocumentBlocks(docId)
      .then((rows) => {
        if (!cancelled) setBlocks(rows)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setBlocks([])
          setError(loadError instanceof Error ? loadError : new Error(String(loadError)))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [docId])

  return { blocks, loading, error }
}
