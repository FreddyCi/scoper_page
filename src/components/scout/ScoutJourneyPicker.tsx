import {
  ClipboardCheckIcon,
  FileTextIcon,
  Grid2X2Icon,
  type LucideIcon,
} from 'lucide-react'

import { useScout } from '@/components/scout/scout-context'
import { Badge } from '@/components/ui/badge'
import {
  featureCardDescriptionClass,
  featureCardInnerPanelClass,
  featureCardShellClass,
  featureCardTitleClass,
} from '@/components/workspace/feature-card-styles'
import { brandAccentStyles, type BrandAccent } from '@/lib/brand-accent'
import { listDefinedScoutJourneys } from '@/lib/scout/journeys-map'
import { SCOUT_TARGETS, scoutTargetProps } from '@/lib/scout/targets'
import type { ScoutJourney, ScoutJourneyId } from '@/lib/scout/types'
import { cn } from '@/lib/utils'
import { useScoutStore } from '@/store/scout-store'

const JOURNEY_CARD_BG: Record<BrandAccent, string> = {
  sky: 'bg-gradient-to-b from-[#cfefff] to-[#e8f7ff]',
  violet: 'bg-[#f3e8ff]',
  rose: 'bg-[#ffe4ec]',
  amber: 'bg-[#fff0db]',
  neutral: 'bg-muted/60',
}

const JOURNEY_ICONS: Record<ScoutJourneyId, LucideIcon> = {
  evaluate_rfp: ClipboardCheckIcon,
  generate_proposal: FileTextIcon,
  mark_takeoff: Grid2X2Icon,
}

const JOURNEY_EYEBROW: Record<ScoutJourneyId, string> = {
  evaluate_rfp: 'Bid qualification',
  generate_proposal: 'Proposal drafting',
  mark_takeoff: 'Plan markup',
}

type ScoutJourneyCardProps = {
  journey: ScoutJourney
  completed: boolean
  onStart: (journeyId: ScoutJourneyId) => void
}

function ScoutJourneyCard({ journey, completed, onStart }: ScoutJourneyCardProps) {
  const accent = brandAccentStyles(journey.accent)
  const Icon = JOURNEY_ICONS[journey.id]

  return (
    <button
      type="button"
      onClick={() => onStart(journey.id)}
      className={cn(
        'group text-left',
        featureCardShellClass,
        JOURNEY_CARD_BG[journey.accent],
        'cursor-pointer hover:-translate-y-0.5',
      )}
    >
      <div className="px-1 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <p className={cn('text-[11px] font-semibold tracking-wide uppercase', accent.title)}>
            {JOURNEY_EYEBROW[journey.id]}
          </p>
          {completed ? (
            <Badge variant="secondary" className="text-[10px] font-medium tracking-wide uppercase">
              Completed
            </Badge>
          ) : null}
        </div>
        <h3 className={featureCardTitleClass}>{journey.title}</h3>
        <p className={featureCardDescriptionClass}>{journey.description}</p>
      </div>

      <div
        aria-hidden
        className={cn(
          featureCardInnerPanelClass,
          'mt-5 flex min-h-[9rem] flex-col items-center justify-center gap-3 p-4',
        )}
      >
        <span
          className={cn(
            'flex size-12 items-center justify-center rounded-2xl border shadow-sm',
            accent.section,
          )}
        >
          <Icon className={cn('size-6', accent.indicator)} />
        </span>
        <span className={cn('text-sm font-medium', accent.title)}>Walk the sample</span>
      </div>
    </button>
  )
}

type ScoutJourneyPickerProps = {
  className?: string
}

/** Landing journey cards — starts Scout tours via `startJourneySafe` (BDA-293). */
export function ScoutJourneyPicker({ className }: ScoutJourneyPickerProps) {
  const { startJourneySafe } = useScout()
  const completedJourneys = useScoutStore((s) => s.completedJourneys)
  const journeys = listDefinedScoutJourneys()

  return (
    <div
      {...scoutTargetProps(SCOUT_TARGETS.landingJourneyPicker)}
      className={cn('grid w-full grid-cols-1 gap-5 sm:grid-cols-3', className)}
    >
      {journeys.map((journey) => (
        <ScoutJourneyCard
          key={journey.id}
          journey={journey}
          completed={completedJourneys.includes(journey.id)}
          onStart={startJourneySafe}
        />
      ))}
    </div>
  )
}
