import { useState } from 'react'
import {
  ArrowUpIcon,
  ChevronDownIcon,
  MicIcon,
  PaperclipIcon,
  SparklesIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type ChatComposerProps = {
  className?: string
}

/** Composer shell — wired to bitgpu in BDA-052 */
export function ChatComposer({ className }: ChatComposerProps) {
  const sendChatPrompt = useSessionStore((s) => s.sendChatPrompt)
  const [draft, setDraft] = useState('')

  const canSend = draft.trim().length > 0

  function handleSend() {
    if (!canSend) return
    sendChatPrompt(draft)
    setDraft('')
  }

  return (
    <div
      className={cn(
        'border-border bg-workspace-muted/70 flex flex-col overflow-hidden rounded-2xl border',
        className,
      )}
    >
      {/* Level 1 — prompt */}
      <div className="px-4 pt-4 pb-2">
        <label className="sr-only" htmlFor="chat-composer-input">
          Ask the agent
        </label>
        <textarea
          id="chat-composer-input"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask the agent… / for skills, @ for context"
          className="text-foreground placeholder:text-subtle-foreground min-h-[5rem] w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
        />
      </div>

      {/* Level 2 — toolbar */}
      <div className="border-border/70 flex items-center justify-between gap-2 border-t px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="border-border/80 bg-surface text-foreground hover:bg-surface/90 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
            aria-haspopup="listbox"
          >
            <SparklesIcon className="size-3.5 opacity-80" />
            Agent
            <ChevronDownIcon className="size-3 opacity-60" />
          </button>

          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1 truncate rounded-full px-1.5 py-1 text-xs transition-colors hover:bg-black/[0.04]"
            aria-haspopup="listbox"
          >
            <span className="truncate">Bonsai 1.7B</span>
            <ChevronDownIcon className="size-3 shrink-0 opacity-60" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground rounded-full"
            aria-label="Attach files"
          >
            <PaperclipIcon className="size-4" />
          </Button>

          {canSend ? (
            <Button
              type="button"
              size="icon-sm"
              variant="default"
              className="bg-foreground text-background hover:bg-foreground/90 rounded-full"
              aria-label="Send message"
              onClick={handleSend}
            >
              <ArrowUpIcon className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon-sm"
              variant="default"
              className="bg-foreground text-background hover:bg-foreground/90 rounded-full"
              aria-label="Voice input"
            >
              <MicIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
