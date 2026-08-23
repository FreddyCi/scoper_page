/** 2D point in viewport coordinates (px). */
export type WalkthroughPoint = { x: number; y: number }

export const SCOUT_WALKTHROUGH_ARROW_VARIANT_COUNT = 8

const MIN_ARROW_DISTANCE_PX = 48

type PathBuilder = (from: WalkthroughPoint, to: WalkthroughPoint, dx: number, dy: number, bend: number) => string

/** Whimsical dashed-arrow curves — inspired by hand-drawn walkthrough overlays. */
const ARROW_VARIANT_BUILDERS: PathBuilder[] = [
  (from, to, dx, _dy, bend) => {
    const c1x = from.x + dx * 0.2
    const c1y = from.y - bend
    const c2x = from.x + dx * 0.75
    const c2y = to.y + bend * 0.35
    return `M ${from.x} ${from.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${to.x} ${to.y}`
  },
  (from, to, dx, _dy, bend) => {
    const loopX = from.x + dx * 0.45
    const loopY = from.y - bend * 0.75
    const c2x = from.x + dx * 0.82
    const c2y = to.y + bend * 0.55
    return `M ${from.x} ${from.y} C ${from.x + dx * 0.12} ${from.y - bend * 0.35} ${loopX} ${loopY} ${from.x + dx * 0.58} ${from.y + bend * 0.15} S ${c2x} ${c2y} ${to.x} ${to.y}`
  },
  (from, to, dx, dy, bend) => {
    const mx = from.x + dx * 0.5
    const my = from.y + dy * 0.5 - bend * 0.65
    return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`
  },
  (from, to, dx, _dy, bend) => {
    const c1x = from.x + dx * 0.28
    const c1y = from.y + bend * 0.55
    const c2x = from.x + dx * 0.62
    const c2y = to.y - bend * 0.7
    return `M ${from.x} ${from.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${to.x} ${to.y}`
  },
  (from, to, dx, dy, bend) => {
    const midX = from.x + dx * 0.35
    const midY = from.y + dy * 0.65 + bend * 0.4
    const c2x = from.x + dx * 0.88
    const c2y = to.y - bend * 0.25
    return `M ${from.x} ${from.y} C ${midX} ${from.y - bend} ${midX} ${midY} ${from.x + dx * 0.55} ${from.y + dy * 0.55} S ${c2x} ${c2y} ${to.x} ${to.y}`
  },
  (from, to, dx, _dy, bend) => {
    const peakX = from.x + dx * 0.42
    const peakY = from.y - bend
    const c2x = from.x + dx * 0.7
    const c2y = to.y + bend * 0.8
    return `M ${from.x} ${from.y} C ${from.x + dx * 0.08} ${from.y - bend * 0.2} ${peakX} ${peakY} ${c2x} ${c2y} ${to.x} ${to.y}`
  },
  (from, to, dx, dy, bend) => {
    const c1x = from.x + dx * 0.18
    const c1y = from.y + bend * 0.35
    const c2x = from.x + dx * 0.52
    const c2y = from.y + dy * 0.35 - bend * 0.5
    const c3x = from.x + dx * 0.78
    const c3y = to.y + bend * 0.45
    return `M ${from.x} ${from.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${from.x + dx * 0.65} ${from.y + dy * 0.55} S ${c3x} ${c3y} ${to.x} ${to.y}`
  },
  (from, to, dx, _dy, bend) => {
    const c1x = from.x + dx * 0.25
    const c1y = from.y - bend * 0.55
    const loopY = from.y + bend * 0.35
    const c3x = from.x + dx * 0.9
    const c3y = to.y - bend * 0.15
    return `M ${from.x} ${from.y} C ${c1x} ${c1y} ${from.x + dx * 0.4} ${loopY} ${from.x + dx * 0.55} ${from.y} S ${c3x} ${c3y} ${to.x} ${to.y}`
  },
]

/** Spotlight rect → arrow tip (left edge, vertical center). */
export function spotlightArrowTarget(rect: {
  left: number
  top: number
  width: number
  height: number
}): WalkthroughPoint {
  return {
    x: rect.left + Math.min(12, rect.width * 0.12),
    y: rect.top + rect.height / 2,
  }
}

/** Scout panel primary CTA → arrow tail (left edge, vertical center). */
export function scoutPanelArrowOrigin(element: HTMLElement): WalkthroughPoint {
  const box = element.getBoundingClientRect()
  return {
    x: box.left,
    y: box.top + box.height / 2,
  }
}

/**
 * Build a curved SVG path between Scout panel CTA and spotlight target.
 * Returns empty string when points are too close.
 */
export function buildWalkthroughArrowPath(
  from: WalkthroughPoint,
  to: WalkthroughPoint,
  variant = 0,
): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy)
  if (distance < MIN_ARROW_DISTANCE_PX) return ''

  const bend = Math.min(140, Math.max(36, distance * 0.32))
  const builder = ARROW_VARIANT_BUILDERS[variant % ARROW_VARIANT_BUILDERS.length]
  return builder(from, to, dx, dy, bend)
}

/** Dev harness — walkthrough arrow path builders (Scout overlay). */
export function runWalkthroughArrowPathsHarness(): void {
  const path = buildWalkthroughArrowPath({ x: 120, y: 240 }, { x: 520, y: 180 }, 0)
  if (!path.startsWith('M')) {
    throw new Error('runWalkthroughArrowPathsHarness: expected SVG path')
  }

  const short = buildWalkthroughArrowPath({ x: 0, y: 0 }, { x: 12, y: 4 }, 0)
  if (short !== '') {
    throw new Error('runWalkthroughArrowPathsHarness: short distance should skip arrow')
  }

  for (let variant = 0; variant < SCOUT_WALKTHROUGH_ARROW_VARIANT_COUNT; variant += 1) {
    const variantPath = buildWalkthroughArrowPath({ x: 80, y: 100 }, { x: 400, y: 320 }, variant)
    if (!variantPath.includes('C') && !variantPath.includes('Q')) {
      throw new Error(`runWalkthroughArrowPathsHarness: variant ${variant} missing curve`)
    }
  }
}
