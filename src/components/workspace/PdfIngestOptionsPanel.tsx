import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type PdfIngestOptionsPanelProps = {
  disabled?: boolean
  className?: string
}

/** Shared PDF upload toggles — preview-only ingest + OCR (session-backed). */
export function PdfIngestOptionsPanel({ disabled = false, className }: PdfIngestOptionsPanelProps) {
  const ocrEnabled = useSessionStore((s) => s.ocrEnabled)
  const setOcrEnabled = useSessionStore((s) => s.setOcrEnabled)
  const skipPdfTextExtractOnIngest = useSessionStore((s) => s.skipPdfTextExtractOnIngest)
  const setSkipPdfTextExtractOnIngest = useSessionStore((s) => s.setSkipPdfTextExtractOnIngest)

  const previewOnlyId = 'pdf-ingest-preview-only'
  const ocrId = 'pdf-ingest-ocr'

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <Label
          htmlFor={previewOnlyId}
          className="text-muted-foreground cursor-pointer text-xs leading-relaxed font-normal"
        >
          Preview only (skip text extract) — for plan/drawing PDFs you mark in{' '}
          <span className="text-foreground font-medium">Original</span>. Skips LiteParse; much
          faster than full parse.
        </Label>
        <Switch
          id={previewOnlyId}
          checked={skipPdfTextExtractOnIngest}
          onCheckedChange={setSkipPdfTextExtractOnIngest}
          disabled={disabled}
          aria-label="Preview only PDF ingest"
        />
      </div>

      <div
        className={cn(
          'flex items-center justify-between gap-3',
          skipPdfTextExtractOnIngest && 'opacity-50',
        )}
      >
        <Label
          htmlFor={ocrId}
          className={cn(
            'text-muted-foreground text-xs font-normal',
            skipPdfTextExtractOnIngest ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          OCR for scanned PDFs
        </Label>
        <Switch
          id={ocrId}
          checked={ocrEnabled}
          onCheckedChange={setOcrEnabled}
          disabled={disabled || skipPdfTextExtractOnIngest}
          aria-label="OCR for scanned PDFs"
        />
      </div>
    </div>
  )
}
