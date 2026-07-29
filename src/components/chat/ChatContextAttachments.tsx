import { useRef } from 'react'
import { FileTextIcon, HighlighterIcon, PaperclipIcon, XIcon } from 'lucide-react'

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MenuOptionContent } from '@/components/ui/menu-option-content'
import {
  createBlockContextAttachment,
  createDocumentContextAttachment,
  mergeContextAttachments,
} from '@/lib/chat-context'
import type { ChatContextAttachment, CitationRef, DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  appendMarkdownContextAttachments,
  ingestMarkdownFilesForChat,
} from '@/services/chat-markdown-drop'

type ChatContextAttachmentControlsProps = {
  documents: DocumentMeta[]
  activeDocId: string | null
  selectedCitation: CitationRef | null
  attachments: ChatContextAttachment[]
  onAttachmentsChange: (attachments: ChatContextAttachment[]) => void
  disabled?: boolean
  onMarkdownIngestChange?: (loading: boolean) => void
}

function ContextAttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: ChatContextAttachment
  onRemove: () => void
}) {
  return (
    <Attachment state="done" size="xs" orientation="horizontal" className="max-w-56">
      <AttachmentMedia>
        {attachment.kind === 'block' ? (
          <HighlighterIcon className="text-sky-700" />
        ) : (
          <FileTextIcon className="text-sky-700" />
        )}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{attachment.label}</AttachmentTitle>
        <AttachmentDescription>{attachment.description ?? attachment.kind}</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label="Remove context" onClick={onRemove}>
          <XIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}

export function ChatContextAttachmentControls({
  documents,
  activeDocId,
  selectedCitation,
  attachments,
  onAttachmentsChange,
  disabled = false,
  onMarkdownIngestChange,
}: ChatContextAttachmentControlsProps) {
  const markdownInputRef = useRef<HTMLInputElement>(null)
  const activeDoc = documents.find((doc) => doc.doc_id === activeDocId) ?? null
  const selectedDoc =
    selectedCitation != null
      ? documents.find((doc) => doc.doc_id === selectedCitation.doc_id) ?? null
      : null

  function addAttachment(attachment: ChatContextAttachment) {
    onAttachmentsChange(mergeContextAttachments(attachments, [attachment]))
  }

  const pdfDocuments = documents.filter((doc) => doc.mime === 'application/pdf')
  const contextDocuments = documents.filter(
    (doc) => doc.mime === 'application/pdf' || doc.mime === 'text/markdown',
  )
  const canAttachSelection = Boolean(selectedDoc && selectedCitation && selectedDoc.mime === 'application/pdf')
  const canAttachActiveDoc = Boolean(activeDoc)

  async function handleMarkdownFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return

    onMarkdownIngestChange?.(true)
    try {
      const nextAttachments = await ingestMarkdownFilesForChat([...files])
      onAttachmentsChange(appendMarkdownContextAttachments(attachments, nextAttachments))
    } finally {
      onMarkdownIngestChange?.(false)
    }
  }

  return (
    <>
      <input
        ref={markdownInputRef}
        type="file"
        accept=".md,.markdown,text/markdown"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleMarkdownFiles(event.target.files)
          event.target.value = ''
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={disabled}
              aria-label="Attach document context"
              className="text-muted-foreground hover:text-foreground rounded-full"
            >
              <PaperclipIcon className="size-3.5" />
            </Button>
          }
        />

      <DropdownMenuContent align="end" side="top" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Add context</DropdownMenuLabel>

          {canAttachSelection && selectedDoc && selectedCitation ? (
            <DropdownMenuItem
              className="items-start py-2.5"
              onClick={() => addAttachment(createBlockContextAttachment(selectedDoc, selectedCitation))}
            >
              <MenuOptionContent
                title="Selected passage"
                description={
                  selectedCitation.page_num != null
                    ? `Page ${selectedCitation.page_num} highlight from ${selectedDoc.filename}`
                    : `Highlighted passage from ${selectedDoc.filename}`
                }
              />
            </DropdownMenuItem>
          ) : null}

          {canAttachActiveDoc && activeDoc ? (
            <DropdownMenuItem
              className="items-start py-2.5"
              onClick={() => addAttachment(createDocumentContextAttachment(activeDoc))}
            >
              <MenuOptionContent
                title={activeDoc.filename}
                description={
                  activeDoc.mime === 'text/markdown'
                    ? 'Use the active markdown note as chat context'
                    : 'Use the full active PDF as chat context'
                }
              />
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem
            className="items-start py-2.5"
            onClick={() => markdownInputRef.current?.click()}
          >
            <MenuOptionContent
              title="Upload markdown file"
              description="Add a .md file as supporting context for this question"
            />
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {contextDocuments.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-[11px] font-medium">
                Session documents
              </DropdownMenuLabel>
              {contextDocuments.map((doc) => (
                <DropdownMenuItem
                  key={doc.doc_id}
                  className="items-start py-2.5"
                  onClick={() => addAttachment(createDocumentContextAttachment(doc))}
                >
                  <MenuOptionContent
                    title={doc.filename}
                    description={
                      doc.mime === 'text/markdown' ? 'Attach markdown context' : 'Attach full document'
                    }
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : pdfDocuments.length === 0 ? (
          <DropdownMenuGroup>
            <DropdownMenuItem disabled>No documents in this session yet</DropdownMenuItem>
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  )
}

export function ChatContextAttachmentPreview({
  attachments,
  onRemove,
  className,
}: {
  attachments: ChatContextAttachment[]
  onRemove?: (id: string) => void
  className?: string
}) {
  if (attachments.length === 0) return null

  return (
    <AttachmentGroup className={cn('pb-1', className)}>
      {attachments.map((attachment) =>
        onRemove ? (
          <ContextAttachmentChip
            key={attachment.id}
            attachment={attachment}
            onRemove={() => onRemove(attachment.id)}
          />
        ) : (
          <Attachment key={attachment.id} state="done" size="xs">
            <AttachmentMedia>
              {attachment.kind === 'block' ? (
                <HighlighterIcon className="text-sky-700" />
              ) : (
                <FileTextIcon className="text-sky-700" />
              )}
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{attachment.label}</AttachmentTitle>
              <AttachmentDescription>{attachment.description}</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ),
      )}
    </AttachmentGroup>
  )
}
