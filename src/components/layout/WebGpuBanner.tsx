import { useEffect, useState } from 'react'
import { AlertTriangleIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { resolveWebGpuUnavailableMessage } from '@/lib/webgpu-user-messages'
import { getScoperClient } from '@/services/scoper-client'

type WebGpuBannerProps = {
  className?: string
}

function resolveScoperBannerMessage(state: {
  webGpuAvailable: boolean | null
  webGpuError: string | null
  maxSeqLenNotice: string | null
  lastError: string | null
}): string | null {
  if (state.webGpuAvailable === false) {
    return resolveWebGpuUnavailableMessage(state.webGpuError)
  }
  if (state.maxSeqLenNotice) {
    return state.maxSeqLenNotice
  }
  if (state.lastError?.toLowerCase().includes('maxseqlen')) {
    return state.lastError
  }
  return null
}

/** Surfaces WebGPU availability and Scoper engine hints (BDA-050, BDA-152) */
export function WebGpuBanner({ className }: WebGpuBannerProps) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const client = getScoperClient()

    const sync = () => {
      setMessage(resolveScoperBannerMessage(client.getState()))
    }

    client.setListeners({ onStateChange: sync })
    void client.probeEnvironment().then(sync)

    return () => {
      client.setListeners({})
    }
  }, [])

  if (!message) return null

  return (
    <div
      className={cn(
        'border-amber-200 bg-amber-50 text-amber-950 flex items-start gap-2 border-b px-4 py-2.5 text-sm',
        className,
      )}
      role="status"
    >
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  )
}
