import { CircleCheckIcon, CircleIcon, FileSearchIcon, PenLineIcon } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { featureCardDescriptionClass, featureCardTitleClass } from '@/components/workspace/feature-card-styles'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type PdfIngestMode = 'extract' | 'marking'

type PdfIngestOptionsPanelProps = {
  disabled?: boolean
  className?: string
  /** Section label — omit in tight layouts (e.g. command settings). */
  showHeading?: boolean
}

const PDF_INGEST_MODES: {
  id: PdfIngestMode
  title: string
  description: string
  icon: typeof FileSearchIcon
}[] = [
  {
    id: 'extract',
    title: 'Extract text for review',
    description:
      'For RFPs, contracts, and bidder responses — reads the PDF so you can search, qualify, and cite clauses.',
    icon: FileSearchIcon,
  },
  {
    id: 'marking',
    title: 'Open for marking',
    description:
      'For drawings and floor plans — loads fast so you can stamp, takeoff, and annotate in Mark mode.',
    icon: PenLineIcon,
  },
]

/** Two-column PDF ingest mode — extract text vs open for marking (session-backed). */
export function PdfIngestOptionsPanel({
  disabled = false,
  className,
  showHeading = true,
}: PdfIngestOptionsPanelProps) {
  const ocrEnabled = useSessionStore((s) => s.ocrEnabled)
  const setOcrEnabled = useSessionStore((s) => s.setOcrEnabled)
  const skipPdfTextExtractOnIngest = useSessionStore((s) => s.skipPdfTextExtractOnIngest)
  const setSkipPdfTextExtractOnIngest = useSessionStore((s) => s.setSkipPdfTextExtractOnIngest)

  const activeMode: PdfIngestMode = skipPdfTextExtractOnIngest ? 'marking' : 'extract'
  const ocrId = 'pdf-ingest-ocr'

  function selectMode(mode: PdfIngestMode) {
    if (disabled) return
    setSkipPdfTextExtractOnIngest(mode === 'marking')
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showHeading ? (
        <p className="text-foreground text-sm font-medium">How should we handle PDFs?</p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PDF_INGEST_MODES.map((mode) => {
          const selected = activeMode === mode.id
          const Icon = mode.icon

          return (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => selectMode(mode.id)}
              className={cn(
                'border-border/70 relative rounded-xl border px-3 py-3 text-left transition-[border-color,box-shadow]',
                selected
                  ? 'border-primary/40 bg-primary/5 ring-primary/35 ring-2'
                  : 'bg-workspace/40 hover:border-border',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              )}
            >
              {selected ? (
                <CircleCheckIcon
                  className="text-primary absolute top-2.5 right-2.5 size-4"
                  aria-hidden
                />
              ) : (
                <CircleIcon
                  className="text-muted-foreground/45 absolute top-2.5 right-2.5 size-4"
                  aria-hidden
                />
              )}
              <div className="flex items-start gap-2.5 pr-5">
                <span
                  className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface',
                    selected && 'border-primary/30',
                  )}
                >
                  <Icon className="text-muted-foreground size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className={cn(featureCardTitleClass, 'text-base text-left')}>{mode.title}</p>
                  <p className={cn(featureCardDescriptionClass, 'mt-1 text-left text-xs')}>
                    {mode.description}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {activeMode === 'extract' ? (
        <div className="border-border/70 bg-workspace/40 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
          <Label
            htmlFor={ocrId}
            className="text-muted-foreground cursor-pointer text-xs leading-relaxed font-normal"
          >
            <span className="text-foreground font-medium">Scanned pages</span>
            <span className="mt-0.5 block">
              Run OCR when the PDF is a scan or fax — not needed for digital exports.
            </span>
          </Label>
          <Switch
            id={ocrId}
            checked={ocrEnabled}
            onCheckedChange={setOcrEnabled}
            disabled={disabled}
            aria-label="OCR scanned PDF pages"
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Marking mode skips text extraction — use{' '}
          <span className="text-foreground font-medium">Original</span> view to place stamps on the
          drawing.
        </p>
      )}
    </div>
  )
}
