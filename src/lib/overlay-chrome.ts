/**
 * Shared surface, typography, and control styles for slideouts, dialogs, drawers, and popovers.
 * Keeps light branded panels readable (surface + foreground) with consistent hover on ghost controls.
 */
export const overlayPanelClass = 'bg-surface text-foreground border-border shadow-panel'

/** Primary overlay heading — dialogs, sheets, drawers, Scout panel titles (landing serif). */
export const overlayTitleClass =
  'font-serif text-xl font-medium tracking-tight text-foreground'

/** Secondary overlay heading — popovers, questionnaire prompts, section headers. */
export const overlaySectionTitleClass =
  'font-serif text-base font-semibold tracking-tight text-foreground'

export const overlayDescriptionClass = 'text-sm leading-relaxed text-muted-foreground'

/** Ghost icon/text controls on light overlay surfaces. */
export const overlayChromeGhostButtonClass =
  'text-muted-foreground hover:bg-muted hover:text-foreground'
