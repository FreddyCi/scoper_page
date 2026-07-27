import { useCallback, useState } from 'react'

import { useIngestPipeline } from '@/hooks/use-ingest-pipeline'
import { isAcceptedUploadFile } from '@/lib/upload-accept'

export type PendingUploadStatus = 'queued' | 'parsing' | 'done' | 'error'

export type PendingUpload = {
  id: string
  file: File
  status: PendingUploadStatus
  error?: string
}

function createPendingUpload(file: File): PendingUpload {
  return {
    id: crypto.randomUUID(),
    file,
    status: 'queued',
  }
}

function mergeUniqueFiles(existing: PendingUpload[], incoming: File[]): PendingUpload[] {
  const seen = new Set(
    existing.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`),
  )

  const next = [...existing]
  for (const file of incoming) {
    if (!isAcceptedUploadFile(file)) continue
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push(createPendingUpload(file))
  }
  return next
}

export function useUploadQueue() {
  const { enqueueFiles } = useIngestPipeline()
  const [items, setItems] = useState<PendingUpload[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files)
    setItems((current) => mergeUniqueFiles(current, list))
  }, [])

  const removeFile = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const clearQueue = useCallback(() => {
    setItems([])
    setIsSubmitting(false)
  }, [])

  const submitUpload = useCallback(async () => {
    if (items.length === 0 || isSubmitting) return false

    setIsSubmitting(true)
    setItems((current) =>
      current.map((item) => ({ ...item, status: 'parsing' as const, error: undefined })),
    )

    try {
      await enqueueFiles(items.map((item) => item.file))
      await new Promise((resolve) => setTimeout(resolve, 700))
      setItems((current) =>
        current.map((item) => ({ ...item, status: 'done' as const })),
      )
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      setItems((current) =>
        current.map((item) => ({
          ...item,
          status: 'error' as const,
          error: message,
        })),
      )
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [enqueueFiles, isSubmitting, items])

  return {
    items,
    count: items.length,
    isSubmitting,
    addFiles,
    removeFile,
    clearQueue,
    submitUpload,
  }
}
