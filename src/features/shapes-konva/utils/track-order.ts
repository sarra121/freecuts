import type { ShapeItem } from '@/types/timeline'

/**
 * Sort shape items so they paint in the right order on the Konva layer.
 *
 * Konva paints children top-down inside a single Layer (a single canvas).
 * CSS z-index can't reach inside a canvas, so the only knob for shape Z
 * is the order of the children array. The lowest track `order` value
 * (visually HIGHEST on the timeline stack) must render LAST in the
 * children array so Konva draws it on top of the composite. Larger
 * `order` values render first and end up below.
 *
 * This mirrors the Z-order convention used everywhere else in the app —
 * what the user sees in the timeline panel is what they see on the canvas.
 */
export function sortShapesByTrackOrder(
  items: ShapeItem[],
  trackOrderFor: (trackId: string) => number,
): ShapeItem[] {
  return [...items].sort((a, b) => {
    const oa = trackOrderFor(a.trackId)
    const ob = trackOrderFor(b.trackId)
    // Larger order first (rendered earlier, ends up below).
    return ob - oa
  })
}
