import { useState } from 'react'
import {
  ChevronDownIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  Grid2X2Icon,
  MapPinIcon,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MenuOptionContent } from '@/components/ui/menu-option-content'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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

const JOURNEY_MENU_ICONS: Record<ScoutJourneyId, LucideIcon> = {
  evaluate_rfp: ClipboardCheckIcon,
  generate_proposal: FileTextIcon,
  mark_takeoff: Grid2X2Icon,
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

        <DropdownMenuContent align="end" className="w-72">
          {activeJourney ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Current tour</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setPanelOpen(true)}>
                  <MenuOptionContent
                    title="Resume tour"
                    description="Reopen the Scout guide where you left off"
                  />
                </DropdownMenuItem>
                {panelOpen ? (
                  <DropdownMenuItem onClick={() => setPanelOpen(false)}>
                    <MenuOptionContent title="Close guide" description="Hide the Scout panel" />
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          ) : panelOpen ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Scout welcome</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setPanelOpen(false)}>
                  <MenuOptionContent title="Close welcome panel" description="Hide the Scout panel" />
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}

          <DropdownMenuGroup>
            <DropdownMenuLabel>Start a tour</DropdownMenuLabel>
            {journeys.map((journey) => {
              const Icon = JOURNEY_MENU_ICONS[journey.id]
              const completed = completedJourneys.includes(journey.id)

              return (
                <DropdownMenuItem key={journey.id} onClick={() => handleStartJourney(journey.id)}>
                  <Icon className="text-muted-foreground size-4 shrink-0" />
                  <MenuOptionContent
                    title={journey.title}
                    description={
                      completed ? `${journey.description} · Completed before` : journey.description
                    }
                  />
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
