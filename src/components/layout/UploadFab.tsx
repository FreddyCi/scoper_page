import { UploadIcon } from 'lucide-react'

import { useUploadQueueContext } from '@/components/layout/UploadQueueProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type UploadFabProps = {
  className?: string
}

export function UploadFab({ className }: UploadFabProps) {
  const open = useSessionStore((s) => s.uploadPopupOpen)
  const setUploadPopupOpen = useSessionStore((s) => s.setUploadPopupOpen)
  const { count } = useUploadQueueContext()

  return (
    <div className={cn('relative', className)}>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="shadow-elevated border-border bg-surface relative size-10 rounded-full border"
        aria-label="Upload documents"
        aria-expanded={open}
        onClick={() => setUploadPopupOpen(!open)}
      >
        <UploadIcon className="size-4" />
        {count > 0 ? (
          <Badge
            variant="default"
            className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5"
          >
            {count}
          </Badge>
        ) : null}
      </Button>
    </div>
  )
}
