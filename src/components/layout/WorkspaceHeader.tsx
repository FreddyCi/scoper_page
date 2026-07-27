import { ChevronDownIcon, MessageSquareIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { shellWorkspaceColumnClass } from '@/components/layout/shell-layout'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'
import type { WorkspaceMode } from '@/lib/types'

type WorkspaceHeaderProps = {
  chatCollapsed: boolean
  className?: string
}

const MODE_LABELS: Record<WorkspaceMode, string> = {
  rfp: 'RFP Analysis',
  scope_creep: 'Scope Creep',
}

export function WorkspaceHeader({ chatCollapsed, className }: WorkspaceHeaderProps) {
  const sessionName = useSessionStore((s) => s.sessionName)
  const mode = useSessionStore((s) => s.mode)
  const setMode = useSessionStore((s) => s.setMode)
  const toggleChatCollapsed = useSessionStore((s) => s.toggleChatCollapsed)

  return (
    <header
      className={cn(
        'bg-workspace flex items-center gap-3 px-[var(--spacing-panel)] py-3',
        shellWorkspaceColumnClass,
        !chatCollapsed && 'border-border border-r',
        className,
      )}
    >
      <button
        type="button"
        className="rounded-pill border-border bg-surface text-foreground hover:bg-surface/80 inline-flex max-w-[14rem] items-center gap-2 border px-3 py-1 text-sm font-medium transition-colors"
      >
        <span className="truncate">{sessionName}</span>
        <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
      </button>

      <span className="text-subtle-foreground text-xs">Saving</span>

      <div className="ml-auto flex items-center gap-2">
        <div className="border-border bg-surface hidden items-center rounded-lg border p-0.5 sm:flex">
          <Button
            size="xs"
            variant={mode === 'rfp' ? 'default' : 'ghost'}
            className="rounded-md"
            onClick={() => setMode('rfp')}
          >
            RFP
          </Button>
          <Button
            size="xs"
            variant={mode === 'scope_creep' ? 'default' : 'ghost'}
            className="rounded-md"
            onClick={() => setMode('scope_creep')}
          >
            Creep
          </Button>
        </div>

        {chatCollapsed ? (
          <Button size="xs" variant="secondary" onClick={toggleChatCollapsed}>
            <MessageSquareIcon className="size-3.5" />
            Open chat
          </Button>
        ) : null}
      </div>

      <span className="sr-only">Mode: {MODE_LABELS[mode]}</span>
    </header>
  )
}
