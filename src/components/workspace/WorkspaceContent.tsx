import { useCallback } from 'react'

import {
  CommandInputCard,
  type CommandInputSubmitPayload,
} from '@/components/workspace/CommandInputCard'
import { DocumentViewer } from '@/components/workspace/DocumentViewer'
import { ExtractedTextPane } from '@/components/workspace/ExtractedTextPane'
import { WorkspaceLanding } from '@/components/workspace/WorkspaceLanding'
import { useCommandIngest } from '@/hooks/use-command-ingest'
import { useSessionStore, useShowLanding } from '@/store/session-store'
import type { WorkspaceMode } from '@/lib/types'
import { Button } from '@/components/ui/button'

const MODE_COPY: Record<WorkspaceMode, string> = {
  rfp: 'RFP Analysis — qualify bidders against requirements with cited evidence.',
  scope_creep: 'Scope Creep — compare baseline vs change documents for drift flags.',
}

/** Routes workspace body by session view */
export function WorkspaceContent() {
  const showLanding = useShowLanding()
  const workspaceView = useSessionStore((s) => s.workspaceView)
  const setWorkspaceView = useSessionStore((s) => s.setWorkspaceView)
  const mode = useSessionStore((s) => s.mode)
  const activeDocId = useSessionStore((s) => s.activeDocId)
  const documents = useSessionStore((s) => s.documents)
  const selectedCitation = useSessionStore((s) => s.selectedCitation)
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

  const initialPage =
    activeDoc &&
    selectedCitation?.doc_id === activeDoc.doc_id &&
    selectedCitation.page_num != null
      ? selectedCitation.page_num
      : 1

  if (showLanding) {
    return <WorkspaceLanding />
  }

  if (workspaceView === 'profiles') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-[var(--spacing-panel)] py-4">
        <div className="text-muted-foreground shrink-0 text-center text-sm">
          <p>{MODE_COPY[mode]}</p>
          <p className="text-subtle-foreground mt-1 text-xs">Results profiles grid — BDA-041</p>
        </div>

        {activeDoc ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-foreground text-sm font-medium">{activeDoc.filename}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setWorkspaceView('split')}
              >
                Split view
              </Button>
            </div>
            <DocumentViewer
              document={activeDoc}
              initialPage={initialPage}
              className="min-h-[24rem] flex-1"
            />
          </div>
        ) : null}
      </div>
    )
  }

  if (workspaceView === 'split') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-[var(--spacing-panel)] py-4">
        {activeDoc ? (
          <>
            <p className="text-muted-foreground shrink-0 text-sm">
              Viewing{' '}
              <span className="text-foreground font-medium">{activeDoc.filename}</span>
            </p>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
              <ExtractedTextPane docId={activeDoc.doc_id} className="min-h-[20rem]" />
              <DocumentViewer
                document={activeDoc}
                initialPage={initialPage}
                className="min-h-[20rem]"
              />
            </div>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
            Select a document tab to preview.
          </div>
        )}
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
