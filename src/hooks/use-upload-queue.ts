import { useCallback, useState } from 'react'

import { useIngestPipeline } from '@/hooks/use-ingest-pipeline'
import type { IngestProgress } from '@/services/ingest-router'
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

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function applyIngestProgress(
  items: PendingUpload[],
  files: File[],
  progress: IngestProgress,
): PendingUpload[] {
  const currentIndex = files.findIndex((file) => file.name === progress.currentFilename)

  return items.map((item) => {
    const index = files.findIndex((file) => fileKey(file) === fileKey(item.file))
    if (index < 0) return item

    if (index < progress.completed) {
      return { ...item, status: 'done' as const, error: undefined }
    }

    if (index === currentIndex && index === progress.completed) {
      return { ...item, status: 'parsing' as const, error: undefined }
    }

    if (item.status === 'done' || item.status === 'error') {
      return item
    }

    return { ...item, status: 'queued' as const, error: undefined }
  })
}

export function useUploadQueue() {
  const { enqueueFiles } = useIngestPipeline()
  const [items, setItems] = useState<PendingUpload[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

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
    setUploadProgress(0)
  }, [])

  const submitUpload = useCallback(async () => {
    if (items.length === 0 || isSubmitting) return false

    const files = items.map((item) => item.file)

    setIsSubmitting(true)
    setUploadProgress(0)
    setItems((current) =>
      current.map((item, index) => ({
        ...item,
        status: index === 0 ? ('parsing' as const) : ('queued' as const),
        error: undefined,
      })),
    )

    try {
      const { succeeded, failed } = await enqueueFiles(files, {
        onProgress: (progress) => {
          setUploadProgress(progress.percent)
          setItems((current) => applyIngestProgress(current, files, progress))
        },
      })

      if (failed.length > 0) {
        const succeededNames = new Set(succeeded.map((item) => item.filename))
        setItems((current) =>
          current.map((item) => {
            const failure = failed.find((entry) => entry.filename === item.file.name)
            if (failure) {
              return {
                ...item,
                status: 'error' as const,
                error: failure.error,
              }
            }
            if (succeededNames.has(item.file.name)) {
              return { ...item, status: 'done' as const }
            }
            return { ...item, status: 'error' as const, error: 'Ingest failed' }
          }),
        )
        setUploadProgress(failed.length === files.length ? 0 : 100)
        return succeeded.length > 0
      }

      setUploadProgress(100)
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
    uploadProgress,
    addFiles,
    removeFile,
    clearQueue,
    submitUpload,
  }
}
