import { useCallback } from 'react'

import {
  CommandInputCard,
  type CommandInputSubmitPayload,
} from '@/components/workspace/CommandInputCard'
import { WorkspaceLanding } from '@/components/workspace/WorkspaceLanding'
import { useCommandIngest } from '@/hooks/use-command-ingest'
import { useSessionStore, useShowLanding } from '@/store/session-store'
import type { WorkspaceMode } from '@/lib/types'

const MODE_COPY: Record<WorkspaceMode, string> = {
  rfp: 'RFP Analysis — qualify bidders against requirements with cited evidence.',
  scope_creep: 'Scope Creep — compare baseline vs change documents for drift flags.',
}

/** Routes workspace body by session view */
export function WorkspaceContent() {
  const showLanding = useShowLanding()
  const workspaceView = useSessionStore((s) => s.workspaceView)
  const mode = useSessionStore((s) => s.mode)
  const activeDocId = useSessionStore((s) => s.activeDocId)
  const documents = useSessionStore((s) => s.documents)
  const { submitCommand, isIngesting } = useCommandIngest()

  const activeDoc = documents.find((doc) => doc.doc_id === activeDocId)

  const handleCommandSubmit = useCallback(
    (payload: CommandInputSubmitPayload) => {
      void submitCommand(payload).catch((error) => {
        console.error('[command-ingest]', error)
      })
    },
    [submitCommand],
  )

  if (showLanding) {
    return <WorkspaceLanding />
  }

  if (workspaceView === 'profiles') {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-[var(--spacing-panel)] text-center text-sm">
        <p>{MODE_COPY[mode]}</p>
        <p className="text-subtle-foreground text-xs">Results profiles grid — BDA-041</p>
      </div>
    )
  }

  if (workspaceView === 'split') {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-[var(--spacing-panel)] text-center text-sm">
        <p>
          Viewing{' '}
          <span className="text-foreground font-medium">
            {activeDoc?.filename ?? 'document'}
          </span>
        </p>
        <p className="text-subtle-foreground text-xs">Split document view — BDA-032</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-[var(--spacing-panel)] py-8">
      <div className="mb-6 max-w-lg text-center">
        <p className="text-muted-foreground text-sm">{MODE_COPY[mode]}</p>
        {activeDoc ? (
          <p className="text-subtle-foreground mt-2 text-xs">
            Active document:{' '}
            <span className="text-foreground">{activeDoc.filename}</span>
          </p>
        ) : null}
      </div>

      <CommandInputCard
        onSubmit={handleCommandSubmit}
        isSubmitting={isIngesting}
        className="max-w-2xl"
      />
    </div>
  )
}
