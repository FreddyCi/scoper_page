import { UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UploadFabProps = {
  className?: string
}

/** Bottom-left FAB shell — popup wired in BDA-013 */
export function UploadFab({ className }: UploadFabProps) {
  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className={cn(
        'shadow-elevated border-border bg-surface size-10 rounded-full border',
        className,
      )}
      aria-label="Upload documents"
    >
      <UploadIcon className="size-4" />
    </Button>
  )
}
