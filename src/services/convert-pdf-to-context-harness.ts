import { contextMarkdownFilename } from '@/lib/assemble-pdf-markdown'
import { convertPdfToContextDocument } from '@/services/convert-pdf-to-context'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { runIngestHarness } from '@/services/ingest-router'
import { useSessionStore } from '@/store/session-store'

export async function runConvertPdfToContextHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()
  await runIngestHarness()

  const sourceDocument = useSessionStore.getState().documents[0]
  if (!sourceDocument || sourceDocument.mime !== 'application/pdf') {
    throw new Error('ConvertPdfToContextHarness: expected ingested PDF document')
  }

  if (!getDocumentBytes(sourceDocument.doc_id)) {
    throw new Error('ConvertPdfToContextHarness: missing source PDF bytes')
  }

  const beforeCount = useSessionStore.getState().documents.length
  const result = await convertPdfToContextDocument(sourceDocument, { ocrEnabled: false })

  const state = useSessionStore.getState()
  if (state.documents.length !== beforeCount + 1) {
    throw new Error('ConvertPdfToContextHarness: expected a new context document tab')
  }

  const contextDoc = state.documents.find((doc) => doc.doc_id === result.doc_id)
  if (!contextDoc || contextDoc.mime !== 'text/markdown') {
    throw new Error('ConvertPdfToContextHarness: context document missing or wrong mime')
  }

  if (contextDoc.filename !== contextMarkdownFilename(sourceDocument.filename)) {
    throw new Error('ConvertPdfToContextHarness: unexpected context filename')
  }

  if (contextDoc.role !== 'supporting') {
    throw new Error('ConvertPdfToContextHarness: context document should be supporting role')
  }

  if (state.activeDocId !== result.doc_id) {
    throw new Error('ConvertPdfToContextHarness: context document should become active tab')
  }

  const attachment = state.chatContextAttachments.find((item) => item.docId === result.doc_id)
  if (!attachment) {
    throw new Error('ConvertPdfToContextHarness: context document not attached to chat')
  }

  if (result.block_count === 0) {
    throw new Error('ConvertPdfToContextHarness: expected parsed markdown blocks')
  }
}
