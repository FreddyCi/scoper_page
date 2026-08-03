import {
  CircleIcon,
  EraserIcon,
  Grid2X2Icon,
  HighlighterIcon,
  PencilIcon,
  Redo2Icon,
  SquareIcon,
  TypeIcon,
  Undo2Icon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Mark tools including eraser (UI-only; not persisted as `PdfDrawingTool`). */
export type PdfMarkupTool = import('@/lib/types').PdfMarkSessionTool

export const PDF_MARKUP_COLOR_AMBER = '#F59E0B'
export const PDF_MARKUP_COLOR_ROSE = '#E11D48'
export const PDF_MARKUP_COLOR_SKY = '#0EA5E9'
export const PDF_MARKUP_COLOR_NEUTRAL = '#71717A'

export const PDF_MARKUP_COLOR_SWATCHES = [
  { value: PDF_MARKUP_COLOR_AMBER, label: 'Amber' },
  { value: PDF_MARKUP_COLOR_ROSE, label: 'Rose' },
  { value: PDF_MARKUP_COLOR_SKY, label: 'Sky' },
  { value: PDF_MARKUP_COLOR_NEUTRAL, label: 'Gray' },
] as const

export const PDF_MARKUP_STROKE_WIDTHS = [2, 4, 8] as const

export type PdfMarkupStrokeWidth = (typeof PDF_MARKUP_STROKE_WIDTHS)[number]

export type PdfMarkupToolbarChange = {
  tool?: PdfMarkupTool
  color?: string
  strokeWidth?: PdfMarkupStrokeWidth
}

export type PdfMarkupToolbarProps = {
  tool: PdfMarkupTool
  color: string
  strokeWidth: PdfMarkupStrokeWidth
  onChange: (change: PdfMarkupToolbarChange) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  theme?: 'light' | 'dark'
  className?: string
}

type MarkupToolDef = {
  id: PdfMarkupTool
  label: string
  icon: typeof PencilIcon
}

const MARKUP_TOOLS: MarkupToolDef[] = [
  { id: 'pen', label: 'Pen', icon: PencilIcon },
  { id: 'highlighter', label: 'Highlighter', icon: HighlighterIcon },
  { id: 'eraser', label: 'Eraser', icon: EraserIcon },
  { id: 'rect', label: 'Rectangle', icon: SquareIcon },
  { id: 'ellipse', label: 'Ellipse', icon: CircleIcon },
  { id: 'text', label: 'Text label', icon: TypeIcon },
  { id: 'stamp', label: 'Window stamp', icon: Grid2X2Icon },
]

function ToolbarDivider({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={cn('mx-0.5 h-6 w-px shrink-0', isDark ? 'bg-zinc-700' : 'bg-border')}
      aria-hidden
    />
  )
}

function toolButtonClass(active: boolean, isDark: boolean): string {
  return cn(
    active && 'ring-1 ring-primary/50 bg-muted',
    isDark && active && 'bg-zinc-800 ring-sky-500/40',
  )
}

export function PdfMarkupToolbar({
  tool,
  color,
  strokeWidth,
  onChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  theme = 'light',
  className,
}: PdfMarkupToolbarProps) {
  const isDark = theme === 'dark'
  const showStrokeWidth = tool !== 'eraser' && tool !== 'text' && tool !== 'stamp'

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 px-3 py-2',
        isDark ? 'text-zinc-100' : 'text-foreground',
        className,
      )}
      role="toolbar"
      aria-label="PDF markup tools"
    >
      <div
        data-slot="button-group"
        className={cn(
          'flex flex-wrap items-center gap-0.5 rounded-lg p-0.5',
          isDark ? 'bg-zinc-800/80' : 'bg-muted/40',
        )}
      >
        {MARKUP_TOOLS.map((entry) => {
          const Icon = entry.icon
          const active = tool === entry.id
          return (
            <Button
              key={entry.id}
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={entry.label}
              aria-pressed={active}
              className={toolButtonClass(active, isDark)}
              onClick={() => onChange({ tool: entry.id })}
            >
              <Icon className="size-3.5" />
            </Button>
          )
        })}
      </div>

      <ToolbarDivider isDark={isDark} />

      <div
        className="flex items-center gap-1.5"
        role="group"
        aria-label="Markup color"
      >
        {PDF_MARKUP_COLOR_SWATCHES.map((swatch) => {
          const active = color.toLowerCase() === swatch.value.toLowerCase()
          return (
            <button
              key={swatch.value}
              type="button"
              aria-label={swatch.label}
              aria-pressed={active}
              title={swatch.label}
              className={cn(
                'size-5 shrink-0 rounded-full border-2 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active ? 'border-foreground ring-2 ring-primary/40' : 'border-transparent',
                isDark ? 'ring-offset-zinc-900' : 'ring-offset-background',
              )}
              style={{ backgroundColor: swatch.value }}
              onClick={() => onChange({ color: swatch.value })}
            />
          )
        })}
      </div>

      {showStrokeWidth ? (
        <>
          <ToolbarDivider isDark={isDark} />
          <div
            className={cn(
              'flex items-center gap-0.5 rounded-lg p-0.5',
              isDark ? 'bg-zinc-800/80' : 'bg-muted/40',
            )}
            role="group"
            aria-label="Stroke width"
          >
            {PDF_MARKUP_STROKE_WIDTHS.map((width) => {
              const active = strokeWidth === width
              return (
                <Button
                  key={width}
                  type="button"
                  size="xs"
                  variant="ghost"
                  aria-pressed={active}
                  className={cn(
                    'min-w-7 tabular-nums',
                    toolButtonClass(active, isDark),
                  )}
                  onClick={() => onChange({ strokeWidth: width })}
                >
                  {width}
                </Button>
              )
            })}
          </div>
        </>
      ) : null}

      {onUndo || onRedo ? (
        <>
          <ToolbarDivider isDark={isDark} />
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Undo markup"
              disabled={!canUndo}
              onClick={() => onUndo?.()}
            >
              <Undo2Icon className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Redo markup"
              disabled={!canRedo}
              onClick={() => onRedo?.()}
            >
              <Redo2Icon className="size-3.5" />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
