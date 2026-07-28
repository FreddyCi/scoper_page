import { useEffect, useState } from 'react'
import { AlertTriangleIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getScoperClient } from '@/services/scoper-client'

type WebGpuBannerProps = {
  className?: string
}

/** Surfaces WebGPU availability for on-device Scoper chat (BDA-050) */
export function WebGpuBanner({ className }: WebGpuBannerProps) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const client = getScoperClient()
    void client.probeEnvironment().then((state) => {
      if (state.webGpuAvailable) {
        setMessage(null)
        return
      }
      setMessage(
        state.webGpuError ??
          'WebGPU is unavailable. On-device chat is disabled; document parsing still works.',
      )
    })
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
