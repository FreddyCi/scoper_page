import { useMemo, useRef, useState } from 'react'
import { ArrowUpIcon, ChevronDownIcon, FileTextIcon, SparklesIcon } from 'lucide-react'

import {
  ChatContextAttachmentControls,
  ChatContextAttachmentPreview,
} from '@/components/chat/ChatContextAttachments'
import { Button } from '@/components/ui/button'
import {
  docMentionLabel,
  filterDocumentsForMention,
  findActiveMentionQuery,
  insertDocMention,
} from '@/lib/chat-mentions'
import type { ChatContextAttachment } from '@/lib/types'
import { SCOPER_BONSAI_17B } from '@/lib/scoper-model'
import { cn } from '@/lib/utils'
import {
  appendMarkdownContextAttachments,
  extractMarkdownFiles,
  ingestMarkdownFilesForChat,
} from '@/services/chat-markdown-drop'
import { useSessionStore } from '@/store/session-store'

type ChatComposerProps = {
  className?: string
}

/** Composer with @ document mentions, PDF context attachments, and Scoper send (BDA-052) */
export function ChatComposer({ className }: ChatComposerProps) {
  const documents = useSessionStore((s) => s.documents)
  const activeDocId = useSessionStore((s) => s.activeDocId)
  const selectedCitation = useSessionStore((s) => s.selectedCitation)
  const sendChatPrompt = useSessionStore((s) => s.sendChatPrompt)
  const chatGenerating = useSessionStore((s) => s.chatGenerating)
  const chatModelStatus = useSessionStore((s) => s.chatModelStatus)
  const [draft, setDraft] = useState('')
  const [cursor, setCursor] = useState(0)
  const [mentionHighlight, setMentionHighlight] = useState(0)
  const [attachments, setAttachments] = useState<ChatContextAttachment[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [ingestingMarkdown, setIngestingMarkdown] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const dragDepthRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend = draft.trim().length > 0 && !chatGenerating && !ingestingMarkdown
  const isBusy = chatGenerating || chatModelStatus === 'loading' || ingestingMarkdown

  const activeMention = findActiveMentionQuery(draft, cursor)
  const mentionCandidates = useMemo(
    () => filterDocumentsForMention(documents, activeMention?.query ?? ''),
    [activeMention?.query, documents],
  )
  const mentionMenuOpen = Boolean(activeMention && documents.length > 0)

  function syncCursor() {
    const nextCursor = textareaRef.current?.selectionStart ?? draft.length
    setCursor(nextCursor)
  }

  function selectMention(index: number) {
    if (!activeMention) return
    const doc = mentionCandidates[index]
    if (!doc) return

    const next = insertDocMention(draft, activeMention.start, cursor, doc)
    setDraft(next.text)
    setCursor(next.cursor)
    setMentionHighlight(0)

    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(next.cursor, next.cursor)
    })
  }

  function handleSend() {
    if (!canSend) return
    sendChatPrompt(draft, attachments)
    setDraft('')
    setCursor(0)
    setMentionHighlight(0)
    setAttachments([])
    setDropError(null)
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (isBusy) return
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    dragDepthRef.current += 1
    setDragActive(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (isBusy) return
    event.preventDefault()
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setDragActive(false)
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (isBusy) return
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (isBusy) return
    event.preventDefault()
    dragDepthRef.current = 0
    setDragActive(false)

    const files = extractMarkdownFiles(event.dataTransfer)
    if (files.length === 0) {
      setDropError('Drop .md or .markdown files to add context')
      return
    }

    setDropError(null)
    setIngestingMarkdown(true)
    try {
      const nextAttachments = await ingestMarkdownFilesForChat(files)
      setAttachments((current) => appendMarkdownContextAttachments(current, nextAttachments))
    } catch (error) {
      setDropError(error instanceof Error ? error.message : 'Failed to add markdown context')
    } finally {
      setIngestingMarkdown(false)
    }
  }

  return (
    <div
      className={cn(
        'border-border bg-workspace-muted/70 relative flex flex-col overflow-hidden rounded-2xl border',
        dragActive && 'border-sky-400 ring-2 ring-sky-300/60',
        className,
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={(event) => void handleDrop(event)}
    >
      {dragActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-sky-50/80">
          <p className="text-sky-900 text-sm font-medium">Drop markdown files to attach context</p>
        </div>
      ) : null}
      {attachments.length > 0 ? (
        <div className="border-border/70 border-b px-3 py-2">
          <ChatContextAttachmentPreview
            attachments={attachments}
            onRemove={(id) => setAttachments((current) => current.filter((item) => item.id !== id))}
          />
        </div>
      ) : null}

      <div className="relative px-3 pt-2.5 pb-1.5">
        <label className="sr-only" htmlFor="chat-composer-input">
          Ask the agent
        </label>

        {mentionMenuOpen ? (
          <div
            className="border-border bg-surface absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-xl border shadow-lg"
            role="listbox"
            aria-label="Mention a document"
          >
            {mentionCandidates.length === 0 ? (
              <p className="text-muted-foreground px-3 py-2 text-xs">No matching documents</p>
            ) : (
              mentionCandidates.map((doc, index) => (
                <button
                  key={doc.doc_id}
                  type="button"
                  role="option"
                  aria-selected={index === mentionHighlight}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    index === mentionHighlight
                      ? 'bg-sky-50 text-sky-950'
                      : 'hover:bg-muted/70 text-foreground',
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    selectMention(index)
                  }}
                >
                  <FileTextIcon className="size-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{doc.filename}</span>
                  <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                    @{docMentionLabel(doc)}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          id="chat-composer-input"
          rows={2}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setCursor(event.target.selectionStart)
          }}
          onClick={syncCursor}
          onKeyUp={syncCursor}
          onSelect={syncCursor}
          onKeyDown={(event) => {
            if (mentionMenuOpen && mentionCandidates.length > 0) {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setMentionHighlight((current) => (current + 1) % mentionCandidates.length)
                return
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setMentionHighlight(
                  (current) =>
                    (current - 1 + mentionCandidates.length) % mentionCandidates.length,
                )
                return
              }

              if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault()
                selectMention(mentionHighlight)
                return
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                setMentionHighlight(0)
                return
              }
            }

            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend()
            }
          }}
          placeholder={
            isBusy
              ? ingestingMarkdown
                ? 'Adding markdown context…'
                : 'Agent is responding…'
              : 'Ask the agent… / for skills, @ for context, drop .md files here'
          }
          disabled={isBusy}
          className="text-foreground placeholder:text-subtle-foreground min-h-[3.25rem] w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
        />
        {dropError ? <p className="text-destructive mt-1 text-xs">{dropError}</p> : null}
      </div>

      <div className="border-border/70 flex items-center justify-between gap-2 border-t px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            className="border-border/80 bg-surface text-foreground hover:bg-surface/90 inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors"
            aria-haspopup="listbox"
          >
            <SparklesIcon className="size-3 opacity-80" />
            Agent
            <ChevronDownIcon className="size-2.5 opacity-60" />
          </button>

          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex h-6 min-w-0 items-center gap-0.5 truncate rounded-full px-1.5 text-[11px] transition-colors hover:bg-black/[0.04]"
            aria-haspopup="listbox"
          >
            <span className="truncate">{SCOPER_BONSAI_17B.label}</span>
            <ChevronDownIcon className="size-2.5 shrink-0 opacity-60" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <ChatContextAttachmentControls
            documents={documents}
            activeDocId={activeDocId}
            selectedCitation={selectedCitation}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            disabled={isBusy}
            onMarkdownIngestChange={setIngestingMarkdown}
          />

          <Button
            type="button"
            size="icon-xs"
            variant="default"
            className="bg-foreground text-background hover:bg-foreground/90 rounded-full"
            aria-label="Send message"
            disabled={!canSend}
            onClick={handleSend}
          >
            <ArrowUpIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
