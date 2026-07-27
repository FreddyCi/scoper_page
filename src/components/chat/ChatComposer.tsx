import { useState } from 'react'
import {
  ArrowUpIcon,
  ChevronDownIcon,
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

  function handleSend() {
    if (!draft.trim()) return
    sendChatPrompt(draft)
    setDraft('')
  }

  return (
    <div
      className={cn(
        'rounded-composer border-border bg-workspace-muted/80 flex flex-col border',
        className,
      )}
    >
      <label className="sr-only" htmlFor="chat-composer-input">
        Ask the agent
      </label>
      <textarea
        id="chat-composer-input"
        rows={3}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            handleSend()
          }
        }}
        placeholder="Ask the agent… / for skills, @ for context"
        className="text-foreground placeholder:text-subtle-foreground min-h-[5.5rem] w-full resize-none bg-transparent px-3.5 pt-3.5 pb-2 text-sm leading-relaxed outline-none"
      />

      <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="border-border bg-surface text-foreground hover:bg-surface/90 inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors"
            aria-haspopup="listbox"
          >
            <SparklesIcon className="size-3.5 opacity-80" />
            Agent
            <ChevronDownIcon className="size-3 opacity-60" />
          </button>

          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1 truncate text-xs transition-colors"
            aria-haspopup="listbox"
          >
            <span className="truncate">Bonsai 1.7B</span>
            <ChevronDownIcon className="size-3 shrink-0 opacity-60" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Attach files"
          >
            <PaperclipIcon className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="default"
            className="bg-foreground text-background hover:bg-foreground/90 rounded-full"
            aria-label="Send message"
            disabled={!draft.trim()}
            onClick={handleSend}
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
