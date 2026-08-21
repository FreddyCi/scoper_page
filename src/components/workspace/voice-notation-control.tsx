import { MicAudioLinesIcon, MicOffIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type VoiceNotationControlProps = {
  speechNotesAvailable?: boolean
  notationPickMode?: boolean
  onNotationPickToggle?: () => void
  isDictating?: boolean
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
          ? 'Toggle on, click a mark or shape, then hold Space while you speak.'
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
            aria-label="Pick a mark for voice notation"
            aria-pressed={active}
            className={cn(
              'relative',
              active && 'bg-muted ring-1 ring-primary/50',
              isDark && active && 'bg-zinc-800 ring-sky-500/40',
              isDark && 'hover:bg-zinc-800 hover:text-zinc-100',
              isCanvas && 'shadow-panel gap-1.5 pr-3',
              isCanvas && isDark && 'bg-zinc-800 text-zinc-100',
              className,
            )}
            onClick={() => onNotationPickToggle()}
          >
            <MicAudioLinesIcon
              className={cn(isCanvas ? 'size-4' : 'size-3.5', isDictating && 'animate-pulse')}
            />
            {isCanvas ? <span className="text-xs font-medium">Voice notation</span> : null}
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
