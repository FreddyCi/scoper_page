import { useRef, useState } from 'react'
import {
  DownloadIcon,
  Link2Icon,
  LockIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BrandMenuSection,
  BrandMenuSectionHeader,
} from '@/components/ui/brand-menu'
import { cn } from '@/lib/utils'
import { SCOUT_TARGETS, scoutTargetProps } from '@/lib/scout/targets'
import {
  copyShareLink,
  downloadSharePackFile,
  exportEncryptedSharePack,
} from '@/services/share-pack-export'
import { importSharePackFromFile } from '@/services/share-pack-import'
import { useSessionStore } from '@/store/session-store'

type ShareWorkspaceSheetProps = {
  disabled?: boolean
}

export function ShareWorkspaceSheet({ disabled = false }: ShareWorkspaceSheetProps) {
  const hasDocuments = useSessionStore((state) => state.documents.length > 0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [importKey, setImportKey] = useState('')

  async function handleExportAndDownload() {
    setBusy(true)
    setStatus(null)
    try {
      const summary = await exportEncryptedSharePack()
      await downloadSharePackFile(summary)
      setStatus(`Downloaded encrypted share pack (${summary.documentCount} documents).`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyLink() {
    setBusy(true)
    setStatus(null)
    try {
      const summary = await exportEncryptedSharePack()
      const link = await copyShareLink(summary)
      setStatus(`Share link copied — opens Scoper and loads in the browser. ${link}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Copy link failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(file: File) {
    const key = importKey.trim()
    if (!key) {
      setStatus('Paste the share key from the link (after the comma) before importing.')
      return
    }

    setBusy(true)
    setStatus(null)
    try {
      const payload = await importSharePackFromFile(file, key)
      setStatus(
        `Imported ${payload.documents.length} documents and ${Object.values(payload.tables).reduce(
          (total, rows) => total + rows.length,
          0,
        )} DuckDB rows.`,
      )
      setOpen(false)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="text-subtle-foreground hover:text-foreground h-7 rounded-full px-2.5 text-xs font-normal"
          >
            <UploadIcon className="size-3.5" />
            Share
          </Button>
        }
      />

      <DrawerContent
        className={cn(
          'border-border bg-workspace text-foreground shadow-elevated',
          '[--drawer-inset:var(--spacing-shell)] [--drawer-bleed-background:var(--color-workspace)]',
          'data-[swipe-direction=right]:rounded-l-[1.75rem] data-[swipe-direction=right]:border-l',
          'data-[swipe-direction=right]:sm:[--drawer-content-width:26rem]',
        )}
      >
        <DrawerHeader className="relative gap-3 px-5 pt-5 pb-2">
          <DrawerClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-4 right-4 rounded-full"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DrawerClose>

          <div className="flex items-start gap-3 pr-10">
            <div className="border-sky-200/80 bg-surface shadow-panel flex size-11 shrink-0 items-center justify-center rounded-2xl border">
              <img src="/scoper-logo.svg" alt="" width={24} height={24} className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <DrawerTitle className="text-lg tracking-tight">Share workspace</DrawerTitle>
              <DrawerDescription className="text-muted-foreground text-xs leading-relaxed">
                Encrypted Local DB snapshot, source documents, and session settings — loaded entirely
                in the browser.
              </DrawerDescription>
            </div>
          </div>

          <div className="border-sky-200/70 bg-sky-50/70 text-sky-950 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 mt-4 text-[11px] font-medium">
            <LockIcon className="size-3" />
            End-to-end encrypted
          </div>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-3 pb-5">
          <div {...scoutTargetProps(SCOUT_TARGETS.shareWorkspaceExport)}>
            <BrandMenuSection accent="sky" className="rounded-2xl p-4">
              <BrandMenuSectionHeader
                accent="sky"
                title="Export"
                description="Chat history is not included. Document bytes must still be in memory from upload."
              />
              <div className="flex flex-wrap gap-2 px-3 pb-3">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !hasDocuments}
                  className="rounded-full bg-sky-950 text-white hover:bg-sky-900"
                  onClick={() => void handleExportAndDownload()}
                >
                  <DownloadIcon className="size-3.5" />
                  Download pack
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !hasDocuments}
                  className="border-sky-200 bg-white/80 text-sky-950 hover:bg-sky-50 rounded-full"
                  onClick={() => void handleCopyLink()}
                >
                  <Link2Icon className="size-3.5" />
                  Copy link
                </Button>
              </div>
            </BrandMenuSection>
          </div>

          <BrandMenuSection accent="violet" className="rounded-2xl p-4">
            <BrandMenuSectionHeader
              accent="violet"
              title="Import"
              description="Paste the key from a share link, then choose the `.scoper-share` file."
            />
            <div className="space-y-3 px-3 pb-3">
              <div className="space-y-1.5">
                <Label htmlFor="share-import-key" className="text-violet-950 text-xs font-medium">
                  Share key
                </Label>
                <Input
                  id="share-import-key"
                  value={importKey}
                  onChange={(event) => setImportKey(event.target.value)}
                  placeholder="Base64 key from #share=id,key"
                  autoComplete="off"
                  className="border-violet-200/80 bg-white/90 rounded-xl"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".scoper-share,application/octet-stream"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void handleImportFile(file)
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className="border-violet-200 bg-white/80 text-violet-950 hover:bg-violet-50 w-full rounded-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="size-3.5" />
                Import `.scoper-share` file
              </Button>
            </div>
          </BrandMenuSection>

          {status ? (
            <p className="border-border/80 bg-surface text-muted-foreground rounded-2xl border px-3 py-2.5 text-xs leading-relaxed">
              {status}
            </p>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
