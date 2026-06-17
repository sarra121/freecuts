import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { ARROW_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

interface CreateArrowInput {
  fromX: number
  fromY: number
  toX: number
  toY: number
  fps: number
}

/**
 * Create an arrow shape item from a drawing gesture. Endpoints are in
 * absolute canvas-pixel coordinates (Konva Stage space, which equals
 * canvas pixels because the Stage is sized to the canvas).
 *
 * Returns the new item's id. Returns null if no compatible track exists.
 */
export function createArrow(input: CreateArrowInput): string | null {
  const { fromX, fromY, toX, toY, fps } = input
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
    label: 'Arrow',
    shapeType: 'arrow',
    fillColor: ARROW_DEFAULTS.fill,
    strokeColor: ARROW_DEFAULTS.stroke,
    strokeWidth: ARROW_DEFAULTS.strokeWidth,
    arrowData: {
      fromX,
      fromY,
      toX,
      toY,
      pointerLength: ARROW_DEFAULTS.pointerLength,
      pointerWidth: ARROW_DEFAULTS.pointerWidth,
      dash: ARROW_DEFAULTS.dash,
    },
  }
  state.addItem(item)
  return id
}
