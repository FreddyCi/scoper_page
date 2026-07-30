/** MIME type for dragging a session document into the chat composer */
export const SCOPER_CHAT_DOCUMENT_MIME = 'application/x-scoper-chat-document'

export function setDocumentChatDragData(
  dataTransfer: DataTransfer,
  docId: string,
  filename: string,
): void {
  dataTransfer.setData(SCOPER_CHAT_DOCUMENT_MIME, docId)
  dataTransfer.setData('text/plain', filename)
  dataTransfer.effectAllowed = 'copy'
}

export function readDocumentChatDragId(dataTransfer: DataTransfer): string | null {
  const docId = dataTransfer.getData(SCOPER_CHAT_DOCUMENT_MIME).trim()
  return docId.length > 0 ? docId : null
}

export function dragCarriesChatDocument(types: readonly string[]): boolean {
  return types.includes(SCOPER_CHAT_DOCUMENT_MIME)
}
