import type { ShapeItem, ShapeType } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

/**
 * The five parametric shape types this action knows how to create.
 * Arrow and free-polygon have their own dedicated actions because they
 * require a pointer gesture to derive vertex positions.
 */
export type ParametricShapeType = Extract<
  ShapeType,
  'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'polygon'
>

interface CreateParametricShapeInput {
  shapeType: ParametricShapeType
  fps: number
  /** Optional drop position in canvas-pixel coordinates (the Konva Stage's
   *  internal coord space, which equals the project's pixel space). When
   *  provided, the shape's centre is placed at this point. Otherwise the
   *  shape spawns at the canvas centre (`transform.x/y = 0`). */
  position?: { x: number; y: number }
  /** Canvas width and height (in project pixels). Required when `position`
   *  is set so we can convert the click coords to FreeCut's centre-relative
   *  `transform.x/y`. Ignored otherwise. */
  canvasWidth?: number
  canvasHeight?: number
}

const LABEL_BY_TYPE: Record<ParametricShapeType, string> = {
  rectangle: 'Rectangle',
  circle: 'Circle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  polygon: 'Polygon',
}

/**
 * Create a parametric shape (rectangle / circle / ellipse / triangle /
 * regular-polygon) at the current playhead frame.
 *
 * Sizing: the shape spawns at the default 25%-of-min-dimension size
 * (resolved by `resolveParametricPosition` when transform.width/height
 * are omitted). The user can resize it afterwards via the transformer.
 *
 * Positioning: if `position` is given (with `canvasWidth`/`canvasHeight`),
 * the shape's centre lands at that click point. Otherwise it spawns at
 * canvas centre.
 *
 * Returns the new item id.
 */
export function createParametricShape(input: CreateParametricShapeInput): string {
  const { shapeType, fps, position, canvasWidth, canvasHeight } = input
  // Read the playhead at commit time, not whatever was closed over earlier.
  const frame = usePlaybackStore.getState().currentFrame
  const durationInFrames = fps * 5
  const trackId = ensureShapeTrackForRange(frame, durationInFrames)
  const state = useTimelineStore.getState()

  // Build the explicit transform. We always set width/height because two
  // separate resolvers consume `item.transform`:
  //  - The Konva preview uses `resolveParametricPosition` which defaults
  //    missing width/height to 25% of the smaller canvas dimension.
  //  - The export uses `resolveTransform` (transform-resolver.ts) which
  //    defaults missing width/height to the FULL canvas, because shapes
  //    have no source dimensions.
  // Their defaults diverge. We pick the preview's default (25% of min canvas)
  // and pin it explicitly so both renderers agree.
  const defaultSize =
    canvasWidth != null && canvasHeight != null
      ? Math.min(canvasWidth, canvasHeight) * 0.25
      : 200

  // If a click position was provided, convert from absolute canvas pixels
  // to FreeCut's centre-relative transform offset. resolveParametricPosition
  // and resolveTransform both add canvas/2 + transform.x at render time, so
  // we invert that here.
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
    label: LABEL_BY_TYPE[shapeType],
    shapeType,
    fillColor: PARAMETRIC_SHAPE_DEFAULTS.fill,
    strokeColor: PARAMETRIC_SHAPE_DEFAULTS.stroke,
    strokeWidth: PARAMETRIC_SHAPE_DEFAULTS.strokeWidth,
    transform: {
      x: positionOffset.x,
      y: positionOffset.y,
      width: defaultSize,
      height: defaultSize,
    },
    // Regular polygon defaults to 6 sides (hexagon) so it doesn't look
    // identical to triangle.
    ...(shapeType === 'polygon' ? { points: 6 } : {}),
  }
  state.addItem(item)
  return id
}
