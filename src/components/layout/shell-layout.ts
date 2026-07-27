/** Shared shell column classes — keep header/body widths in sync (~65% / ~35%) */
export const shellWorkspaceColumnClass = 'min-w-0 flex-1 basis-0 grow'

export const shellChatColumnWidthClass =
  'w-[clamp(17.5rem,35%,26.25rem)] min-w-[17.5rem] max-w-[26.25rem]'

export const shellChatColumnClass = `${shellChatColumnWidthClass} shrink-0 grow-0`

export const shellChatColumnTransitionClass =
  'overflow-hidden transition-[width,min-width,max-width,opacity,padding] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none'

export const shellChatColumnCollapsedClass =
  'w-0 min-w-0 max-w-0 shrink-0 grow-0 opacity-0 pointer-events-none px-0'

export const shellPanelMinWidthClass = 'min-w-[720px]'

export function shellChatColumnClasses(collapsed: boolean) {
  return collapsed ? shellChatColumnCollapsedClass : shellChatColumnClass
}
