import { useState } from 'react'
import {
  ChevronDownIcon,
  MapPinIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  BrandDropdownContent,
  BrandMenuSection,
  brandMenuItemClass,
} from '@/components/ui/brand-menu'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MenuOptionContent } from '@/components/ui/menu-option-content'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { brandAccentStyles } from '@/lib/brand-accent'
import { listDefinedScoutJourneys } from '@/lib/scout/journeys-map'
import {
  requestScoutJourneyStart,
  scoutCanResumeTour,
  scoutLauncherTooltipLabel,
} from '@/lib/scout/scout-journey-start-bridge'
import { SCOUT_TARGETS, scoutTargetProps } from '@/lib/scout/targets'
import type { ScoutJourneyId } from '@/lib/scout/types'
import { cn } from '@/lib/utils'
import {
  selectActiveScoutJourney,
  selectScoutPanelOpen,
  useScoutStore,
} from '@/store/scout-store'

const JOURNEY_EYEBROW: Record<ScoutJourneyId, string> = {
  evaluate_rfp: 'Bid qualification',
  generate_proposal: 'Proposal drafting',
  mark_takeoff: 'Plan markup',
}

/** Header compass control — toggle Scout panel, resume tour, optional journey switcher (BDA-297). */
export function ScoutHeaderLauncher() {
  const activeJourney = useScoutStore(selectActiveScoutJourney)
  const panelOpen = useScoutStore(selectScoutPanelOpen)
  const setPanelOpen = useScoutStore((state) => state.setPanelOpen)
  const completedJourneys = useScoutStore((state) => state.completedJourneys)
  const [menuOpen, setMenuOpen] = useState(false)

  const canResume = scoutCanResumeTour(activeJourney, panelOpen)
  const tooltip = scoutLauncherTooltipLabel({ activeJourney, panelOpen })
  const journeys = listDefinedScoutJourneys()

  function handlePrimaryClick() {
    if (activeJourney) {
      setPanelOpen(!panelOpen)
      return
    }
    if (panelOpen) {
      setPanelOpen(false)
      return
    }
    setMenuOpen(true)
  }

  function handleStartJourney(journeyId: ScoutJourneyId) {
    setMenuOpen(false)
    requestScoutJourneyStart(journeyId)
  }

  return (
    <div
      {...scoutTargetProps(SCOUT_TARGETS.scoutLauncher)}
      className="inline-flex items-stretch rounded-full"
    >
      <Tooltip>
        <TooltipTrigger
          delay={250}
          render={
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={cn(
                'shadow-elevated border-border bg-surface relative size-10 rounded-l-full rounded-r-none border border-r-0',
                canResume && 'ring-primary/40 ring-2',
              )}
              aria-label={tooltip}
              onClick={handlePrimaryClick}
            >
              <MapPinIcon className="size-4" />
              {canResume ? (
                <span
                  className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full"
                  aria-hidden
                />
              ) : null}
            </Button>
          }
        />
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="shadow-elevated border-border bg-surface size-10 rounded-l-none rounded-r-full border px-0"
              aria-label="Scout tours menu"
            >
              <ChevronDownIcon className="size-3.5" />
            </Button>
          }
        />

        <BrandDropdownContent align="end" sideOffset={8}>
          {activeJourney ? (
            <BrandMenuSection accent="neutral">
              <div className="flex flex-col gap-1 p-1.5">
                <DropdownMenuItem
                  className={brandMenuItemClass('neutral')}
                  onClick={() => setPanelOpen(true)}
                >
                  <MenuOptionContent
                    title="Resume tour"
                    description="Reopen the Scout guide where you left off"
                    titleClassName={brandAccentStyles('neutral').title}
                  />
                </DropdownMenuItem>
                {panelOpen ? (
                  <DropdownMenuItem
                    className={brandMenuItemClass('neutral')}
                    onClick={() => setPanelOpen(false)}
                  >
                    <MenuOptionContent
                      title="Close guide"
                      description="Hide the Scout panel"
                      titleClassName={brandAccentStyles('neutral').title}
                    />
                  </DropdownMenuItem>
                ) : null}
              </div>
            </BrandMenuSection>
          ) : panelOpen ? (
            <BrandMenuSection accent="neutral">
              <div className="flex flex-col gap-1 p-1.5">
                <DropdownMenuItem
                  className={brandMenuItemClass('neutral')}
                  onClick={() => setPanelOpen(false)}
                >
                  <MenuOptionContent
                    title="Close welcome panel"
                    description="Hide the Scout panel"
                    titleClassName={brandAccentStyles('neutral').title}
                  />
                </DropdownMenuItem>
              </div>
            </BrandMenuSection>
          ) : null}

          {journeys.map((journey) => {
            const accent = journey.accent
            const styles = brandAccentStyles(accent)
            const completed = completedJourneys.includes(journey.id)
            const description = completed
              ? `${journey.description} · Completed before`
              : journey.description

            return (
              <BrandMenuSection key={journey.id} accent={accent}>
                <div className="px-3 pt-3 pb-1">
                  <p className={cn('text-[11px] font-semibold tracking-wide uppercase', styles.title)}>
                    {JOURNEY_EYEBROW[journey.id]}
                  </p>
                </div>
                <div className="flex flex-col gap-1 p-1.5 pt-0">
                  <DropdownMenuItem
                    className={brandMenuItemClass(accent, activeJourney === journey.id)}
                    onClick={() => handleStartJourney(journey.id)}
                  >
                    <MenuOptionContent
                      title={journey.title}
                      description={description}
                      titleClassName={styles.title}
                    />
                  </DropdownMenuItem>
                </div>
              </BrandMenuSection>
            )
          })}
        </BrandDropdownContent>
      </DropdownMenu>
    </div>
  )
}
