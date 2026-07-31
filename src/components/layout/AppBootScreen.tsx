import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'

type AppBootScreenProps = {
  className?: string
  message?: string
  detail?: string
}

/** Full-viewport shell shown while dev harnesses / cold start complete (BDA-195 UX). */
export function AppBootScreen({
  className,
  message = 'Loading Scoper…',
  detail,
}: AppBootScreenProps) {
  return (
    <div
      className={cn(
        'bg-canvas text-foreground flex min-h-svh flex-col items-center justify-center px-6',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2Icon className="text-muted-foreground size-8 animate-spin" aria-hidden />
      <p className="mt-4 text-sm font-medium">{message}</p>
      {detail ? (
        <p className="text-muted-foreground mt-1 max-w-sm text-center text-xs">{detail}</p>
      ) : null}
    </div>
  )
}
