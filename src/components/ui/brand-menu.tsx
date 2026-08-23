import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { overlaySectionTitleClass } from '@/lib/overlay-chrome'
import { brandAccentStyles, type BrandAccent } from '@/lib/brand-accent'
import { DropdownMenuContent } from '@/components/ui/dropdown-menu'

type BrandDropdownContentProps = React.ComponentProps<typeof DropdownMenuContent>

/** Rounded workspace panel — matches Share drawer section styling. */
export function BrandDropdownContent({ className, children, ...props }: BrandDropdownContentProps) {
  return (
    <DropdownMenuContent
      className={cn(
        'border-border bg-workspace shadow-elevated flex w-80 min-h-0 max-h-(--available-height) flex-col gap-2 overflow-x-hidden overflow-y-auto rounded-2xl p-2 ring-0',
        className,
      )}
      {...props}
    >
      {children}
    </DropdownMenuContent>
  )
}

type BrandMenuSectionProps = {
  accent: BrandAccent
  children: ReactNode
  className?: string
}

export function BrandMenuSection({ accent, children, className }: BrandMenuSectionProps) {
  const styles = brandAccentStyles(accent)

  return (
    <section
      className={cn(
        'shadow-panel rounded-xl border bg-gradient-to-br to-transparent',
        styles.section,
        className,
      )}
    >
      {children}
    </section>
  )
}

type BrandMenuSectionHeaderProps = {
  accent: BrandAccent
  title: string
  description: string
}

export function BrandMenuSectionHeader({ accent, title, description }: BrandMenuSectionHeaderProps) {
  const styles = brandAccentStyles(accent)

  return (
    <div className="px-3 pt-3 pb-2">
      <p className={cn(overlaySectionTitleClass, styles.title)}>{title}</p>
      <p className={cn('mt-1 text-xs leading-relaxed', styles.description)}>{description}</p>
    </div>
  )
}

export function brandMenuItemClass(accent: BrandAccent, selected = false): string {
  const styles = brandAccentStyles(accent)
  return cn(
    'items-start rounded-xl py-2.5 pr-9 pl-3',
    styles.itemHover,
    selected && styles.itemSelected,
    `[&_[data-slot=dropdown-menu-radio-item-indicator]]:top-2.5 ${styles.indicator}`,
  )
}

export function brandRoleTriggerClass(accent: BrandAccent): string {
  return cn(
    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    brandAccentStyles(accent).trigger,
  )
}
