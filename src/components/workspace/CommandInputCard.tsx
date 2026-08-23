import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  ArrowUpIcon,
  ChevronDownIcon,
  FileTextIcon,
  PaperclipIcon,
  Settings2Icon,
  XIcon,
} from 'lucide-react'

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SCOPER_BONSAI_17B } from '@/lib/scoper-model'
import { PdfIngestOptionsPanel } from '@/components/workspace/PdfIngestOptionsPanel'
import {
  getFileExtension,
  isAcceptedUploadFile,
  UPLOAD_ACCEPT_STRING,
} from '@/lib/upload-accept'
import type { WorkspaceMode } from '@/lib/types'
import {
  overlayPanelClass,
  overlaySectionTitleClass,
} from '@/lib/overlay-chrome'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

export type CommandAttachment = {
  id: string
  file: File
}

export type CommandInputSubmitPayload = {
  prompt: string
  files: File[]
  mode: WorkspaceMode
  ocrEnabled: boolean
}

type CommandInputCardProps = {
  onSubmit?: (payload: CommandInputSubmitPayload) => void
  isSubmitting?: boolean
  className?: string
}

const PLACEHOLDER_COPY: Record<WorkspaceMode, string> = {
  rfp: 'Describe what to analyse in these RFP documents…',
  proposal: 'Attach the solicitation RFP and describe your company as the responder…',
}

const MODE_CHIP_LABEL: Record<WorkspaceMode, string> = {
  rfp: 'RFP Analysis',
  proposal: 'Generate Proposal',
}

const FAN_ROTATIONS = ['-rotate-6', '-rotate-3', 'rotate-0', 'rotate-3', 'rotate-6'] as const

function createAttachment(file: File): CommandAttachment {
  return { id: crypto.randomUUID(), file }
}

function mergeAttachments(
  existing: CommandAttachment[],
  incoming: File[],
): CommandAttachment[] {
  const seen = new Set(
    existing.map(
      (item) =>
        `${item.file.name}:${item.file.size}:${item.file.lastModified}`,
    ),
  )
  const next = [...existing]
  for (const file of incoming) {
    if (!isAcceptedUploadFile(file)) continue
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push(createAttachment(file))
  }
  return next
}

function FileStackPreview({
  items,
  onRemove,
}: {
  items: CommandAttachment[]
  onRemove: (id: string) => void
}) {
  const visible = items.slice(0, 5)
  const overflow = items.length - visible.length

  return (
    <div className="flex min-w-0 items-end gap-3">
      <div className="relative flex h-[4.75rem] min-w-0 flex-1 items-end pl-1">
        {visible.map((item, index) => {
          const extension = getFileExtension(item.file.name)

          return (
            <Attachment
              key={item.id}
              orientation="vertical"
              size="sm"
              className={cn(
                'absolute bottom-0 w-[4.5rem] shadow-panel transition-transform',
                index > 0 && '-ml-0',
                FAN_ROTATIONS[index] ?? 'rotate-0',
              )}
              style={{ left: `${index * 2.25}rem`, zIndex: index }}
            >
              <AttachmentMedia>
                <FileTextIcon />
              </AttachmentMedia>
              <AttachmentContent className="px-1 pb-1">
                <AttachmentTitle className="text-[0.65rem]">
                  {item.file.name}
                </AttachmentTitle>
                <span className="text-muted-foreground mt-0.5 block truncate text-[0.6rem] uppercase">
                  {extension ?? 'file'}
                </span>
              </AttachmentContent>
              <AttachmentActions className="top-1 right-1">
                <AttachmentAction
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => onRemove(item.id)}
                >
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          )
        })}
        {overflow > 0 ? (
          <div
            className="bg-muted text-muted-foreground absolute bottom-1 flex size-8 items-center justify-center rounded-full text-xs font-medium"
            style={{ left: `${visible.length * 2.25 + 1}rem`, zIndex: visible.length + 1 }}
          >
            +{overflow}
          </div>
        ) : null}
      </div>

      <Badge variant="secondary" className="shrink-0">
        {items.length} {items.length === 1 ? 'file' : 'files'}
      </Badge>
    </div>
  )
}

function CommandSettingsPopover({
  open,
  onClose,
  anchorRef,
}: {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLButtonElement | null>
}) {
  const mode = useSessionStore((s) => s.mode)
  const setMode = useSessionStore((s) => s.setMode)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        panelRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return
      }
      onClose()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [anchorRef, onClose, open])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className={cn(overlayPanelClass, 'absolute bottom-full left-0 z-20 mb-2 w-56 rounded-lg p-3')}
    >
      <p className={cn(overlaySectionTitleClass, 'mb-2')}>Settings</p>

      <div className="space-y-3">
        <div>
          <p className="text-muted-foreground mb-1.5 text-xs">Mode</p>
          <div className="flex flex-col gap-1">
            {(
              [
                ['rfp', MODE_CHIP_LABEL.rfp],
                ['proposal', MODE_CHIP_LABEL.proposal],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                  mode === value
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-muted-foreground mb-1.5 text-xs">Model</p>
          <button
            type="button"
            disabled
            className="text-muted-foreground inline-flex w-full items-center justify-between rounded-md border border-dashed px-2 py-1.5 text-xs"
          >
            {SCOPER_BONSAI_17B.label}
            <ChevronDownIcon className="size-3 opacity-50" />
          </button>
        </div>

        <div>
          <p className="text-muted-foreground mb-1.5 text-xs">PDF upload</p>
          <PdfIngestOptionsPanel />
        </div>
      </div>
    </div>
  )
}

export function CommandInputCard({
  onSubmit,
  isSubmitting = false,
  className,
}: CommandInputCardProps) {
  const mode = useSessionStore((s) => s.mode)
  const ocrEnabled = useSessionStore((s) => s.ocrEnabled)
  const openUploadPopup = useSessionStore((s) => s.openUploadPopup)
  const [prompt, setPrompt] = useState('')
  const [attachments, setAttachments] = useState<CommandAttachment[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)

  const canSend =
    !isSubmitting && (prompt.trim().length > 0 || attachments.length > 0)

  function handleAddFiles(files: FileList | File[]) {
    setAttachments((current) => mergeAttachments(current, Array.from(files)))
  }

  function handleRemoveFile(id: string) {
    setAttachments((current) => current.filter((item) => item.id !== id))
  }

  function handleSubmit() {
    if (!canSend || isSubmitting) return

    onSubmit?.({
      prompt: prompt.trim(),
      files: attachments.map((item) => item.file),
      mode,
      ocrEnabled,
    })

    setPrompt('')
    setAttachments([])
  }

  return (
    <div
      className={cn(
        'border-border bg-surface shadow-panel flex w-full flex-col overflow-hidden rounded-2xl border',
        className,
      )}
    >
      {attachments.length > 0 ? (
        <div className="border-border/70 border-b px-4 py-3">
          <FileStackPreview items={attachments} onRemove={handleRemoveFile} />
        </div>
      ) : null}

      <div className="px-4 pt-4 pb-2">
      <label className="sr-only" htmlFor="command-input-textarea">
        Command input
      </label>
      <textarea
        id="command-input-textarea"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            handleSubmit()
          }
        }}
        rows={4}
        placeholder={PLACEHOLDER_COPY[mode]}
        className="text-foreground placeholder:text-subtle-foreground min-h-[6.5rem] w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
      />
      </div>

      <div className="border-border/70 flex items-center justify-between gap-2 border-t px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground rounded-full"
            aria-label="Attach files"
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon className="size-4" />
          </Button>

          <div className="relative">
            <Button
              ref={settingsButtonRef}
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground rounded-full"
              aria-label="Command settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((value) => !value)}
            >
              <Settings2Icon className="size-4" />
            </Button>
            <CommandSettingsPopover
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              anchorRef={settingsButtonRef}
            />
          </div>

          <button
            type="button"
            className="text-muted-foreground hover:text-foreground ml-1 inline-flex min-w-0 max-w-[9.5rem] items-center gap-1 truncate rounded-full border border-border/80 bg-muted/40 px-2 py-1 text-xs font-medium transition-colors sm:max-w-none"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <span className="truncate">{MODE_CHIP_LABEL[mode]}</span>
            <ChevronDownIcon className="size-3 shrink-0 opacity-60" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground px-1 text-xs font-medium transition-colors"
            onClick={() => openUploadPopup('rfp')}
          >
            Upload
          </button>
          <Button
            type="button"
            size="icon-sm"
            variant="default"
            className="bg-foreground text-background hover:bg-foreground/90 rounded-full"
            aria-label="Send command"
            disabled={!canSend}
            onClick={handleSubmit}
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT_STRING}
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) handleAddFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
