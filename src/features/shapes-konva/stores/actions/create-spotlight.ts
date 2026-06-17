import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { SPOTLIGHT_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

interface CreateSpotlightInput {
  fps: number
  /** Drop position in canvas-pixel coords. When omitted, spawns at centre. */
  position?: { x: number; y: number }
  canvasWidth?: number
  canvasHeight?: number
}

/**
 * Create a player spotlight at the current playhead. Parametric-style: the
 * beam footprint comes from transform.width/height; the light colour from
 * fillColor; the rest from spotlightData. Returns the new item id.
 */
export function createSpotlight(input: CreateSpotlightInput): string {
  const { fps, position, canvasWidth, canvasHeight } = input
  const frame = usePlaybackStore.getState().currentFrame
  const durationInFrames = fps * 5
  const trackId = ensureShapeTrackForRange(frame, durationInFrames)
  const state = useTimelineStore.getState()

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
    label: 'Spotlight',
    shapeType: 'spotlight',
    fillColor: SPOTLIGHT_DEFAULTS.fill,
    transform: {
      x: positionOffset.x,
      y: positionOffset.y,
      width: SPOTLIGHT_DEFAULTS.width,
      height: SPOTLIGHT_DEFAULTS.height,
    },
    spotlightData: {
      intensity: SPOTLIGHT_DEFAULTS.intensity,
      pool: SPOTLIGHT_DEFAULTS.pool,
      bloom: SPOTLIGHT_DEFAULTS.bloom,
      cutout: SPOTLIGHT_DEFAULTS.cutout,
      cutoutWidth: SPOTLIGHT_DEFAULTS.cutoutWidth,
      cutoutHeight: SPOTLIGHT_DEFAULTS.cutoutHeight,
    },
  }
  state.addItem(item)
  return id
}
