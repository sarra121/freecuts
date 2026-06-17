import type { TimelineItem } from '@/types/timeline'

interface ClipShapeKeyframesProps {
  item: TimelineItem
}

// Visual tuning constants. Kept in one block so the bar style is easy
// to tweak without hunting through the JSX.
const BAR_WIDTH_PX = 2
const BAR_HEIGHT_PCT = 28 // % of clip height — sits along the bottom band
const BAR_COLOR = '#1845C8' // Tactical "Defense" blue — matches handles
const BAR_OPACITY = 0.85

/**
 * Thin vertical tick marks along the bottom of a shape clip's block,
 * one per recorded change in `useShapeKeyframesStore`.
 *
 * Renders nothing when:
 *  - item is not a shape (we only track shape changes here)
 *  - the item has no recorded changes
 *
 * Positioning: a change at clip-relative frame F is placed at
 * `F / item.durationInFrames * 100%` from the clip's left edge. We
 * ignore trim windows for now — the bars always sit at their absolute
 * clip-time position, even if that position is currently outside the
 * visible (post-trim) range. Tightening to visible-range only is a
 * follow-up if it becomes useful.
 */
export function ClipShapeKeyframes({ item }: ClipShapeKeyframesProps) {
  if (item.type !== 'shape') return null
  // Change-marks come from the clip's own keyframes (persisted on the item).
  const changes = item.keyframes
  if (!changes || changes.length === 0) return null
  if (item.durationInFrames <= 0) return null

  return (
    <div
      className="absolute inset-x-0 pointer-events-none"
      style={{
        bottom: 0,
        height: `${BAR_HEIGHT_PCT}%`,
        // The container is just a positioning context — the bars do the
        // actual painting. zIndex above ClipContent's waveforms/etc.
        zIndex: 5,
      }}
    >
      {changes.map((change) => {
        const leftPct = (change.frame / item.durationInFrames) * 100
        // Clamp so bars at the exact start/end don't bleed past the
        // rounded clip edges (the parent has overflow:hidden so this
        // is belt-and-suspenders).
        const clamped = Math.max(0, Math.min(100, leftPct))
        return (
          <div
            key={change.frame}
            style={{
              position: 'absolute',
              left: `${clamped}%`,
              top: 0,
              bottom: 0,
              width: `${BAR_WIDTH_PX}px`,
              marginLeft: `-${BAR_WIDTH_PX / 2}px`, // center on the frame
              backgroundColor: BAR_COLOR,
              opacity: BAR_OPACITY,
              borderRadius: '1px',
            }}
          />
        )
      })}
    </div>
  )
}
