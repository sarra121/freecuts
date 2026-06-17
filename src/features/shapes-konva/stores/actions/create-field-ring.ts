import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { FIELD_RING_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

interface CreateFieldRingInput {
  fps: number
  /** Drop position in canvas-pixel coords. When omitted, spawns at centre. */
  position?: { x: number; y: number }
  canvasWidth?: number
  canvasHeight?: number
}

/**
 * Create a field-ring shape at the current playhead. Mirrors
 * createParametricShape: 5s duration, centred (or placed at `position`),
 * default FieldRingData. Returns the new item id.
 */
export function createFieldRing(input: CreateFieldRingInput): string {
  const { fps, position, canvasWidth, canvasHeight } = input
  // Read the playhead at commit time, not whatever was closed over earlier.
  const frame = usePlaybackStore.getState().currentFrame
  const durationInFrames = fps * 5
  const trackId = ensureShapeTrackForRange(frame, durationInFrames)
  const state = useTimelineStore.getState()

  const defaultSize =
    canvasWidth != null && canvasHeight != null
      ? Math.min(canvasWidth, canvasHeight) * 0.25
      : 200

  // Convert an absolute click point to FreeCut's centre-relative transform.
  const positionOffset =
    position && canvasWidth != null && canvasHeight != null
      ? { x: position.x - canvasWidth / 2, y: position.y - canvasHeight / 2 }
      : { x: 0, y: 0 }

  const id = crypto.randomUUID()
  const item: ShapeItem = {
    id,
    type: 'shape',
    trackId,
    from: frame,
    durationInFrames,
    label: 'Field ring',
    shapeType: 'field-ring',
    fillColor: FIELD_RING_DEFAULTS.fill,
    transform: {
      x: positionOffset.x,
      y: positionOffset.y,
      width: defaultSize,
      height: defaultSize,
    },
    fieldRingData: {
      squash: FIELD_RING_DEFAULTS.squash,
      bandThickness: FIELD_RING_DEFAULTS.bandThickness,
      segments: FIELD_RING_DEFAULTS.segments,
      continuous: FIELD_RING_DEFAULTS.continuous,
      gapRatio: FIELD_RING_DEFAULTS.gapRatio,
      roundedEnds: FIELD_RING_DEFAULTS.roundedEnds,
      extrusionHeight: FIELD_RING_DEFAULTS.extrusionHeight,
      spin: FIELD_RING_DEFAULTS.spin,
      spinSpeed: FIELD_RING_DEFAULTS.spinSpeed,
      contactShadow: FIELD_RING_DEFAULTS.contactShadow,
    },
  }
  state.addItem(item)
  return id
}
