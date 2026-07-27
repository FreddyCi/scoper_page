import { useCallback } from 'react'

import { ingestFile } from '@/services/ingest-router'

export type IngestPipelineResult = {
  queued: number
  fileNames: string[]
}

/**
 * Stub ingest hook — BDA-023 wires `ingestFile`; BDA-024 updates session store.
 */
export function useIngestPipeline() {
  const enqueueFiles = useCallback(
    async (files: File[]): Promise<IngestPipelineResult> => {
      if (import.meta.env.DEV) {
        console.debug(
          '[ingest-pipeline] queued files (stub)',
          files.map((file) => file.name),
        )
      }

      for (const file of files) {
        try {
          await ingestFile(file)
        } catch {
          // Expected until BDA-023 implements ingest-router
        }
      }

      return {
        queued: files.length,
        fileNames: files.map((file) => file.name),
      }
    },
    [],
  )

  return { enqueueFiles }
}
