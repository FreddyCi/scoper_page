import { isDocumentRole } from '@/lib/document-roles'
import type { DocumentMeta, DocumentRole } from '@/lib/types'
import { getDuckdbClient } from '@/services/duckdb-client'
import { useSessionStore } from '@/store/session-store'

/** Read persisted role from DuckDB documents table */
export async function fetchDocumentRole(docId: string): Promise<DocumentRole | null> {
  const client = await getDuckdbClient()
  const rows = await client.query<{ role: string }>(
    'SELECT role FROM documents WHERE doc_id = ?',
    [docId],
  )

  const role = rows[0]?.role
  return isDocumentRole(role) ? role : null
}

/** Update documents.role in DuckDB */
export async function persistDocumentRole(docId: string, role: DocumentRole): Promise<void> {
  const client = await getDuckdbClient()
  await client.updateDocumentRole(docId, role)
}

/** Update session store and persist role to DuckDB (BDA-070) */
export async function setDocumentRole(docId: string, role: DocumentRole): Promise<void> {
  useSessionStore.getState().updateDocumentRole(docId, role)
  await persistDocumentRole(docId, role)
}

/** Resolve role for ingest — preserve existing DuckDB or store value when re-uploading */
export async function resolveDocumentRoleForIngest(
  docId: string,
  storeDocuments: DocumentMeta[],
): Promise<DocumentRole> {
  const fromStore = storeDocuments.find((doc) => doc.doc_id === docId)?.role
  if (fromStore && fromStore !== 'unknown') {
    return fromStore
  }

  const fromDb = await fetchDocumentRole(docId)
  return fromDb ?? 'unknown'
}

/** Dev harness — tag baseline + change; roles persist in store and DuckDB (BDA-070) */
export async function runDocumentRoleHarness(): Promise<void> {
  const store = useSessionStore.getState()
  store.resetSession()

  const baseline: DocumentMeta = {
    doc_id: 'role-harness-baseline',
    filename: 'Baseline-SOW.pdf',
    mime: 'application/pdf',
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  }

  const changeRequest: DocumentMeta = {
    doc_id: 'role-harness-change',
    filename: 'Change-Addendum.pdf',
    mime: 'application/pdf',
    role: 'unknown',
    uploaded_at: new Date().toISOString(),
  }

  const client = await getDuckdbClient()
  await client.insertDocument(baseline)
  await client.insertDocument(changeRequest)
  store.setDocuments([baseline, changeRequest])

  await setDocumentRole(baseline.doc_id, 'baseline')
  await setDocumentRole(changeRequest.doc_id, 'change_request')

  const afterStore = useSessionStore.getState()
  const storedBaseline = afterStore.documents.find((doc) => doc.doc_id === baseline.doc_id)
  const storedChange = afterStore.documents.find((doc) => doc.doc_id === changeRequest.doc_id)

  if (storedBaseline?.role !== 'baseline' || storedChange?.role !== 'change_request') {
    throw new Error('runDocumentRoleHarness failed: store roles not updated')
  }

  const rows = await client.query<{ doc_id: string; role: string }>(
    'SELECT doc_id, role FROM documents WHERE doc_id IN (?, ?)',
    [baseline.doc_id, changeRequest.doc_id],
  )

  const roleById = new Map(rows.map((row) => [row.doc_id, row.role]))
  if (roleById.get(baseline.doc_id) !== 'baseline') {
    throw new Error('runDocumentRoleHarness failed: baseline role not in DuckDB')
  }
  if (roleById.get(changeRequest.doc_id) !== 'change_request') {
    throw new Error('runDocumentRoleHarness failed: change_request role not in DuckDB')
  }

  store.resetSession()
}
