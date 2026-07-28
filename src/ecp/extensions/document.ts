import { capabilityId } from '@/ecp/types'
import type { DocumentMeta, FindClauseResult } from '@/lib/types'
import { compareScope, flagCreep } from '@/services/compare-scope'
import { buildRfpProfilesForDocuments } from '@/services/build-rfp-profiles'
import { findClause } from '@/services/find-clause'
import { ingestFile } from '@/services/ingest-router'
import { searchDocumentBlocks } from '@/services/document-search'

export const DOCUMENT_EXTENSION_ID = '@demo/document'

type CompareScopeInput = {
  baselineDocId: string
  candidateDocId: string
}

type FlagCreepInput = {
  baselineDocId: string
  candidateDocId: string
}

export const documentExtension = {
  id: DOCUMENT_EXTENSION_ID,
  label: 'Document agent tools',
  capabilities: {
    parse: async (input: unknown) => {
      const payload = input as {
        file: File
        ocrEnabled?: boolean
      }

      if (!(payload.file instanceof File)) {
        throw new Error('@demo/document.parse requires a File')
      }

      return ingestFile(payload.file, { ocrEnabled: payload.ocrEnabled })
    },
    search: async (input: unknown) => {
      const payload = input as {
        query: string
        docIds?: string[]
        limit?: number
      }

      if (!payload.query?.trim()) {
        throw new Error('@demo/document.search requires query')
      }

      return searchDocumentBlocks(payload.query, {
        docIds: payload.docIds,
        limit: payload.limit,
      })
    },
    find_clause: async (input: unknown) => {
      const payload = input as {
        query: string
        docIds?: string[]
        limit?: number
      }

      if (!payload.query?.trim()) {
        throw new Error('@demo/document.find_clause requires query')
      }

      return findClause(payload.query, {
        docIds: payload.docIds,
        limit: payload.limit,
      })
    },
    build_rfp_profiles: async (input: unknown) => {
      const payload = input as { documents: DocumentMeta[] }
      if (!Array.isArray(payload.documents) || payload.documents.length === 0) {
        throw new Error('@demo/document.build_rfp_profiles requires documents[]')
      }

      return buildRfpProfilesForDocuments(payload.documents)
    },
    compare_scope: async (input: unknown) => {
      const payload = input as CompareScopeInput
      if (!payload.baselineDocId || !payload.candidateDocId) {
        throw new Error('@demo/document.compare_scope requires baselineDocId and candidateDocId')
      }

      return compareScope(payload)
    },
    flag_creep: async (input: unknown) => {
      const payload = input as FlagCreepInput
      if (!payload.baselineDocId || !payload.candidateDocId) {
        throw new Error('@demo/document.flag_creep requires baselineDocId and candidateDocId')
      }

      return flagCreep(payload)
    },
  },
} as const

export const DOCUMENT_CAPABILITIES = {
  parse: capabilityId(DOCUMENT_EXTENSION_ID, 'parse'),
  search: capabilityId(DOCUMENT_EXTENSION_ID, 'search'),
  find_clause: capabilityId(DOCUMENT_EXTENSION_ID, 'find_clause'),
  build_rfp_profiles: capabilityId(DOCUMENT_EXTENSION_ID, 'build_rfp_profiles'),
  compare_scope: capabilityId(DOCUMENT_EXTENSION_ID, 'compare_scope'),
  flag_creep: capabilityId(DOCUMENT_EXTENSION_ID, 'flag_creep'),
} as const

export type { FindClauseResult }
