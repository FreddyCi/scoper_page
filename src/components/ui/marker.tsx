import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { SHIMMER_CLASS } from "@/components/ui/shimmer"

/**
 * Class for live agent markers (`AgentActivityMarkers`, compacting status rows).
 * Prefer {@link MarkerContent} `shimmer` prop instead of applying manually.
 */
export const MARKER_SHIMMER_CLASS = SHIMMER_CLASS

/** Classes for {@link MarkerContent} when `AgentActivityEntry.shimmer` is true (BDA-172). */
export function markerShimmerContentClassName(active = true): string | undefined {
  if (!active) return undefined
  return cn(SHIMMER_CLASS, "text-muted-foreground")
}

const markerVariants = cva(
  "group/marker relative flex min-h-4 w-full items-center gap-2 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3 [a]:hover:text-foreground",
  {
    variants: {
      variant: {
        default: "",
        separator:
          "before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border",
        border: "border-b border-border pb-2",
      },
    },
  }
)

function Marker({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof markerVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(markerVariants({ variant, className })),
      },
      props
    ),
    render,
    state: {
      slot: "marker",
      variant,
    },
  })
}

function MarkerIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function MarkerContent({
  className,
  shimmer,
  ...props
}: React.ComponentProps<"span"> & {
  /** Animated text sweep for streaming / compacting labels (pairs with `role="status"` on Marker). */
  shimmer?: boolean
}) {
  return (
    <span
      data-slot="marker-content"
      data-shimmer={shimmer ? "true" : undefined}
      className={cn(
        "min-w-0 wrap-break-word group-data-[variant=separator]/marker:flex-none group-data-[variant=separator]/marker:text-center *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        shimmer && markerShimmerContentClassName(true),
        className
      )}
      {...props}
    />
  )
}

/** Dev harness — marker shimmer wiring (BDA-172) */
export function runMarkerShimmerHarness(): void {
  const shimmerClasses = markerShimmerContentClassName(true)
  if (!shimmerClasses?.includes(SHIMMER_CLASS)) {
    throw new Error('runMarkerShimmerHarness: expected shimmer utility class on marker content')
  }
}

export { Marker, MarkerIcon, MarkerContent, markerVariants }
