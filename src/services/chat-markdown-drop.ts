import { isMarkdownFile } from '@/lib/upload-accept'
import { ingestFile } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

export function extractMarkdownFiles(dataTransfer: DataTransfer): File[] {
  return [...dataTransfer.files].filter(isMarkdownFile)
}

/** Ingest dropped markdown files into the session and attach them to chat context. */
export async function ingestMarkdownFilesForChat(files: File[]): Promise<void> {
  const markdownFiles = files.filter(isMarkdownFile)
  if (markdownFiles.length === 0) return

  for (const file of markdownFiles) {
    const result = await ingestFile(file, { ocrEnabled: false })
    useSessionStore.getState().commitIngestResults([result])
  }
}
