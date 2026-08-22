/** Padded spotlight cutout from a DOM rect (BDA-288). */
export type ScoutSpotlightRect = {
  top: number
  left: number
  width: number
  height: number
}

export const SCOUT_SPOTLIGHT_PAD = 6

export function padSpotlightRect(rect: DOMRect, pad = SCOUT_SPOTLIGHT_PAD): ScoutSpotlightRect {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
}

/** True when cutout has area and intersects the viewport. */
export function isSpotlightRectVisible(rect: ScoutSpotlightRect): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0
  if (viewportWidth === 0 || viewportHeight === 0) return true

  const right = rect.left + rect.width
  const bottom = rect.top + rect.height
  if (right < 0 || bottom < 0 || rect.left > viewportWidth || rect.top > viewportHeight) {
    return false
  }

  return true
}

/** Dev harness — padded rect math (BDA-288). */
export function runScoutSpotlightGeometryHarness(): void {
  const padded = padSpotlightRect(new DOMRect(10, 20, 100, 50), 6)
  if (padded.top !== 14 || padded.left !== 4 || padded.width !== 112 || padded.height !== 62) {
    throw new Error('runScoutSpotlightGeometryHarness: padSpotlightRect mismatch')
  }

  if (!isSpotlightRectVisible(padded)) {
    throw new Error('runScoutSpotlightGeometryHarness: expected visible rect')
  }

  if (isSpotlightRectVisible({ top: 0, left: 0, width: 0, height: 10 })) {
    throw new Error('runScoutSpotlightGeometryHarness: zero width should be hidden')
  }
}
