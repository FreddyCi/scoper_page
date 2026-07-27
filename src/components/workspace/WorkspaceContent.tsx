import { useSessionStore } from '@/store/session-store'

/** Routes workspace body by session view — filled in by BDA-014+ */
export function WorkspaceContent() {
  const workspaceView = useSessionStore((s) => s.workspaceView)

  if (workspaceView === 'profiles') {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Results profiles grid — BDA-041
      </div>
    )
  }

  if (workspaceView === 'split') {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Split document view — BDA-032
      </div>
    )
  }

  return (
    <div className="text-muted-foreground flex flex-1 items-center justify-center px-[var(--spacing-panel)] text-center text-sm">
      Landing and command center — BDA-014
    </div>
  )
}
