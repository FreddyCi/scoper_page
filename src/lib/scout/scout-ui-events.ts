/** Custom events Scout actions dispatch for UI not yet on session store (BDA-282). */
export const SCOUT_UI_EVENTS = {
  openTakeoffPanel: 'scoper:scout-open-takeoff-panel',
  openShareSheet: 'scoper:scout-open-share-sheet',
} as const

export type ScoutUiEventName = (typeof SCOUT_UI_EVENTS)[keyof typeof SCOUT_UI_EVENTS]

export function dispatchScoutUiEvent(name: ScoutUiEventName): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name))
}
