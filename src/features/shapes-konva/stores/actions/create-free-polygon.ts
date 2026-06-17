import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { FREE_POLYGON_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

interface CreateFreePolygonInput {
  /** Absolute canvas-pixel vertices, flat [x0, y0, x1, y1, …]. */
  vertices: number[]
  fps: number
}

/**
 * Create a free-form polygon shape item from a click-to-draw gesture.
 * Vertices are stored in absolute canvas-pixel coordinates (Konva
 * Stage space). The clip's `from` is read live from the playback store
 * at commit time so it always anchors to the playhead position the user
 * sees when they finish the draw — even if playback was running while
 * they were placing vertices.
 *
 * Returns the new item's id, or null if vertices are invalid or no
 * compatible track exists.
 */
export function createFreePolygon(input: CreateFreePolygonInput): string | null {
  const { vertices, fps } = input
  if (vertices.length < 6 || vertices.length % 2 !== 0) {
    return null
  }
  // Read playhead at the exact commit moment (not the value captured in the
  // React hook's useCallback closure, which can lag during live playback).
  const frame = usePlaybackStore.getState().currentFrame
  const durationInFrames = fps * 5
  // Find a shape track with free space at the playhead, or create a new one
  // on top if every existing shape track has a conflict. The clip stays
  // anchored at `frame` — only the track changes.
  const trackId = ensureShapeTrackForRange(frame, durationInFrames)
  const state = useTimelineStore.getState()

  const id = crypto.randomUUID()
  const item: ShapeItem = {
    id,
    type: 'shape',
    trackId,
    from: frame,
    durationInFrames,
    label: 'Polygon',
    shapeType: 'free-polygon',
    fillColor: FREE_POLYGON_DEFAULTS.fill,
    strokeColor: FREE_POLYGON_DEFAULTS.stroke,
    strokeWidth: FREE_POLYGON_DEFAULTS.strokeWidth,
    freePolygonData: {
      vertices: [...vertices],
      closed: FREE_POLYGON_DEFAULTS.closed,
    },
  }
  state.addItem(item)
  return id
}
