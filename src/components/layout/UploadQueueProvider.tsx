import { createContext, useCallback, useContext, type ReactNode } from 'react'

import { UploadPopup } from '@/components/layout/UploadPopup'
import { useUploadQueue } from '@/hooks/use-upload-queue'
import { useSessionStore } from '@/store/session-store'

type UploadQueueContextValue = ReturnType<typeof useUploadQueue>

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null)

export function useUploadQueueContext(): UploadQueueContextValue {
  const value = useContext(UploadQueueContext)
  if (!value) {
    throw new Error('useUploadQueueContext must be used within UploadQueueProvider')
  }
  return value
}

/** Keeps upload popup mounted so landing cards and footer FAB can open it. */
export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const open = useSessionStore((s) => s.uploadPopupOpen)
  const setUploadPopupOpen = useSessionStore((s) => s.setUploadPopupOpen)
  const queue = useUploadQueue()
  const { isSubmitting, clearQueue, items, uploadProgress, progressPhase, addFiles, removeFile, submitUpload } =
    queue

  const handleCancel = useCallback(() => {
    if (!isSubmitting) clearQueue()
  }, [clearQueue, isSubmitting])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setUploadPopupOpen(next)
      if (!next && !isSubmitting) clearQueue()
    },
    [clearQueue, isSubmitting, setUploadPopupOpen],
  )

  return (
    <UploadQueueContext.Provider value={queue}>
      {children}
      <UploadPopup
        open={open}
        items={items}
        isSubmitting={isSubmitting}
        uploadProgress={uploadProgress}
        progressPhase={progressPhase}
        onOpenChange={handleOpenChange}
        onAddFiles={addFiles}
        onRemoveFile={removeFile}
        onCancel={handleCancel}
        onUpload={submitUpload}
      />
    </UploadQueueContext.Provider>
  )
}
