import {
  BoxSelectIcon,
  CircleIcon,
  EraserIcon,
  Grid2X2Icon,
  HandIcon,
  HighlighterIcon,
  MicAudioLinesIcon,
  MessageSquareXIcon,
  MicOffIcon,
  PencilIcon,
  Redo2Icon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { PDF_MARKUP_TOOL_SHORTCUT_LABEL } from '@/lib/pdf-markup-tool-shortcuts'
import { VoiceNotationControl } from '@/components/workspace/voice-notation-control'

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
  selectionCount?: number
  onDeleteSelection?: () => void
  /** Exactly one selected mark has a saved voice notation (BDA-256). */
  canClearVoiceNotation?: boolean
  onClearVoiceNotation?: () => void
  /** Web Speech API available for hold-Space dictation (BDA-254). */
  speechNotesAvailable?: boolean
  notationPickMode?: boolean
  onNotationPickToggle?: () => void
  isDictating?: boolean
  voiceNoteCount?: number
  theme?: 'light' | 'dark'
  className?: string
}

type MarkupToolDef = {
  id: PdfMarkupTool
  label: string
  /** Extra line in hover tooltip; omit for single-line tips. */
  hint?: string
  icon: typeof PencilIcon
}

const MARKUP_TOOLS: MarkupToolDef[] = [
  {
    id: 'hand',
    label: 'Hand',
    hint: 'Drag a mark to move it on the page. Shortcut: H',
    icon: HandIcon,
  },
  {
    id: 'select',
    label: 'Select',
    hint: 'Click or drag a box to select marks. Delete removes the selection. Shortcut: V',
    icon: BoxSelectIcon,
  },
  { id: 'pen', label: 'Pen', hint: 'Draw freehand lines. Shortcut: P', icon: PencilIcon },
  {
    id: 'highlighter',
    label: 'Highlighter',
    hint: 'Draw semi-transparent strokes. Shortcut: L',
    icon: HighlighterIcon,
  },
  {
    id: 'eraser',
    label: 'Eraser',
    hint: 'Drag over marks to erase them. Shortcut: E',
    icon: EraserIcon,
  },
  {
    id: 'rect',
    label: 'Rectangle',
    hint: 'Drag to draw a rectangle outline. Shortcut: R',
    icon: SquareIcon,
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    hint: 'Drag to draw an ellipse outline. Shortcut: C',
    icon: CircleIcon,
  },
  {
    id: 'text',
    label: 'Text label',
    hint: 'Click, type, Enter to finish. Move with Hand (H). Shortcut: T',
    icon: TypeIcon,
  },
  {
    id: 'stamp',
    label: 'Window stamp',
    hint: 'Click to place a window marker on the plan. Shortcut: W',
    icon: Grid2X2Icon,
  },
]

function SelectToolTooltipContent({ speechNotesAvailable = true }: { speechNotesAvailable?: boolean }) {
  return (
    <>
      <span className="block font-medium">Select (V)</span>
      <span className="text-background/85 mt-0.5 block font-normal leading-snug">
        Click or drag a box to select marks. Delete removes the selection.
      </span>
      <span className="text-background/85 mt-1.5 flex items-start gap-1.5 font-normal leading-snug">
        {speechNotesAvailable ? (
          <MicAudioLinesIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
        ) : (
          <MicOffIcon className="mt-0.5 size-3 shrink-0 opacity-70" aria-hidden />
        )}
        <span>
          {speechNotesAvailable
            ? 'Toggle voice notation, click a mark, then hold Space to dictate.'
            : 'Voice notation requires HTTPS and Chrome or Edge speech support.'}
        </span>
      </span>
    </>
  )
}

function MarkupToolTooltipContent({ entry }: { entry: MarkupToolDef }) {
  const shortcut = PDF_MARKUP_TOOL_SHORTCUT_LABEL[entry.id]
  const title = shortcut ? `${entry.label} (${shortcut})` : entry.label
  if (!entry.hint) {
    return title
  }
  return (
    <>
      <span className="block font-medium">{title}</span>
      <span className="text-background/85 mt-0.5 block font-normal leading-snug">{entry.hint}</span>
    </>
  )
}

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
  selectionCount = 0,
  onDeleteSelection,
  canClearVoiceNotation = false,
  onClearVoiceNotation,
  speechNotesAvailable = true,
  notationPickMode = false,
  onNotationPickToggle,
  isDictating = false,
  voiceNoteCount = 0,
  theme = 'light',
  className,
}: PdfMarkupToolbarProps) {
  const isDark = theme === 'dark'
  const showStrokeWidth =
    tool !== 'eraser' &&
    tool !== 'text' &&
    tool !== 'stamp' &&
    tool !== 'hand' &&
    tool !== 'select'

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
          const showMicUnavailable = entry.id === 'select' && !speechNotesAvailable
          return (
            <Tooltip key={entry.id}>
              <TooltipTrigger
                delay={300}
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={entry.hint ? `${entry.label}. ${entry.hint}` : entry.label}
                    aria-pressed={active}
                    className={cn(toolButtonClass(active, isDark), showMicUnavailable && 'relative')}
                    onClick={() => onChange({ tool: entry.id })}
                  >
                    <Icon className="size-3.5" />
                    {showMicUnavailable ? (
                      <MicOffIcon
                        className="text-muted-foreground absolute -right-0.5 -bottom-0.5 size-2.5 opacity-80"
                        aria-hidden
                      />
                    ) : null}
                  </Button>
                }
              />
              <TooltipContent side="bottom" className="max-w-[15rem] text-left">
                {entry.id === 'select' ? (
                  <SelectToolTooltipContent speechNotesAvailable={speechNotesAvailable} />
                ) : (
                  <MarkupToolTooltipContent entry={entry} />
                )}
              </TooltipContent>
            </Tooltip>
          )
        })}
        {onNotationPickToggle ? (
          <VoiceNotationControl
            theme={theme}
            speechNotesAvailable={speechNotesAvailable}
            notationPickMode={notationPickMode}
            onNotationPickToggle={onNotationPickToggle}
            isDictating={isDictating}
            noteCount={voiceNoteCount}
            layout="toolbar"
          />
        ) : null}
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

      {onUndo ||
      onRedo ||
      (tool === 'select' && onDeleteSelection) ||
      onClearVoiceNotation ? (
        <>
          <ToolbarDivider isDark={isDark} />
          <div className="ml-auto flex items-center gap-0.5">
            {onClearVoiceNotation ? (
              <Tooltip>
                <TooltipTrigger
                  delay={300}
                  render={
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Clear voice notation"
                      disabled={!canClearVoiceNotation}
                      onClick={() => onClearVoiceNotation()}
                    >
                      <MessageSquareXIcon className="size-3.5" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom" className="max-w-[14rem] text-left">
                  <span className="block font-medium">Clear notation</span>
                  <span className="text-background/85 mt-0.5 block font-normal leading-snug">
                    Remove the saved voice note from the selected mark.
                  </span>
                </TooltipContent>
              </Tooltip>
            ) : null}
            {tool === 'select' && onDeleteSelection ? (
              <Tooltip>
                <TooltipTrigger
                  delay={300}
                  render={
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Delete selected marks"
                      disabled={selectionCount <= 0}
                      onClick={() => onDeleteSelection()}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom">Delete selected marks</TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger
                delay={300}
                render={
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
                }
              />
              <TooltipContent side="bottom">Undo (⌘Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                delay={300}
                render={
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
                }
              />
              <TooltipContent side="bottom">Redo (⌘⇧Z)</TooltipContent>
            </Tooltip>
          </div>
        </>
      ) : null}
    </div>
  )
}
