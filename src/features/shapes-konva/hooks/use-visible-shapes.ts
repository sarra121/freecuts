import { useCallback, useMemo } from 'react'
import type { ShapeItem } from '@/types/timeline'
import type { TimelineItem, TimelineTrack } from '@/types/timeline'
import { sortShapesByTrackOrder } from '../utils/track-order'

/**
 * Filter the timeline's items to shape items currently visible at the
 * playhead frame, sorted by their track's `order` so they layer correctly
 * on the Konva Stage (lower order = drawn later = renders on top).
 *
 * Memoizes on the inputs so the Stage doesn't re-create the array on
 * unrelated re-renders.
 */
export function useVisibleShapes(
  items: TimelineItem[],
  tracks: TimelineTrack[],
  currentFrame: number,
): ShapeItem[] {
  const trackOrderFor = useCallback(
    (trackId: string) => tracks.find((t) => t.id === trackId)?.order ?? 0,
    [tracks],
  )

  return useMemo<ShapeItem[]>(() => {
    const shapeItems = items.filter(
      (it): it is ShapeItem =>
        it.type === 'shape' &&
        currentFrame >= it.from &&
        currentFrame < it.from + it.durationInFrames,
    )
    return sortShapesByTrackOrder(shapeItems, trackOrderFor)
  }, [items, currentFrame, trackOrderFor])
}
