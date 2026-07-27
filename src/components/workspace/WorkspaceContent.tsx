import { useSessionStore } from '@/store/session-store'
import type { WorkspaceMode } from '@/lib/types'

const MODE_COPY: Record<WorkspaceMode, string> = {
  rfp: 'RFP Analysis — qualify bidders against requirements with cited evidence.',
  scope_creep: 'Scope Creep — compare baseline vs change documents for drift flags.',
}

/** Routes workspace body by session view — filled in by BDA-014+ */
export function WorkspaceContent() {
  const workspaceView = useSessionStore((s) => s.workspaceView)
  const mode = useSessionStore((s) => s.mode)
  const activeDocId = useSessionStore((s) => s.activeDocId)
  const documents = useSessionStore((s) => s.documents)

  const activeDoc = documents.find((doc) => doc.doc_id === activeDocId)

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
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-[var(--spacing-panel)] text-center text-sm">
      <p>{MODE_COPY[mode]}</p>
      {activeDoc ? (
        <p className="text-subtle-foreground text-xs">
          Active document: <span className="text-foreground">{activeDoc.filename}</span>
        </p>
      ) : (
        <p className="text-subtle-foreground text-xs">Landing and command center — BDA-014</p>
      )}
    </div>
  )
}
