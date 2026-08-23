import { ScoutJourneyPicker } from '@/components/scout/ScoutJourneyPicker'
import {
  WORKSPACE_LANDING_HEADLINE,
  WORKSPACE_LANDING_SUBCOPY,
} from '@/lib/workspace-landing-copy'
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
        <h1 className="text-foreground font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          {WORKSPACE_LANDING_HEADLINE}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-relaxed">
          {WORKSPACE_LANDING_SUBCOPY}
        </p>
      </div>

      <ScoutJourneyPicker className="mt-8 max-w-5xl sm:mt-10" />
    </div>
  )
}
