import { blockToCitation, type CitationRef } from '@/lib/types'
import { buildMockRfpProfiles } from '@/lib/profile-stub'
import { fetchBlockById } from '@/services/document-blocks'
import { useSessionStore } from '@/store/session-store'

async function resolveCitation(ref: CitationRef): Promise<CitationRef> {
  try {
    const block = await fetchBlockById(ref.block_id)
    if (!block) return ref
    return blockToCitation(block, ref.excerpt)
  } catch (error) {
    console.error('[citation-bridge] resolve block failed', error)
    return ref
  }
}

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

  void (async () => {
    const resolved = await resolveCitation(ref)
    const latest = useSessionStore.getState()
    if (latest.selectedCitation?.block_id !== ref.block_id) return

    const bboxChanged =
      resolved.bbox &&
      (resolved.bbox.x !== ref.bbox?.x ||
        resolved.bbox.y !== ref.bbox?.y ||
        resolved.bbox.width !== ref.bbox?.width ||
        resolved.bbox.height !== ref.bbox?.height)

    if (bboxChanged || resolved.page_num !== ref.page_num) {
      latest.bumpCitationFocus()
      latest.selectCitation(resolved)
    }
  })()
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
    bbox: { x: 72, y: 48, width: 200, height: 24 },
  }

  focusCitation(citation)
  await new Promise((resolve) => window.setTimeout(resolve, 0))

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

/** Dev harness — profile criterion + chat chip paths open split view (BDA-034) */
export async function runCitationClickHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()

  store.setMode('rfp')
  store.addDocument({
    doc_id: 'click-harness-doc',
    filename: 'harness-bidder.pdf',
    mime: 'application/pdf',
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  })

  const [profile] = buildMockRfpProfiles(useSessionStore.getState().documents)
  if (!profile) throw new Error('runCitationClickHarness failed: no mock profile')

  store.setProfiles([profile])
  store.setWorkspaceView('profiles')

  const criterionCitation = profile.criteria.find((item) => item.citation)?.citation
  if (!criterionCitation) {
    throw new Error('runCitationClickHarness failed: criterion missing citation')
  }

  focusCitation(criterionCitation)
  await new Promise((resolve) => window.setTimeout(resolve, 0))

  const afterCriterion = useSessionStore.getState()
  if (afterCriterion.workspaceView !== 'split') {
    throw new Error('criterion click failed: expected split workspace view')
  }
  if (afterCriterion.activeDocId !== criterionCitation.doc_id) {
    throw new Error('criterion click failed: expected activeDocId to match citation doc')
  }

  store.setWorkspaceView('profiles')
  focusCitation({
    doc_id: criterionCitation.doc_id,
    block_id: `${criterionCitation.doc_id}:p3:i9`,
    page_num: 3,
    excerpt: 'Chat chip harness excerpt',
  })
  await new Promise((resolve) => window.setTimeout(resolve, 0))

  const afterChip = useSessionStore.getState()
  if (afterChip.workspaceView !== 'split' || afterChip.activeDocId !== criterionCitation.doc_id) {
    throw new Error('citation chip click failed: expected split view on cited doc')
  }

  store.resetSession()
}
