import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

const SUPPORTED_FORMATS = [
  { label: 'PDF', detail: 'RFPs, scans, bidder responses' },
  { label: 'Word', detail: '.doc / .docx proposals' },
  { label: 'Markdown', detail: 'Supporting context notes' },
  { label: 'Excel', detail: 'Pricing and line-item sheets' },
] as const

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
    <Attachment state={attachmentState} size="sm" className="w-full min-w-0">
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

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close upload popup"
        className="fixed inset-0 z-50 bg-black/15 supports-backdrop-filter:backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-popup-title"
          className={cn(
            'border-border bg-surface shadow-elevated pointer-events-auto flex max-h-[min(44rem,calc(100svh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[1.25rem] border',
            className,
          )}
        >
          <div className="border-border flex items-start justify-between gap-4 border-b px-6 py-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="upload-popup-title" className="text-lg font-semibold tracking-tight">
                  Upload documents
                </h2>
                {items.length > 0 ? (
                  <Badge variant="secondary">{items.length} files</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1.5 max-w-lg text-sm leading-relaxed">
                Add procurement files to this session. Everything is parsed locally in your
                browser — nothing is sent to a server.
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

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
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
                'rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors sm:py-14',
                isDragging
                  ? 'border-foreground/35 bg-muted/70'
                  : 'border-border hover:border-foreground/20 hover:bg-muted/30 bg-muted/15',
              )}
            >
              <div className="bg-surface text-foreground shadow-panel mx-auto flex size-14 items-center justify-center rounded-2xl border">
                <UploadCloudIcon className="size-7" />
              </div>
              <p className="text-foreground mt-5 text-base font-semibold">
                Drop files here or click to browse
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Select one or more files — you can add more before uploading
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SUPPORTED_FORMATS.map((format) => (
                  <div
                    key={format.label}
                    className="border-border/70 bg-surface/80 rounded-xl border px-3 py-2.5 text-left"
                  >
                    <p className="text-foreground text-xs font-semibold">{format.label}</p>
                    <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                      {format.detail}
                    </p>
                  </div>
                ))}
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
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-foreground text-sm font-medium">Queued files</p>
                  <p className="text-muted-foreground text-xs">
                    {items.length} {items.length === 1 ? 'file' : 'files'} ready
                  </p>
                </div>
                <div className="border-border/70 bg-workspace/40 max-h-52 space-y-2 overflow-y-auto rounded-xl border p-3">
                  {items.map((item) => (
                    <UploadFileRow
                      key={item.id}
                      item={item}
                      onRemove={onRemoveFile}
                      disabled={isSubmitting}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-border flex items-center justify-between gap-3 border-t px-6 py-4">
            <p className="text-muted-foreground hidden text-xs sm:block">
              Markdown files are stored as supporting context for scope analysis.
            </p>
            <div className="ml-auto flex items-center gap-2">
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
                className="min-w-24"
                disabled={items.length === 0 || isSubmitting}
                onClick={() => void handleUpload()}
              >
                {isSubmitting ? 'Parsing…' : 'Upload'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
