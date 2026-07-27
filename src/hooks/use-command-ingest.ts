import { useCallback, useState } from 'react'

import type { CommandInputSubmitPayload } from '@/components/workspace/CommandInputCard'
import { useIngestPipeline } from '@/hooks/use-ingest-pipeline'
import { useSessionStore } from '@/store/session-store'

export function useCommandIngest() {
  const sendChatPrompt = useSessionStore((s) => s.sendChatPrompt)
  const { enqueueFiles } = useIngestPipeline()
  const [isIngesting, setIsIngesting] = useState(false)

  const submitCommand = useCallback(
    async (payload: CommandInputSubmitPayload) => {
      if (payload.files.length > 0) {
        setIsIngesting(true)
        try {
          const { succeeded, failed } = await enqueueFiles(payload.files)
          if (failed.length > 0 && succeeded.length === 0) {
            throw new Error(failed[0]?.error ?? 'Ingest failed')
          }
        } finally {
          setIsIngesting(false)
        }
      }

      if (payload.prompt.trim()) {
        sendChatPrompt(payload.prompt)
      }
    },
    [enqueueFiles, sendChatPrompt],
  )

  return { submitCommand, isIngesting }
}
