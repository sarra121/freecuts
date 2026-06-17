import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { TEXT_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

interface CreateTextInput {
  fps: number
  /** Drop position in canvas-pixel coords. When omitted, spawns at centre. */
  position?: { x: number; y: number }
  canvasWidth?: number
  canvasHeight?: number
}

/**
 * Create an editable text label at the current playhead. Parametric-style:
 * wrap width = transform.width; content/font live in textShapeData; colour in
 * fillColor. Returns the new item id.
 */
export function createText(input: CreateTextInput): string {
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
    label: 'Text',
    shapeType: 'text',
    fillColor: TEXT_DEFAULTS.fill,
    transform: {
      x: positionOffset.x,
      y: positionOffset.y,
      width: TEXT_DEFAULTS.width,
      height: Math.round(TEXT_DEFAULTS.fontSize * 1.5),
    },
    textShapeData: {
      content: TEXT_DEFAULTS.content,
      fontSize: TEXT_DEFAULTS.fontSize,
      fontFamily: TEXT_DEFAULTS.fontFamily,
      align: TEXT_DEFAULTS.align,
      skewX: TEXT_DEFAULTS.skewX,
      skewY: TEXT_DEFAULTS.skewY,
    },
  }
  state.addItem(item)
  return id
}
