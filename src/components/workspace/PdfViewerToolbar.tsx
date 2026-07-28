import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PdfViewerToolbarProps = {
  filename: string
  page: number
  totalPages: number
  scale: number
  onPageChange: (page: number) => void
  onScaleChange: (scale: number) => void
  theme?: 'light' | 'dark'
  className?: string
}

function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1
  return Math.min(Math.max(page, 1), totalPages)
}

export function PdfViewerToolbar({
  filename,
  page,
  totalPages,
  scale,
  onPageChange,
  onScaleChange,
  theme = 'light',
  className,
}: PdfViewerToolbarProps) {
  const currentPage = clampPage(page, totalPages)
  const isDark = theme === 'dark'

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b px-3 py-2',
        isDark
          ? 'border-zinc-700 bg-zinc-900 text-zinc-100'
          : 'border-border bg-surface',
        className,
      )}
    >
      <p
        className={cn(
          'mr-auto min-w-0 truncate text-sm font-medium',
          isDark ? 'text-zinc-100' : 'text-foreground',
        )}
      >
        {filename}
      </p>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>

        <label
          className={cn(
            'flex items-center gap-1 text-xs',
            isDark ? 'text-zinc-400' : 'text-muted-foreground',
          )}
        >
          <span className="sr-only">Page number</span>
          <input
            type="number"
            min={1}
            max={Math.max(totalPages, 1)}
            value={currentPage}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10)
              if (Number.isFinite(next)) onPageChange(next)
            }}
            className={cn(
              'w-12 rounded-md border px-1.5 py-1 text-center text-xs tabular-nums',
              isDark
                ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                : 'border-border bg-background text-foreground',
            )}
          />
          <span>/ {Math.max(totalPages, 1)}</span>
        </label>

        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Next page"
          disabled={totalPages === 0 || currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Zoom out"
          disabled={scale <= 0.5}
          onClick={() => onScaleChange(Math.max(0.5, Math.round((scale - 0.25) * 100) / 100))}
        >
          <ZoomOutIcon className="size-4" />
        </Button>
        <span
          className={cn(
            'w-12 text-center text-xs tabular-nums',
            isDark ? 'text-zinc-400' : 'text-muted-foreground',
          )}
        >
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Zoom in"
          disabled={scale >= 3}
          onClick={() => onScaleChange(Math.min(3, Math.round((scale + 0.25) * 100) / 100))}
        >
          <ZoomInIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
