import type { ShapeItem } from '@/types/timeline'

/**
 * Resolved on-screen position for a parametric shape item, in Konva Stage
 * coordinates. FreeCut stores `transform.x/y` as offset from the canvas
 * center; this helper converts to the absolute canvas-pixel center the
 * shape's Group should be placed at.
 *
 * Convention used by parametric shape components:
 *   <Group x={cx} y={cy} rotation={rotation} offsetX={width/2} offsetY={height/2}>
 *     <Rect width={width} height={height} ... />
 *   </Group>
 *
 * With `offsetX/Y = w/2, h/2`, Konva's rotation pivots around the
 * geometric center (matching FreeCut's default anchor).
 */
export interface ParametricPosition {
  cx: number
  cy: number
  width: number
  height: number
  rotation: number
  opacity: number
}

export function resolveParametricPosition(
  item: ShapeItem,
  canvasWidth: number,
  canvasHeight: number,
): ParametricPosition {
  const t = item.transform
  const width = t?.width ?? Math.min(canvasWidth, canvasHeight) * 0.25
  const height = t?.height ?? Math.min(canvasWidth, canvasHeight) * 0.25
  const cx = canvasWidth / 2 + (t?.x ?? 0)
  const cy = canvasHeight / 2 + (t?.y ?? 0)
  const rotation = t?.rotation ?? 0
  const opacity = t?.opacity ?? 1
  return { cx, cy, width, height, rotation, opacity }
}

/**
 * Convert a Konva-Group absolute position back to a FreeCut
 * center-offset `transform.x/y`. Used by dragEnd handlers.
 */
export function konvaPositionToTransform(
  cx: number,
  cy: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return { x: cx - canvasWidth / 2, y: cy - canvasHeight / 2 }
}
