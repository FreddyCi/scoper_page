import { useCallback, useRef, useState } from 'react'
import {
  FileSpreadsheetIcon,
  FileTextIcon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react'

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PendingUpload } from '@/hooks/use-upload-queue'
import {
  UPLOAD_ACCEPT_STRING,
  formatUploadFileSize,
  getFileExtension,
  isAcceptedUploadFile,
} from '@/lib/upload-accept'
import { cn } from '@/lib/utils'

type UploadPopupProps = {
  open: boolean
  items: PendingUpload[]
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onAddFiles: (files: FileList | File[]) => void
  onRemoveFile: (id: string) => void
  onCancel: () => void
  onUpload: () => Promise<boolean>
  className?: string
}

function fileIconForName(filename: string) {
  const extension = getFileExtension(filename)
  if (extension === 'xlsx' || extension === 'xls') {
    return FileSpreadsheetIcon
  }
  return FileTextIcon
}

function statusLabel(item: PendingUpload): string {
  switch (item.status) {
    case 'queued':
      return 'Ready'
    case 'parsing':
      return 'Parsing…'
    case 'done':
      return 'Ingested'
    case 'error':
      return item.error ?? 'Failed'
  }
}

function UploadFileRow({
  item,
  onRemove,
  disabled,
}: {
  item: PendingUpload
  onRemove: (id: string) => void
  disabled: boolean
}) {
  const Icon = fileIconForName(item.file.name)
  const attachmentState =
    item.status === 'parsing'
      ? 'processing'
      : item.status === 'error'
        ? 'error'
        : 'idle'

  return (
    <Attachment
      state={attachmentState}
      size="sm"
      className="w-full min-w-0"
    >
      <AttachmentMedia>
        <Icon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{item.file.name}</AttachmentTitle>
        <AttachmentDescription>
          {formatUploadFileSize(item.file.size)} · {statusLabel(item)}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction
          aria-label={`Remove ${item.file.name}`}
          disabled={disabled || item.status === 'parsing'}
          onClick={() => onRemove(item.id)}
        >
          <XIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}

export function UploadPopup({
  open,
  items,
  isSubmitting,
  onOpenChange,
  onAddFiles,
  onRemoveFile,
  onCancel,
  onUpload,
  className,
}: UploadPopupProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const accepted = Array.from(files).filter(isAcceptedUploadFile)
      if (accepted.length > 0) onAddFiles(accepted)
    },
    [onAddFiles],
  )

  const handleClose = useCallback(() => {
    onOpenChange(false)
    onCancel()
  }, [onCancel, onOpenChange])

  const handleUpload = useCallback(async () => {
    const success = await onUpload()
    if (success) {
      window.setTimeout(() => {
        handleClose()
      }, 350)
    }
  }, [handleClose, onUpload])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close upload popup"
        className="fixed inset-0 z-40 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-popup-title"
        className={cn(
          'border-border bg-surface shadow-elevated absolute bottom-full left-0 z-50 mb-3 flex w-[min(22rem,calc(100vw-2rem))] max-h-[min(28rem,calc(100svh-8rem))] flex-col overflow-hidden rounded-panel border',
          className,
        )}
      >
        <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="upload-popup-title" className="text-sm font-semibold">
                Upload documents
              </h2>
              {items.length > 0 ? (
                <Badge variant="secondary">{items.length} files</Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              PDF, Word, Markdown (.md), or Excel — Markdown uploads as supporting context
            </p>
          </div>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Close"
            onClick={handleClose}
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                inputRef.current?.click()
              }
            }}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDragging(false)
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              if (event.dataTransfer.files.length > 0) {
                handleFiles(event.dataTransfer.files)
              }
            }}
            className={cn(
              'rounded-control border-border flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-4 py-8 text-center transition-colors',
              isDragging
                ? 'border-foreground/30 bg-muted/60'
                : 'hover:bg-muted/40 bg-muted/20',
            )}
          >
            <UploadCloudIcon className="text-muted-foreground size-8" />
            <div>
              <p className="text-sm font-medium">Drop files here</p>
              <p className="text-muted-foreground mt-1 text-xs">
                or click to browse
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT_STRING}
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) handleFiles(event.target.files)
                event.target.value = ''
              }}
            />
          </div>

          {items.length > 0 ? (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <UploadFileRow
                  key={item.id}
                  item={item}
                  onRemove={onRemoveFile}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-border flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isSubmitting}
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={items.length === 0 || isSubmitting}
            onClick={() => void handleUpload()}
          >
            {isSubmitting ? 'Parsing…' : 'Upload'}
          </Button>
        </div>
      </div>
    </>
  )
}
