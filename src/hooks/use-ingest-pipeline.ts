import { useCallback } from 'react'

import { ingestFiles } from '@/services/ingest-router'
import { buildRfpProfiles } from '@/services/build-rfp-profiles'
import { compareScope } from '@/services/compare-scope'
import type { IngestResult } from '@/lib/types'
import { useSessionStore } from '@/store/session-store'

export type IngestPipelineResult = {
  queued: number
  succeeded: IngestResult[]
  failed: Array<{ filename: string; error: string }>
}

export function useIngestPipeline() {
  const commitIngestResults = useSessionStore((s) => s.commitIngestResults)

  const enqueueFiles = useCallback(
    async (files: File[]): Promise<IngestPipelineResult> => {
      const ocrEnabled = useSessionStore.getState().ocrEnabled
      const { results, errors } = await ingestFiles(files, { ocrEnabled })

      if (results.length > 0) {
        commitIngestResults(results)

        const { mode, documents } = useSessionStore.getState()
        if (mode === 'rfp' && documents.length > 0) {
          const profiles = await buildRfpProfiles(documents)
          useSessionStore.getState().setProfiles(profiles)
        }

        if (mode === 'scope_creep') {
          const baseline = documents.find((doc) => doc.role === 'baseline')
          const change = documents.find((doc) => doc.role === 'change_request')
          if (baseline && change) {
            await compareScope({
              baselineDocId: baseline.doc_id,
              candidateDocId: change.doc_id,
            })
          }
        }
      }

      if (import.meta.env.DEV) {
        console.debug('[ingest-pipeline]', {
          queued: files.length,
          succeeded: results.length,
          failed: errors.length,
        })
      }

      return {
        queued: files.length,
        succeeded: results,
        failed: errors,
      }
    },
    [commitIngestResults],
  )

  return { enqueueFiles }
}
