import { useState } from 'react'
import {
  AlertTriangleIcon,
  BotMessageSquareIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronRightIcon,
  CircleIcon,
  CopyIcon,
  XCircleIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  formatCriterionChatPrompt,
  type FormatCriterionChatOptions,
} from '@/lib/format-criterion-chat'
import type { CitationRef, CriterionResult, CriterionStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import { useSessionStore } from '@/store/session-store'

const STATUS_ICON: Record<CriterionStatus, typeof CheckCircle2Icon> = {
  pass: CheckCircle2Icon,
  warn: AlertTriangleIcon,
  fail: XCircleIcon,
}

const STATUS_CLASS: Record<CriterionStatus, string> = {
  pass: 'text-emerald-600',
  warn: 'text-amber-600',
  fail: 'text-rose-600',
}

type CriterionRowProps = {
  criterion: CriterionResult
  onCriterionClick?: (citation: CitationRef) => void
  chatPromptOptions?: FormatCriterionChatOptions
  className?: string
}

export function CriterionRow({
  criterion,
  onCriterionClick,
  chatPromptOptions,
  className,
}: CriterionRowProps) {
  const [copied, setCopied] = useState(false)
  const seedChatComposer = useSessionStore((state) => state.seedChatComposer)
  const clickable = Boolean(criterion.citation)
  const StatusIcon = STATUS_ICON[criterion.status] ?? CircleIcon
  const showChatActions = criterion.status === 'fail' || criterion.status === 'warn'

  function buildChatPrompt() {
    return formatCriterionChatPrompt(criterion, chatPromptOptions ?? {})
  }

  function handleOpenSource() {
    if (!criterion.citation) return
    if (onCriterionClick) {
      onCriterionClick(criterion.citation)
      return
    }
    focusCitation(criterion.citation)
  }

  async function handleCopy(event: React.MouseEvent) {
    event.stopPropagation()
    const text = buildChatPrompt()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('[criterion-row] clipboard copy failed', error)
    }
  }

  function handleAskInChat(event: React.MouseEvent) {
    event.stopPropagation()
    seedChatComposer(buildChatPrompt())
  }

  return (
    <div
      className={cn(
        'group flex w-full items-start gap-2 rounded-lg border px-3 py-2.5',
        'border-border/70 bg-workspace-muted/50',
        className,
      )}
    >
      <StatusIcon className={cn('mt-0.5 size-4 shrink-0', STATUS_CLASS[criterion.status])} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          disabled={!clickable}
          onClick={handleOpenSource}
          className={cn(
            'w-full text-left',
            clickable && 'hover:text-sky-900 cursor-pointer',
            !clickable && 'cursor-default',
          )}
        >
          <span className="text-foreground block text-sm font-medium">{criterion.label}</span>
          {criterion.detail ? (
            <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
              {criterion.detail}
            </span>
          ) : null}
        </button>

        {showChatActions ? (
          <div className="mt-2 flex items-center gap-1 sm:hidden">
            <ActionIconButtons
              copied={copied}
              onCopy={(event) => void handleCopy(event)}
              onAskInChat={handleAskInChat}
            />
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        {showChatActions ? (
          <div className="hidden items-center gap-1 sm:flex">
            <ActionIconButtons
              copied={copied}
              onCopy={(event) => void handleCopy(event)}
              onAskInChat={handleAskInChat}
            />
          </div>
        ) : null}
        {clickable ? (
          <button
            type="button"
            aria-label={`View source for ${criterion.label}`}
            onClick={handleOpenSource}
            className="text-muted-foreground rounded p-0.5 hover:text-sky-600"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ActionIconButtons({
  copied,
  onCopy,
  onAskInChat,
}: {
  copied: boolean
  onCopy: (event: React.MouseEvent) => void
  onAskInChat: (event: React.MouseEvent) => void
}) {
  return (
    <>
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        className="text-muted-foreground hover:text-foreground border-border/80 rounded-full"
        aria-label={copied ? 'Copied to clipboard' : 'Copy for chat'}
        onClick={onCopy}
      >
        {copied ? <CheckIcon className="size-3.5 text-emerald-600" /> : <CopyIcon className="size-3.5" />}
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        className="border-violet-200/80 text-violet-800 hover:bg-violet-50 rounded-full"
        aria-label="Add to chat"
        onClick={onAskInChat}
      >
        <BotMessageSquareIcon className="size-3.5" />
      </Button>
    </>
  )
}
