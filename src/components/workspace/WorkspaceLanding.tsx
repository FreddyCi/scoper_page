import { useCallback } from 'react'

import {
  CommandInputCard,
  type CommandInputSubmitPayload,
} from '@/components/workspace/CommandInputCard'
import { QuickActionCards } from '@/components/workspace/QuickActionCards'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type WorkspaceLandingProps = {
  className?: string
}

export function WorkspaceLanding({ className }: WorkspaceLandingProps) {
  const sendChatPrompt = useSessionStore((s) => s.sendChatPrompt)

  const handleSubmit = useCallback(
    (payload: CommandInputSubmitPayload) => {
      if (payload.prompt.trim()) {
        sendChatPrompt(payload.prompt)
      }

      if (import.meta.env.DEV && payload.files.length > 0) {
        console.debug('[command-input] files attached (ingest BDA-024)', {
          fileNames: payload.files.map((file) => file.name),
          mode: payload.mode,
        })
      }
    },
    [sendChatPrompt],
  )

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center px-[var(--spacing-panel)] py-10',
        className,
      )}
    >
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <p className="text-subtle-foreground text-xs font-medium tracking-wide uppercase">
          Browser Doc Agent
        </p>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          What would you like to do?
        </h1>
        <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
          Upload procurement documents and analyse them locally — no server upload
          of file content.
        </p>
      </div>

      <QuickActionCards className="mt-10 sm:mt-12" />

      <CommandInputCard
        onSubmit={handleSubmit}
        className="mt-8 max-w-2xl"
      />
    </div>
  )
}
