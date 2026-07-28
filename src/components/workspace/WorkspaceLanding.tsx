import { QuickActionCards } from '@/components/workspace/QuickActionCards'
import { cn } from '@/lib/utils'

type WorkspaceLandingProps = {
  className?: string
}

export function WorkspaceLanding({ className }: WorkspaceLandingProps) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center px-[var(--spacing-panel)] py-10',
        className,
      )}
    >
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <p className="text-subtle-foreground text-xs font-medium tracking-[0.2em] uppercase">
          Scoper Doc Agent
        </p>
        <h1 className="text-foreground font-serif mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
          Structure that adapts to your review
        </h1>
        <p className="text-muted-foreground mt-4 max-w-lg text-sm leading-relaxed">
          Upload procurement documents and markdown context — parsed locally, never sent to a
          server.
        </p>
      </div>

      <QuickActionCards className="mt-10 sm:mt-12" />
    </div>
  )
}
