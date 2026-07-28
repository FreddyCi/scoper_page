import type { CitationRef } from '@/lib/types'
import { useSessionStore } from '@/store/session-store'

/**
 * Single entry point for citation focus — updates store state so both the
 * extracted-text pane and PDF viewer scroll/highlight in sync.
 */
export function focusCitation(ref: CitationRef | null): void {
  const store = useSessionStore.getState()

  if (!ref) {
    store.selectCitation(null)
    return
  }

  store.bumpCitationFocus()
  store.selectCitation(ref)
}

export function clearCitation(): void {
  focusCitation(null)
}

/** Dev harness — focusCitation opens split view and selects citation (BDA-033) */
export async function runCitationBridgeHarness(): Promise<void> {
  const store = useSessionStore.getState()

  store.resetSession()
  store.addDocument({
    doc_id: 'cite-harness-doc',
    filename: 'harness.pdf',
    mime: 'application/pdf',
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  })

  const citation: CitationRef = {
    doc_id: 'cite-harness-doc',
    block_id: 'cite-harness-doc:p1:i0',
    page_num: 1,
    excerpt: 'Harness citation excerpt',
    bbox: { x: 72, y: 720, width: 200, height: 24 },
  }

  focusCitation(citation)

  const afterFocus = useSessionStore.getState()
  if (afterFocus.workspaceView !== 'split') {
    throw new Error('focusCitation failed: expected split workspace view')
  }
  if (afterFocus.activeDocId !== citation.doc_id) {
    throw new Error('focusCitation failed: expected activeDocId to match citation')
  }
  if (afterFocus.selectedCitation?.block_id !== citation.block_id) {
    throw new Error('focusCitation failed: expected selectedCitation block_id')
  }
  if (afterFocus.citationFocusSeq < 1) {
    throw new Error('focusCitation failed: expected citationFocusSeq bump')
  }

  clearCitation()
  if (useSessionStore.getState().selectedCitation != null) {
    throw new Error('clearCitation failed: expected null selectedCitation')
  }

  store.resetSession()
}
