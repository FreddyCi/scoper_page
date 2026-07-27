import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, FileTextIcon, MessageSquareIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  shellChatColumnClasses,
  shellWorkspaceColumnClass,
} from '@/components/layout/shell-layout'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'
import type { WorkspaceMode } from '@/lib/types'

type WorkspaceHeaderProps = {
  chatCollapsed: boolean
  className?: string
}

const MODE_OPTIONS: Array<{ value: WorkspaceMode; label: string; short: string }> = [
  { value: 'rfp', label: 'RFP Analysis', short: 'RFP' },
  { value: 'scope_creep', label: 'Scope Creep', short: 'Creep' },
]

const SESSION_PRESETS = [
  'Untitled session',
  'RFP qualification review',
  'Scope creep check',
]

function SessionNameDropdown() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const setSessionName = useSessionStore((s) => s.setSessionName)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-pill border-border bg-surface text-foreground hover:bg-surface/80 inline-flex max-w-[14rem] items-center gap-2 border px-3 py-1 text-sm font-medium transition-colors"
      >
        <span className="truncate">{sessionName}</span>
        <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
      </button>

      {open ? (
        <div
          role="listbox"
          className="border-border bg-surface shadow-elevated absolute top-[calc(100%+0.375rem)] left-0 z-20 min-w-[12rem] rounded-lg border py-1"
        >
          {SESSION_PRESETS.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={sessionName === name}
              onClick={() => {
                setSessionName(name)
                setOpen(false)
              }}
              className={cn(
                'hover:bg-muted block w-full px-3 py-1.5 text-left text-sm transition-colors',
                sessionName === name && 'bg-muted font-medium',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function WorkspaceModeToggle() {
  const mode = useSessionStore((s) => s.mode)
  const setMode = useSessionStore((s) => s.setMode)

  return (
    <div
      className="border-border bg-surface flex items-center rounded-lg border p-0.5"
      role="group"
      aria-label="Workspace mode"
    >
      {MODE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          size="xs"
          variant={mode === option.value ? 'default' : 'ghost'}
          className="rounded-md px-2 sm:px-2.5"
          onClick={() => setMode(option.value)}
          aria-pressed={mode === option.value}
        >
          <span className="sm:hidden">{option.short}</span>
          <span className="hidden sm:inline">{option.label}</span>
        </Button>
      ))}
    </div>
  )
}

/** Top header row — session controls and mode toggle */
export function WorkspaceHeaderTopRow({
  chatCollapsed,
  className,
}: WorkspaceHeaderProps) {
  const toggleChatCollapsed = useSessionStore((s) => s.toggleChatCollapsed)

  return (
    <div
      className={cn(
        'bg-workspace flex min-w-0 items-center gap-3 px-[var(--spacing-panel)] py-3',
        shellWorkspaceColumnClass,
        !chatCollapsed && 'border-border border-r',
        className,
      )}
    >
      <SessionNameDropdown />
      <span className="text-subtle-foreground text-xs">Saving</span>

      <div className="ml-auto flex items-center gap-2">
        <WorkspaceModeToggle />

        {chatCollapsed ? (
          <Button size="xs" variant="secondary" onClick={toggleChatCollapsed}>
            <MessageSquareIcon className="size-3.5" />
            <span className="hidden sm:inline">Open chat</span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Document tabs — second header row, workspace column only */
export function WorkspaceDocumentTabsRow({
  chatCollapsed,
  chatColumnClass,
  className,
}: WorkspaceHeaderProps & { chatColumnClass: string }) {
  const documents = useSessionStore((s) => s.documents)
  const activeDocId = useSessionStore((s) => s.activeDocId)
  const setActiveDocId = useSessionStore((s) => s.setActiveDocId)

  if (documents.length === 0) return null

  return (
    <div className={cn('flex', className)}>
      <div
        className={cn(
          'bg-workspace scrollbar-none flex min-w-0 gap-1 overflow-x-auto px-[var(--spacing-panel)] py-2',
          shellWorkspaceColumnClass,
          !chatCollapsed && 'border-border border-r',
        )}
      >
        {documents.map((doc) => {
          const isActive = doc.doc_id === activeDocId

          return (
            <button
              key={doc.doc_id}
              type="button"
              onClick={() => setActiveDocId(doc.doc_id)}
              aria-selected={isActive}
              className={cn(
                'inline-flex max-w-[12rem] shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'border-border bg-surface text-foreground border shadow-sm'
                  : 'text-muted-foreground hover:bg-surface/70 hover:text-foreground',
              )}
            >
              <FileTextIcon className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">{doc.filename}</span>
            </button>
          )
        })}
      </div>

      {!chatCollapsed ? (
        <div
          className={cn('bg-surface shrink-0', chatColumnClass)}
          aria-hidden
        />
      ) : null}
    </div>
  )
}

/** @deprecated Use WorkspaceHeaderTopRow + WorkspaceDocumentTabsRow in AppShell */
export function WorkspaceHeader(props: WorkspaceHeaderProps) {
  return (
    <>
      <WorkspaceHeaderTopRow {...props} />
      <WorkspaceDocumentTabsRow
        {...props}
        chatColumnClass={shellChatColumnClasses(props.chatCollapsed)}
      />
    </>
  )
}
