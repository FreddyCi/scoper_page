import { MicAudioLinesIcon, MicOffIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type VoiceNotationControlProps = {
  speechNotesAvailable?: boolean
  notationPickMode?: boolean
  onNotationPickToggle?: () => void
  isDictating?: boolean
  noteCount?: number
  theme?: 'light' | 'dark'
  /** Compact icon for toolbar vs floating pill on the PDF canvas. */
  layout?: 'toolbar' | 'canvas'
  className?: string
}

function VoiceNotationTooltipContent({ speechNotesAvailable = true }: { speechNotesAvailable?: boolean }) {
  return (
    <>
      <span className="block font-medium">Voice notation</span>
      <span className="text-background/85 mt-0.5 block font-normal leading-snug">
        {speechNotesAvailable
          ? 'Open the notation list to type or dictate. Click again to close. Click a mark on the plan to target it.'
          : 'Voice notation requires HTTPS and Chrome or Edge speech support.'}
      </span>
    </>
  )
}

export function VoiceNotationControl({
  speechNotesAvailable = true,
  notationPickMode = false,
  onNotationPickToggle,
  isDictating = false,
  noteCount = 0,
  theme = 'light',
  layout = 'toolbar',
  className,
}: VoiceNotationControlProps) {
  const isDark = theme === 'dark'
  const active = notationPickMode || isDictating
  const isCanvas = layout === 'canvas'

  if (!onNotationPickToggle) {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger
        delay={300}
        render={
          <Button
            type="button"
            size={isCanvas ? 'sm' : 'icon-xs'}
            variant="ghost"
            aria-label={
              speechNotesAvailable
                ? 'Voice notation. Open the list to type or dictate. Click again to close.'
                : 'Voice notation unavailable. Requires HTTPS and Chrome or Edge speech support.'
            }
            aria-pressed={active}
            className={cn(
              'relative',
              isCanvas
                ? cn(
                    'border-border bg-surface text-foreground shadow-panel gap-1.5 border pr-3 hover:bg-muted/60',
                    active && 'ring-1 ring-sky-400/60 bg-sky-50',
                  )
                : cn(
                    active && 'bg-muted ring-1 ring-primary/50',
                    isDark && active && 'bg-zinc-800 ring-sky-500/40',
                    isDark && 'text-zinc-300 hover:bg-zinc-700 hover:text-zinc-50',
                  ),
              className,
            )}
            onClick={() => onNotationPickToggle()}
          >
            <MicAudioLinesIcon
              className={cn(
                isCanvas ? 'size-4 text-sky-600' : 'size-3.5',
                isDictating && 'animate-pulse',
              )}
            />
            {isCanvas ? <span className="text-xs font-medium">Voice notation</span> : null}
            {noteCount > 0 ? (
              <span
                className={cn(
                  'bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full text-[9px] font-semibold leading-none',
                  isCanvas && 'static ml-0.5 size-4 text-[10px]',
                )}
              >
                {noteCount > 9 ? '9+' : noteCount}
              </span>
            ) : null}
            {!speechNotesAvailable ? (
              <MicOffIcon
                className={cn(
                  'text-muted-foreground',
                  isCanvas ? 'size-3.5' : 'absolute -right-0.5 -bottom-0.5 size-2.5 opacity-80',
                )}
                aria-hidden
              />
            ) : null}
          </Button>
        }
      />
      <TooltipContent side={isCanvas ? 'left' : 'bottom'} className="max-w-[15rem] text-left">
        <VoiceNotationTooltipContent speechNotesAvailable={speechNotesAvailable} />
      </TooltipContent>
    </Tooltip>
  )
}
