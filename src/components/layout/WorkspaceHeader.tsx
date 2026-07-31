import {
  ClipboardCheckIcon,
  FileStackIcon,
  FileTextIcon,
  MessageCircleMoreIcon,
  XIcon,
} from 'lucide-react'

import { DocumentRoleSelector } from '@/components/workspace/DocumentRoleSelector'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  shellChatColumnClasses,
  shellWorkspaceColumnClass,
} from '@/components/layout/shell-layout'
import { canAttachDocumentToChat } from '@/lib/chat-context'
import { setDocumentChatDragData } from '@/lib/chat-context-drag'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'
import type { WorkspaceMode } from '@/lib/types'

type WorkspaceHeaderProps = {
  chatCollapsed: boolean
  className?: string
}


function ScoperLogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/scoper-logo.svg"
      alt="Scoper"
      width={28}
      height={28}
      className={cn('size-7 shrink-0', className)}
    />
  )
}

const MODE_TAB_TRIGGER_CLASS = 'gap-1.5 sm:px-3'

function WorkspaceModeToggle() {
  const mode = useSessionStore((s) => s.mode)
  const chatGenerating = useSessionStore((s) => s.chatGenerating)
  const setMode = useSessionStore((s) => s.setMode)

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => {
        if (chatGenerating) return
        setMode(value as WorkspaceMode)
      }}
      className="w-auto gap-0"
    >
      <TabsList variant="segmented" aria-label="Workspace mode">
        <TabsTrigger value="rfp" disabled={chatGenerating} className={MODE_TAB_TRIGGER_CLASS}>
          <ClipboardCheckIcon className="size-3.5" />
          <span className="sm:hidden">RFP</span>
          <span className="hidden sm:inline">RFP Analysis</span>
        </TabsTrigger>
        <TabsTrigger
          value="proposal"
          disabled={chatGenerating}
          className={MODE_TAB_TRIGGER_CLASS}
        >
          <FileStackIcon className="size-3.5" />
          <span className="sm:hidden">Proposal</span>
          <span className="hidden sm:inline">Generate Complete Proposal</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

/** Top header row — logo and mode toggle */
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
      <div className="flex min-w-0 items-center gap-2.5">
        <ScoperLogoMark />
      </div>

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
  const removeDocument = useSessionStore((s) => s.removeDocument)

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
          const attachable = canAttachDocumentToChat(doc)

          return (
            <div
              key={doc.doc_id}
              role="tab"
              aria-selected={isActive}
              title={doc.filename}
              onClick={() => setActiveDocId(doc.doc_id)}
              className={cn(
                'group/tab inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'border-border bg-surface text-foreground max-w-[min(100%,28rem)] border shadow-sm'
                  : 'text-muted-foreground hover:bg-surface/70 hover:text-foreground max-w-[12rem]',
              )}
            >
              <div
                draggable={attachable}
                onDragStart={(event) => {
                  if (!attachable) return
                  setDocumentChatDragData(event.dataTransfer, doc.doc_id, doc.filename)
                }}
                onClick={(event) => event.stopPropagation()}
                title={attachable ? `${doc.filename} — drag to chat` : doc.filename}
                className={cn(
                  'border-border/60 inline-flex min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5',
                  attachable && 'cursor-grab active:cursor-grabbing',
                  !attachable && 'cursor-default',
                )}
              >
                <FileTextIcon className="size-3.5 shrink-0 opacity-70" />
                <span className={cn(isActive ? 'whitespace-normal break-all' : 'truncate')}>
                  {doc.filename}
                </span>
              </div>
              <DocumentRoleSelector docId={doc.doc_id} role={doc.role} />
              <button
                type="button"
                aria-label={`Remove ${doc.filename}`}
                title={`Remove ${doc.filename}`}
                onClick={(event) => {
                  event.stopPropagation()
                  removeDocument(doc.doc_id)
                }}
                className={cn(
                  'text-muted-foreground hover:text-foreground hover:bg-muted/70 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors',
                  isActive ? 'opacity-100' : 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100',
                )}
              >
                <XIcon className="size-3" />
              </button>
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
