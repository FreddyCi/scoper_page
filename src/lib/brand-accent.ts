export type BrandAccent = 'sky' | 'violet' | 'amber' | 'neutral'

type BrandAccentStyles = {
  section: string
  title: string
  description: string
  itemHover: string
  itemSelected: string
  trigger: string
  indicator: string
  dot: string
}

export const BRAND_ACCENT: Record<BrandAccent, BrandAccentStyles> = {
  sky: {
    section: 'border-sky-200/80 bg-surface from-sky-50/70',
    title: 'text-sky-950',
    description: 'text-muted-foreground',
    itemHover:
      'focus:bg-sky-50/90 data-[highlighted]:bg-sky-50/90 focus:text-sky-950 data-[highlighted]:text-sky-950',
    itemSelected: 'bg-sky-50/90 ring-1 ring-sky-200/80',
    trigger: 'border-sky-200/80 bg-sky-50/80 text-sky-950 hover:bg-sky-100/80',
    indicator: 'text-sky-700',
    dot: 'bg-sky-400',
  },
  violet: {
    section: 'border-violet-200/80 bg-surface from-violet-50/60',
    title: 'text-violet-950',
    description: 'text-muted-foreground',
    itemHover:
      'focus:bg-violet-50/90 data-[highlighted]:bg-violet-50/90 focus:text-violet-950 data-[highlighted]:text-violet-950',
    itemSelected: 'bg-violet-50/90 ring-1 ring-violet-200/80',
    trigger: 'border-violet-200/80 bg-violet-50/80 text-violet-950 hover:bg-violet-100/80',
    indicator: 'text-violet-700',
    dot: 'bg-violet-400',
  },
  amber: {
    section: 'border-amber-200/80 bg-surface from-amber-50/70',
    title: 'text-amber-950',
    description: 'text-muted-foreground',
    itemHover:
      'focus:bg-amber-50/90 data-[highlighted]:bg-amber-50/90 focus:text-amber-950 data-[highlighted]:text-amber-950',
    itemSelected: 'bg-amber-50/90 ring-1 ring-amber-200/80',
    trigger: 'border-amber-200/80 bg-amber-50/80 text-amber-950 hover:bg-amber-100/80',
    indicator: 'text-amber-800',
    dot: 'bg-amber-400',
  },
  neutral: {
    section: 'border-border/80 bg-surface from-muted/30',
    title: 'text-foreground',
    description: 'text-muted-foreground',
    itemHover: 'focus:bg-muted/60 data-[highlighted]:bg-muted/60',
    itemSelected: 'bg-muted/50 ring-1 ring-border/80',
    trigger: 'border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted/70',
    indicator: 'text-muted-foreground',
    dot: 'bg-muted-foreground/40',
  },
}

export function brandAccentStyles(accent: BrandAccent): BrandAccentStyles {
  return BRAND_ACCENT[accent]
}
