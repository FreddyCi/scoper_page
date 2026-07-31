import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Text shimmer utility from `shadcn/tailwind.css` (imported in `src/index.css`).
 * Use on status labels during streaming, compaction, or tool runs.
 *
 * @see https://ui.shadcn.com/docs/utils/shimmer
 */
export const SHIMMER_CLASS = 'shimmer'

export type ShimmerProps = React.ComponentProps<'span'>

/** Inline text with the shared shadcn shimmer sweep (BDA-172). */
export function Shimmer({ className, ...props }: ShimmerProps) {
  return (
    <span
      data-slot="shimmer"
      className={cn(SHIMMER_CLASS, 'text-muted-foreground', className)}
      {...props}
    />
  )
}

/** Dev harness — shimmer export (BDA-172) */
export function runShimmerHarness(): void {
  if (SHIMMER_CLASS !== 'shimmer') {
    throw new Error('runShimmerHarness: SHIMMER_CLASS should be "shimmer"')
  }
}
