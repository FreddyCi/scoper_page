import {
  ArrowUpIcon,
  ChevronDownIcon,
  MicIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ChatComposerProps = {
  className?: string
}

/** Composer shell — wired to bitgpu in BDA-052 */
export function ChatComposer({ className }: ChatComposerProps) {
  return (
    <div
      className={cn(
        'rounded-control border-border bg-surface border p-3 shadow-sm',
        className,
      )}
    >
      <label className="sr-only" htmlFor="chat-composer-input">
        Ask the agent
      </label>
      <textarea
        id="chat-composer-input"
        rows={2}
        placeholder="Ask the agent… @ to mention"
        className="text-foreground placeholder:text-subtle-foreground w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="rounded-md"
          aria-haspopup="listbox"
        >
          Ask
          <ChevronDownIcon className="size-3.5 opacity-60" />
        </Button>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Voice input"
          >
            <MicIcon className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="default"
            className="rounded-full"
            aria-label="Send message"
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
