import { useCallback } from 'react'
import { ArrowLeftIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import {
  CommandInputCard,
  type CommandInputSubmitPayload,
} from '@/components/workspace/CommandInputCard'
import { CreepProfileGrid } from '@/components/workspace/CreepProfileGrid'
import { ResultsProfileGrid } from '@/components/workspace/ResultsProfileGrid'
import { RfpEvaluationPanel } from '@/components/workspace/RfpEvaluationPanel'
import { SplitDocumentView } from '@/components/workspace/SplitDocumentView'
import { WorkspaceLanding } from '@/components/workspace/WorkspaceLanding'
import { useCommandIngest } from '@/hooks/use-command-ingest'
import { useRelinkRfpProfilesOnView } from '@/hooks/use-relink-rfp-profiles'
import { useSessionStore, useShowLanding, useRfpProfiles, useCreepProfiles } from '@/store/session-store'
import type { WorkspaceMode } from '@/lib/types'

const MODE_COPY: Record<WorkspaceMode, string> = {
  rfp: 'RFP Analysis — qualify bidders against requirements with cited evidence.',
  proposal: 'Generate Complete Proposal — upload the RFP, add your company context, then build volume drafts tailored to the solicitation.',
}

/** Routes workspace body by session view */
export function WorkspaceContent() {
  const showLanding = useShowLanding()
  const workspaceView = useSessionStore((s) => s.workspaceView)
  const mode = useSessionStore((s) => s.mode)
  const activeDocId = useSessionStore((s) => s.activeDocId)
  const documents = useSessionStore((s) => s.documents)
  const setWorkspaceView = useSessionStore((s) => s.setWorkspaceView)
  const selectedCitation = useSessionStore((s) => s.selectedCitation)
  const profiles = useRfpProfiles()
  const creepProfiles = useCreepProfiles()
  const { submitCommand, isIngesting } = useCommandIngest()

  useRelinkRfpProfilesOnView(workspaceView === 'profiles' && mode === 'rfp')

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
      <div className="flex min-h-0 flex-1 flex-col px-[var(--spacing-panel)] py-4">
        <div className="mb-4 shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-foreground text-base font-semibold tracking-tight">
                {mode === 'rfp' ? 'RFP Analysis' : 'Generate Complete Proposal'}
              </h1>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{MODE_COPY[mode]}</p>
            </div>

            {documents.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => setWorkspaceView('split')}
              >
                <ArrowLeftIcon className="size-3.5" />
                Document view
              </Button>
            ) : null}
          </div>
        </div>

        {mode === 'rfp' ? (
          <ResizablePanelGroup
            orientation="horizontal"
            className="border-border min-h-0 flex-1 rounded-xl border"
          >
            <ResizablePanel defaultSize="52%" minSize="30%" className="min-h-0 min-w-0 p-4">
              <ResultsProfileGrid profiles={profiles} className="h-full min-h-0" />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize="48%" minSize="28%" className="min-h-0 min-w-0 p-4">
              <RfpEvaluationPanel className="h-full min-h-0" />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <CreepProfileGrid
            profiles={creepProfiles}
            documents={documents}
            className="min-h-0 flex-1"
          />
        )}
      </div>
    )
  }

  if (workspaceView === 'split') {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-[var(--spacing-panel)] py-4">
        {activeDoc ? (
          <SplitDocumentView document={activeDoc} initialPage={initialPage} className="min-h-0 flex-1" />
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
