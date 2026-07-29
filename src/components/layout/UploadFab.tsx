import { useCallback } from 'react'
import { UploadIcon } from 'lucide-react'

import { UploadPopup } from '@/components/layout/UploadPopup'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useUploadQueue } from '@/hooks/use-upload-queue'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type UploadFabProps = {
  className?: string
}

export function UploadFab({ className }: UploadFabProps) {
  const open = useSessionStore((s) => s.uploadPopupOpen)
  const setUploadPopupOpen = useSessionStore((s) => s.setUploadPopupOpen)
  const {
    items,
    count,
    isSubmitting,
    uploadProgress,
    progressPhase,
    addFiles,
    removeFile,
    clearQueue,
    submitUpload,
  } = useUploadQueue()

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
    <div className={cn('relative', className)}>
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

      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="shadow-elevated border-border bg-surface relative size-10 rounded-full border"
        aria-label="Upload documents"
        aria-expanded={open}
        onClick={() => setUploadPopupOpen(!open)}
      >
        <UploadIcon className="size-4" />
        {count > 0 ? (
          <Badge
            variant="default"
            className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5"
          >
            {count}
          </Badge>
        ) : null}
      </Button>
    </div>
  )
}
