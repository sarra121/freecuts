import type { ReactNode } from 'react'
import { Group } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { ShapeItem } from '@/types/timeline'
import { resolveParametricPosition, konvaPositionToTransform } from '../utils/parametric-position'
import type { ShapeCallbacks } from '../types'

interface ParametricShapeBodyProps {
  item: ShapeItem
  isSelected: boolean
  callbacks: ShapeCallbacks
  canvasWidth: number
  canvasHeight: number
  /** True when the inner Konva node draws from its top-left (Rect, Triangle,
   *  RegularPolygon path-based). The Group's offset is then half-width/height
   *  so the visual centre matches the item's transform.x/y. Circle / Ellipse
   *  draw from their centre already (radii) so they pass false. */
  centerOrigin: boolean
  children: ReactNode
}

/**
 * Shared <Group> wrapper for parametric shapes. Owns:
 *  - position / rotation / opacity (from resolveParametricPosition)
 *  - draggable when selected
 *  - onClick / onTap forwarding to callbacks.onSelect
 *  - onDragEnd that bakes the Konva-side translation back into item.transform
 *  - Konva-side id={item.id} so the Phase 3 Transformer can find the node
 *
 * Each parametric shape file renders only its inner Konva primitive inside.
 *
 * Note: onSelect is called with (id) only in Phase 2; Phase 3 extends the
 * signature to forward the event for modifier-aware multi-select.
 */
export function ParametricShapeBody({
  item,
  isSelected,
  callbacks,
  canvasWidth,
  canvasHeight,
  centerOrigin,
  children,
}: ParametricShapeBodyProps) {
  const { cx, cy, width, height, rotation, opacity } = resolveParametricPosition(
    item,
    canvasWidth,
    canvasHeight,
  )

  return (
    <Group
      id={item.id}
      x={cx}
      y={cy}
      offsetX={centerOrigin ? width / 2 : 0}
      offsetY={centerOrigin ? height / 2 : 0}
      rotation={rotation}
      opacity={opacity}
      draggable={isSelected}
      onClick={(e) => callbacks.onSelect(item.id, e)}
      onTap={(e) => callbacks.onSelect(item.id, e)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
        const next = konvaPositionToTransform(e.target.x(), e.target.y(), canvasWidth, canvasHeight)
        // `onUpdateData` records the change log entry internally
        // (`use-shape-callbacks.ts` snapshots the item state before
        // applying the update and writes to `useShapeKeyframesStore`).
        callbacks.onUpdateData(item.id, { transform: { ...item.transform, ...next } })
      }}
    >
      {children}
    </Group>
  )
}
