import { useEffect, useRef, useState } from 'react'
import { MessageSquareIcon, SparklesIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  CommentAuthorAvatar,
  ReviewerIdentityFields,
} from '@/components/workspace/CommentAuthorAvatar'
import { useBlockComments } from '@/hooks/use-block-comments'
import type { BlockRecord } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type BlockCommentPopoverProps = {
  block: BlockRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCommentAdded?: () => void
  showTrigger?: boolean
  className?: string
  /** Markdown Read view — enhance copy and violet styling instead of PDF review notes. */
  variant?: 'pdf' | 'markdown'
}

const BLOCK_EXCERPT_WORD_LIMIT = 30

function truncateWords(text: string, maxWords: number): { excerpt: string; isTruncated: boolean } {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) {
    return { excerpt: text, isTruncated: false }
  }

  return {
    excerpt: `${words.slice(0, maxWords).join(' ')}…`,
    isTruncated: true,
  }
}

function BlockExcerpt({
  text,
  blockId,
  variant = 'pdf',
}: {
  text: string
  blockId: string
  variant?: 'pdf' | 'markdown'
}) {
  const [expanded, setExpanded] = useState(false)
  const { excerpt, isTruncated } = truncateWords(text, BLOCK_EXCERPT_WORD_LIMIT)

  useEffect(() => {
    setExpanded(false)
  }, [blockId])

  return (
    <blockquote
      className={cn(
        'text-foreground rounded-r-md border-l-4 px-3 py-2 text-xs leading-relaxed',
        variant === 'markdown'
          ? 'border-violet-400 bg-violet-50/70'
          : 'border-sky-400 bg-sky-50/70',
        expanded && isTruncated && 'scrollbar-thin max-h-40 overflow-y-auto overscroll-contain',
      )}
    >
      <p>{expanded || !isTruncated ? text : excerpt}</p>
      {isTruncated ? (
        <button
          type="button"
          className={cn(
            'mt-1 text-xs font-medium hover:underline',
            variant === 'markdown'
              ? 'text-violet-800 hover:text-violet-950'
              : 'text-sky-800 hover:text-sky-950',
          )}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </blockquote>
  )
}

function formatCommentTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Header button + dropdown for review notes on the selected extract block (BDA-082) */
export function BlockCommentPopover({
  block,
  open,
  onOpenChange,
  onCommentAdded,
  showTrigger = false,
  className,
  variant = 'pdf',
}: BlockCommentPopoverProps) {
  const isMarkdown = variant === 'markdown'
  const [draft, setDraft] = useState('')
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const blockId = block?.block_id ?? null
  const reviewerName = useSessionStore((state) => state.reviewerName)
  const setReviewerName = useSessionStore((state) => state.setReviewerName)
  const { comments, loading, saving, error, addComment } = useBlockComments(blockId)

  useEffect(() => {
    if (!open) setDraft('')
  }, [blockId, open])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (showTrigger && anchorRef.current?.contains(target)) return
      onOpenChange(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange, showTrigger])

  async function handleSubmit() {
    const trimmed = draft.trim()
    if (!trimmed || saving || !block) return

    const saved = await addComment(trimmed)
    if (!saved) return

    setDraft('')
    onCommentAdded?.()
  }

  const commentCount = comments.length

  return (
    <div ref={anchorRef} className={cn(showTrigger ? 'relative shrink-0' : 'contents', className)}>
      {showTrigger ? (
        <Button
          type="button"
          variant={open ? 'secondary' : 'outline'}
          size="sm"
          disabled={!block}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={
            block
              ? commentCount > 0
                ? `Block comments (${commentCount})`
                : 'Add block comment'
              : 'Select a block to comment'
          }
          onClick={() => onOpenChange(!open)}
        >
          <MessageSquareIcon className="size-3.5" />
          Comment
          {commentCount > 0 ? (
            <span className="bg-amber-100 text-amber-800 ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {commentCount}
            </span>
          ) : null}
        </Button>
      ) : null}

      {open && block ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={isMarkdown ? 'Enhance passage' : 'Block comments'}
          className={cn(
            'border-border bg-surface shadow-elevated z-30 flex max-h-[min(34rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-lg border',
            isMarkdown && 'border-violet-200/80',
            showTrigger
              ? 'absolute top-full right-0 mt-2 w-[min(20rem,calc(100vw-2rem))]'
              : 'absolute top-3 right-3 left-3 sm:left-auto sm:w-[min(22rem,calc(100vw-2rem))]',
          )}
        >
          <div className="border-border/70 min-w-0 shrink-0 space-y-2 border-b p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
                  {isMarkdown ? (
                    <>
                      <SparklesIcon className="text-violet-700 size-4 shrink-0" />
                      Enhance passage
                    </>
                  ) : (
                    'Block comment'
                  )}
                </h3>
                {!isMarkdown && block.page_num != null ? (
                  <span className="bg-sky-100 text-sky-900 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    Page {block.page_num}
                  </span>
                ) : null}
                {commentCount > 0 ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                      isMarkdown
                        ? 'bg-violet-100 text-violet-900'
                        : 'bg-amber-100 text-amber-900',
                    )}
                  >
                    {commentCount} {isMarkdown ? 'enhancement' : 'note'}
                    {commentCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={isMarkdown ? 'Close enhance panel' : 'Close comments'}
                className="text-muted-foreground shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {isMarkdown
                ? 'Describe how to improve or expand this passage in your context document.'
                : 'This note is attached to the highlighted passage in the PDF preview.'}
            </p>
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
            <BlockExcerpt text={block.text} blockId={block.block_id} variant={variant} />

            {loading ? (
              <p className="text-muted-foreground text-xs">
                {isMarkdown ? 'Loading enhancements…' : 'Loading comments…'}
              </p>
            ) : null}

            {!loading && comments.length > 0 ? (
              <ul className="space-y-2">
                {comments.map((comment) => (
                  <li
                    key={comment.comment_id}
                    className="border-border bg-muted/30 flex gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <CommentAuthorAvatar initials={comment.author_initials} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground leading-relaxed">{comment.text}</p>
                      <p className="text-muted-foreground mt-1 text-[11px]">
                        {comment.author_initials !== '?'
                          ? `${comment.author_initials} · `
                          : ''}
                        {formatCommentTime(comment.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {!loading && comments.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                {isMarkdown ? 'No enhancements yet on this passage.' : 'No comments yet on this block.'}
              </p>
            ) : null}

            <div className="space-y-2">
              <ReviewerIdentityFields
                reviewerName={reviewerName}
                onReviewerNameChange={setReviewerName}
              />
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  isMarkdown
                    ? 'e.g. Add bullet points, clarify wording, expand this section…'
                    : 'Add a review note for this block…'
                }
                rows={3}
                className="border-border bg-surface text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
              />
              {error ? <p className="text-destructive text-xs">{error}</p> : null}
            </div>
          </div>

          <div className="border-border/70 bg-surface flex shrink-0 justify-end border-t p-3">
            <Button
              type="button"
              size="sm"
              disabled={!draft.trim() || saving}
              className={cn(isMarkdown && 'bg-violet-950 text-white hover:bg-violet-900')}
              onClick={() => void handleSubmit()}
            >
              {saving ? 'Saving…' : isMarkdown ? 'Save enhancement' : 'Add comment'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** @deprecated Use BlockCommentPopover */
export const CommentPopover = BlockCommentPopover
