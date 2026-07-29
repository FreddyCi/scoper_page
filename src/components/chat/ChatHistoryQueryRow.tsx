import { MessageSquareTextIcon } from 'lucide-react'
import type { KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

type ChatHistoryQueryRowProps = {
  label: string
  className?: string
  onSelect: () => void
}

export function ChatHistoryQueryRow({ label, className, onSelect }: ChatHistoryQueryRowProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open chat query: ${label}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
        'border-border/70 bg-workspace-muted/50 hover:border-sky-300 hover:bg-sky-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      <MessageSquareTextIcon className="text-sky-600 mt-0.5 size-4 shrink-0" />
      <p className="text-foreground text-xs leading-relaxed font-medium">{label}</p>
    </div>
  )
}
