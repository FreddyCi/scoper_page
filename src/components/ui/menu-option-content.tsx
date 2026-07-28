import { cn } from '@/lib/utils'

type MenuOptionContentProps = {
  title: string
  description: string
  className?: string
}

/** Stacked title + description for dropdown menu rows */
export function MenuOptionContent({ title, description, className }: MenuOptionContentProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <span className="text-foreground text-sm leading-snug font-medium">{title}</span>
      <span className="text-muted-foreground text-xs leading-relaxed font-normal">{description}</span>
    </div>
  )
}

type MenuOptionHeaderProps = {
  title: string
  description: string
}

/** Header block for descriptive dropdown menus */
export function MenuOptionHeader({ title, description }: MenuOptionHeaderProps) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{description}</p>
    </div>
  )
}
