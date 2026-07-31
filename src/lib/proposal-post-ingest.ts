import type { DocumentMeta, IngestResult } from '@/lib/types'

export type ProposalPostIngestPatch = {
  evaluationDocId?: string
  workspaceView: 'profiles'
}

/** Prefer PDF from the batch just ingested, then any session PDF. */
export function pickProposalEvaluationDocId(
  documents: DocumentMeta[],
  ingestedResults: IngestResult[],
): string | null {
  const batchPdf = ingestedResults.find((result) => result.mime === 'application/pdf')
  if (batchPdf) return batchPdf.doc_id

  const sessionPdf = documents.find(
    (doc) => doc.mime === 'application/pdf' && doc.role !== 'supporting',
  )
  if (sessionPdf) return sessionPdf.doc_id

  return documents[0]?.doc_id ?? null
}

/** Proposal mode landing after upload — no scope compare (BDA-140). */
export function getProposalPostIngestPatch(
  state: { evaluationDocId: string | null; documents: DocumentMeta[] },
  ingestedResults: IngestResult[],
): ProposalPostIngestPatch {
  const patch: ProposalPostIngestPatch = { workspaceView: 'profiles' }

  if (state.evaluationDocId == null) {
    const docId = pickProposalEvaluationDocId(state.documents, ingestedResults)
    if (docId) patch.evaluationDocId = docId
  }

  return patch
}

/** Dev harness — proposal post-ingest routing (BDA-140) */
export function runProposalPostIngestHarness(): void {
  const empty = getProposalPostIngestPatch(
    { evaluationDocId: null, documents: [] },
    [],
  )
  if (empty.workspaceView !== 'profiles' || empty.evaluationDocId != null) {
    throw new Error('runProposalPostIngestHarness: empty session should only set profiles view')
  }

  const doc: DocumentMeta = {
    doc_id: 'ingest-rfp',
    filename: 'Solicitation.pdf',
    mime: 'application/pdf',
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  }

  const ingested: IngestResult = {
    doc_id: 'ingest-rfp',
    filename: 'Solicitation.pdf',
    mime: 'application/pdf',
    block_count: 3,
    ocr_used: false,
  }

  const patch = getProposalPostIngestPatch(
    { evaluationDocId: null, documents: [doc] },
    [ingested],
  )
  if (patch.evaluationDocId !== 'ingest-rfp' || patch.workspaceView !== 'profiles') {
    throw new Error('runProposalPostIngestHarness: expected RFP doc + profiles view')
  }

  const keepExisting = getProposalPostIngestPatch(
    { evaluationDocId: 'existing-rfp', documents: [doc] },
    [ingested],
  )
  if (keepExisting.evaluationDocId != null) {
    throw new Error('runProposalPostIngestHarness: must not overwrite evaluationDocId')
  }
}
