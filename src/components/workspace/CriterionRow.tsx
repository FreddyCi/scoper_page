import { useState } from 'react'
import {
  AlertTriangleIcon,
  MessageCircleDashedIcon,
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

  const showTrailing = showChatActions || clickable

  return (
    <div
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5',
        'border-border/70 bg-workspace-muted/50',
        className,
      )}
    >
      <StatusIcon className={cn('mt-0.5 size-4 shrink-0', STATUS_CLASS[criterion.status])} />

      <button
        type="button"
        disabled={!clickable}
        onClick={handleOpenSource}
        className={cn(
          'min-w-0 flex-1 text-left',
          clickable && 'hover:text-sky-900 cursor-pointer',
          !clickable && 'cursor-default',
        )}
      >
        <span className="text-foreground block text-sm font-medium leading-snug">{criterion.label}</span>
        {criterion.detail ? (
          <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
            {criterion.detail}
          </span>
        ) : null}
      </button>

      {showTrailing ? (
        <div
          className={cn(
            'flex shrink-0 items-center gap-0.5 self-start',
            showChatActions && 'bg-background/80 border-border/60 rounded-md border p-0.5 shadow-sm',
          )}
        >
          {showChatActions ? (
            <>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                aria-label={copied ? 'Copied to clipboard' : 'Copy for chat'}
                onClick={(event) => void handleCopy(event)}
              >
                {copied ? (
                  <CheckIcon className="size-3.5 text-emerald-600" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Add to chat"
                onClick={handleAskInChat}
              >
                <MessageCircleDashedIcon className="size-3.5" />
              </Button>
            </>
          ) : null}
          {clickable ? (
            <>
              {showChatActions ? (
                <span className="bg-border/80 mx-0.5 h-3.5 w-px shrink-0" aria-hidden />
              ) : null}
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-sky-600"
                aria-label={`View source for ${criterion.label}`}
                onClick={(event) => {
                  event.stopPropagation()
                  handleOpenSource()
                }}
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
