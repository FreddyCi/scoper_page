import { useRef, useState } from 'react'
import { Link2Icon, Share2Icon, UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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
      setStatus(`Share link copied. Opens Scoper and loads workspace in this browser. ${link}`)
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="text-subtle-foreground hover:text-foreground h-7 px-2 text-xs font-normal"
          >
            <Share2Icon className="size-3.5" />
            Share
          </Button>
        }
      />

      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Share workspace</SheetTitle>
          <SheetDescription>
            Export an encrypted DuckDB snapshot, source documents, and session settings. Recipients
            open a Scoper link or import the `.scoper-share` file in their browser.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Export</h3>
            <p className="text-muted-foreground text-xs">
              Chat history is not included. Document bytes must still be in memory from upload.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || !hasDocuments}
                onClick={() => void handleExportAndDownload()}
              >
                <UploadIcon className="size-3.5" />
                Download pack
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || !hasDocuments}
                onClick={() => void handleCopyLink()}
              >
                <Link2Icon className="size-3.5" />
                Copy link
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Import</h3>
            <div className="space-y-2">
              <Label htmlFor="share-import-key">Share key</Label>
              <Input
                id="share-import-key"
                value={importKey}
                onChange={(event) => setImportKey(event.target.value)}
                placeholder="Base64 key from #share=id,key"
                autoComplete="off"
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
              onClick={() => fileInputRef.current?.click()}
            >
              Import `.scoper-share` file
            </Button>
          </section>

          {status ? <p className="text-muted-foreground text-xs">{status}</p> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
