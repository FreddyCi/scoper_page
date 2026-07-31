import { useCallback } from 'react'

import { ingestFiles, type IngestProgress } from '@/services/ingest-router'
import type { IngestResult } from '@/lib/types'
import { applyPostIngestModeEffects } from '@/lib/post-ingest-mode-effects'
import { useSessionStore } from '@/store/session-store'

export type IngestPipelineResult = {
  queued: number
  succeeded: IngestResult[]
  failed: Array<{ filename: string; error: string }>
}

export function useIngestPipeline() {
  const commitIngestResults = useSessionStore((s) => s.commitIngestResults)

  const enqueueFiles = useCallback(
    async (
      files: File[],
      callbacks?: { onProgress?: (progress: IngestProgress) => void },
    ): Promise<IngestPipelineResult> => {
      const ocrEnabled = useSessionStore.getState().ocrEnabled
      const { results, errors } = await ingestFiles(files, {
        ocrEnabled,
        onProgress: callbacks?.onProgress,
      })

      if (results.length > 0) {
        commitIngestResults(results)
        await applyPostIngestModeEffects(results)
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
