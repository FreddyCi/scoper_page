/** Pastel accent backgrounds for feature-style cards */
export const FEATURE_CARD_ACCENTS = [
  'bg-[#dbe4ff]',
  'bg-gradient-to-b from-[#cfefff] to-[#e8f7ff]',
  'bg-[#dff5ea]',
  'bg-[#f3e8ff]',
  'bg-[#fff0db]',
  'bg-[#ffe4ec]',
] as const

export function featureCardAccent(index: number): string {
  return FEATURE_CARD_ACCENTS[index % FEATURE_CARD_ACCENTS.length]!
}

export const featureCardShellClass =
  'flex min-h-[18rem] flex-col overflow-hidden rounded-[2rem] p-6 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] transition-transform duration-200 hover:-translate-y-0.5'

export const featureCardInnerPanelClass =
  'border-border/40 bg-surface/95 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-[0_8px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-sm'

export const featureCardTitleClass = 'font-serif text-xl font-medium tracking-tight text-foreground'

export const featureCardDescriptionClass =
  'text-muted-foreground mt-2 text-center text-sm leading-relaxed'
