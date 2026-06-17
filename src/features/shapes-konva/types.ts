import type { ShapeItem } from '@/types/timeline'
import type { KonvaEventObject } from 'konva/lib/Node'

/**
 * Callbacks every shape component receives. Each callback dispatches a
 * timeline-store action through the deps adapter so undo/redo + project
 * persistence work the same as for any other timeline mutation.
 *
 * `onSelect`'s optional `event` arg carries the Konva click event so the
 * callback can read modifier keys (Ctrl/Cmd) for multi-select toggling.
 * Callers without an event (programmatic selection, tests) just call
 * `onSelect(id)`.
 */
export interface ShapeCallbacks {
  onSelect(id: string, event?: KonvaEventObject<MouseEvent | TouchEvent>): void
  onMove(id: string, x: number, y: number): void
  onUpdateData(id: string, patch: Partial<ShapeItem>): void
  onUpdateVertex(id: string, index: number, x: number, y: number): void
}

/**
 * Common props each shape component receives. `frame` is the current
 * timeline frame — unused by static shapes (v0 polygon, arrow, the five
 * ported parametric variants) but in the contract so future shapes
 * (magnifier, flowing arrow, gaze cone) can derive per-frame state.
 */
export interface ShapeProps {
  item: ShapeItem
  frame: number
  isSelected: boolean
  callbacks: ShapeCallbacks
  /** Project canvas width in pixels (= Konva Stage width). Used by
   *  parametric shapes to convert FreeCut's center-relative
   *  `transform.x/y` into absolute Stage coordinates. */
  canvasWidth: number
  canvasHeight: number
}

/**
 * Subset of ShapeType this tool supports for click-to-place creation.
 * Arrow and free-polygon use their own gesture-based drawing tools.
 */
export type ParametricShapeKind = 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'polygon'

/**
 * The single state value owned by the draw-tool store. `idle` = no tool
 * active. `drawing-*` states are click-and-drag tools that hold in-flight
 * gesture data. `placing-parametric` is the click-to-place tool used by
 * the 5 parametric shapes — it stays active after each placement so the
 * user can place multiple shapes in a row until they cancel or pick
 * another tool.
 */
export type DrawState =
  | { kind: 'idle' }
  | { kind: 'drawing-arrow'; tail: { x: number; y: number } | null }
  | { kind: 'drawing-polygon'; vertices: number[] } // flat [x0,y0,x1,y1,…]
  | { kind: 'placing-parametric'; shapeType: ParametricShapeKind }
  | { kind: 'placing-field-ring' }
  | { kind: 'placing-spotlight' }
  | { kind: 'placing-text' }
  | { kind: 'placing-timer' }
  | { kind: 'drawing-connected-rings'; vertices: number[] } // flat [x0,y0,x1,y1,…]
