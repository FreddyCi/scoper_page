import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, FileTextIcon, MessageCircleMoreIcon } from 'lucide-react'

import { DocumentRoleSelector } from '@/components/workspace/DocumentRoleSelector'
import { AnchoredMenuPortal } from '@/components/ui/anchored-menu'
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
        <AnchoredMenuPortal open={open} anchorRef={rootRef} role="listbox" className="min-w-[12rem]">
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
        </AnchoredMenuPortal>
      ) : null}
    </div>
  )
}

function WorkspaceModeToggle() {
  const mode = useSessionStore((s) => s.mode)
  const setMode = useSessionStore((s) => s.setMode)

  return (
    <div
      className="bg-muted inline-flex items-center gap-0.5 rounded-full p-1"
      role="group"
      aria-label="Workspace mode"
    >
      {MODE_OPTIONS.map((option) => {
        const isActive = mode === option.value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all sm:px-3',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="sm:hidden">{option.short}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        )
      })}
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
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="shadow-elevated border-border bg-surface size-10 rounded-full border"
            aria-label="Open chat"
            onClick={toggleChatCollapsed}
          >
            <MessageCircleMoreIcon className="size-4" />
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
            <div
              key={doc.doc_id}
              role="tab"
              aria-selected={isActive}
              title={doc.filename}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'border-border bg-surface text-foreground max-w-[min(100%,28rem)] border shadow-sm'
                  : 'text-muted-foreground hover:bg-surface/70 hover:text-foreground max-w-[12rem]',
              )}
            >
              <button
                type="button"
                onClick={() => setActiveDocId(doc.doc_id)}
                className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-black/[0.03]"
              >
                <FileTextIcon className="size-3.5 shrink-0 opacity-70" />
                <span className={cn(isActive ? 'whitespace-normal break-all' : 'truncate')}>
                  {doc.filename}
                </span>
              </button>
              <DocumentRoleSelector docId={doc.doc_id} role={doc.role} />
            </div>
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
