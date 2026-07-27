import { useEffect, useState } from 'react'
import {
  CheckIcon,
  FilePenLineIcon,
  MailIcon,
  PencilIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ChatActionKind, ChatActionProposal } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

const ACTION_ICONS: Record<ChatActionKind, typeof MailIcon> = {
  draft: MailIcon,
  update: FilePenLineIcon,
  analyze: SparklesIcon,
}

type ChatActionProposalRowProps = {
  messageId: string
  action: ChatActionProposal
}

export function ChatActionProposalRow({ messageId, action }: ChatActionProposalRowProps) {
  const updateChatAction = useSessionStore((s) => s.updateChatAction)
  const setChatActionStatus = useSessionStore((s) => s.setChatActionStatus)
  const [draftTitle, setDraftTitle] = useState(action.title)
  const [draftSubtitle, setDraftSubtitle] = useState(action.subtitle)
  const Icon = ACTION_ICONS[action.kind]
  const isEditing = action.status === 'editing'
  const isResolved = action.status === 'approved' || action.status === 'dismissed'

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(action.title)
      setDraftSubtitle(action.subtitle)
    }
  }, [action.title, action.subtitle, isEditing])

  function saveEdits() {
    updateChatAction(messageId, action.id, {
      title: draftTitle.trim() || action.title,
      subtitle: draftSubtitle.trim() || action.subtitle,
    })
    setChatActionStatus(messageId, action.id, 'pending')
  }

  return (
    <div
      className={cn(
        'border-border bg-surface flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-opacity',
        isResolved && 'opacity-55',
      )}
    >
      <div className="bg-muted text-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="space-y-2">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              className="border-border bg-background text-foreground w-full rounded-md border px-2 py-1 text-sm font-medium outline-none focus:ring-2 focus:ring-black/10"
              aria-label="Action title"
            />
            <input
              value={draftSubtitle}
              onChange={(event) => setDraftSubtitle(event.target.value)}
              className="border-border bg-background text-muted-foreground w-full rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black/10"
              aria-label="Action details"
            />
          </div>
        ) : (
          <>
            <p className="text-foreground text-sm font-medium">{action.title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{action.subtitle}</p>
            {action.status === 'approved' ? (
              <p className="mt-1 text-xs font-medium text-emerald-700">Approved</p>
            ) : null}
            {action.status === 'dismissed' ? (
              <p className="text-muted-foreground mt-1 text-xs font-medium">Dismissed</p>
            ) : null}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {isEditing ? (
          <>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Cancel edit"
              onClick={() => {
                setDraftTitle(action.title)
                setDraftSubtitle(action.subtitle)
                setChatActionStatus(messageId, action.id, 'pending')
              }}
            >
              <XIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Save edit"
              onClick={saveEdits}
            >
              <CheckIcon className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Dismiss action"
              disabled={isResolved}
              onClick={() => setChatActionStatus(messageId, action.id, 'dismissed')}
            >
              <XIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Edit action"
              disabled={isResolved}
              onClick={() => setChatActionStatus(messageId, action.id, 'editing')}
            >
              <PencilIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Approve action"
              disabled={isResolved}
              onClick={() => setChatActionStatus(messageId, action.id, 'approved')}
            >
              <CheckIcon className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

type ChatActionProposalListProps = {
  messageId: string
  intro?: string
  actions: ChatActionProposal[]
}

export function ChatActionProposalList({
  messageId,
  intro,
  actions,
}: ChatActionProposalListProps) {
  if (actions.length === 0) return null

  return (
    <div className="space-y-2.5">
      {intro ? <p className="text-foreground text-sm leading-relaxed">{intro}</p> : null}
      <div className="space-y-2">
        {actions.map((action) => (
          <ChatActionProposalRow key={action.id} messageId={messageId} action={action} />
        ))}
      </div>
    </div>
  )
}
