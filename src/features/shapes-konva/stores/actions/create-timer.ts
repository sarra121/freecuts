import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { TIMER_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

interface CreateTimerInput {
  fps: number
  /** Drop position in canvas-pixel coords. When omitted, spawns at centre. */
  position?: { x: number; y: number }
  canvasWidth?: number
  canvasHeight?: number
}

/**
 * Create a timeline-synced timer at the current playhead. The displayed time is
 * derived from the playhead each frame (see timer-shape). Returns the new id.
 */
export function createTimer(input: CreateTimerInput): string {
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
    label: 'Timer',
    shapeType: 'timer',
    fillColor: TIMER_DEFAULTS.fill,
    transform: {
      x: positionOffset.x,
      y: positionOffset.y,
      width: TIMER_DEFAULTS.width,
      height: Math.round(TIMER_DEFAULTS.fontSize * 1.4),
    },
    timerData: {
      mode: TIMER_DEFAULTS.mode,
      offsetSec: TIMER_DEFAULTS.offsetSec,
      durationSec: TIMER_DEFAULTS.durationSec,
      format: TIMER_DEFAULTS.format,
      fontSize: TIMER_DEFAULTS.fontSize,
      fontFamily: TIMER_DEFAULTS.fontFamily,
    },
  }
  state.addItem(item)
  return id
}
