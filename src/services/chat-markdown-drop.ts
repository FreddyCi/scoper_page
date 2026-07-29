import { createDocumentContextAttachment, mergeContextAttachments } from '@/lib/chat-context'
import type { ChatContextAttachment } from '@/lib/types'
import { isMarkdownFile } from '@/lib/upload-accept'
import { ingestFile } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

export function extractMarkdownFiles(dataTransfer: DataTransfer): File[] {
  return [...dataTransfer.files].filter(isMarkdownFile)
}

/** Ingest dropped markdown files into the session and return chat context attachments. */
export async function ingestMarkdownFilesForChat(files: File[]): Promise<ChatContextAttachment[]> {
  const markdownFiles = files.filter(isMarkdownFile)
  if (markdownFiles.length === 0) return []

  const attachments: ChatContextAttachment[] = []

  for (const file of markdownFiles) {
    const result = await ingestFile(file, { ocrEnabled: false })
    useSessionStore.getState().commitIngestResults([result])

    const doc = useSessionStore.getState().documents.find((entry) => entry.doc_id === result.doc_id)
    if (doc) {
      attachments.push(createDocumentContextAttachment(doc))
    }
  }

  return attachments
}

export function appendMarkdownContextAttachments(
  existing: ChatContextAttachment[],
  incoming: ChatContextAttachment[],
): ChatContextAttachment[] {
  return mergeContextAttachments(existing, incoming)
}
