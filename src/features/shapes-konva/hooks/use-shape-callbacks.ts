import { useMemo } from 'react'
import { useSelectionStore } from '../deps/selection'
import { useTimelineStore } from '../deps/timeline'
import { commitShapeUpdate } from '../stores/actions/commit-shape-update'
import { moveArrowEndpoint } from '../utils/arrow-curve'
import type { ShapeCallbacks } from '../types'
import type { ShapeItem } from '@/types/timeline'

/**
 * Build the `ShapeCallbacks` bag every Konva shape component receives. Every
 * edit funnels through `commitShapeUpdate`, which updates the base item AND
 * records the change as a keyframe on the clip in one undo entry.
 *
 * `onSelect` reads modifier keys: plain click replaces the selection;
 * Ctrl/Cmd-click toggles this shape in/out (Figma-style multi-select).
 */
export function useShapeCallbacks(): ShapeCallbacks {
  const selectItems = useSelectionStore((s) => s.selectItems)

  return useMemo<ShapeCallbacks>(
    () => ({
      onSelect: (id, event) => {
        const evt = event?.evt as MouseEvent | TouchEvent | undefined
        const isMulti =
          !!evt && 'ctrlKey' in evt && (evt.ctrlKey || ('metaKey' in evt && evt.metaKey))
        if (isMulti) {
          const current = useSelectionStore.getState().selectedItemIds
          selectItems(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
        } else {
          selectItems([id])
        }
      },
      onMove: () => {
        // Move semantics are shape-specific and handled by each shape's drag
        // (parametric body, arrow/polygon vertices) → onUpdateData/onUpdateVertex.
      },
      onUpdateData: (id, patch) => commitShapeUpdate(id, patch),
      onUpdateVertex: (id, idx, x, y) => {
        const item = useTimelineStore.getState().items.find((it) => it.id === id) as
          | ShapeItem
          | undefined
        if (!item || item.type !== 'shape') return

        if (item.shapeType === 'arrow' && item.arrowData) {
          // Endpoint move re-anchors the curve; control handle (idx 2) sets P1.
          const next =
            idx === 0 || idx === 1
              ? moveArrowEndpoint(item.arrowData, idx, x, y)
              : { ...item.arrowData, controlX: x, controlY: y }
          commitShapeUpdate(id, { arrowData: next })
          return
        }

        if (
          (item.shapeType === 'free-polygon' || item.shapeType === 'connected-rings') &&
          item.freePolygonData
        ) {
          const v = [...item.freePolygonData.vertices]
          v[idx * 2] = x
          v[idx * 2 + 1] = y
          commitShapeUpdate(id, { freePolygonData: { ...item.freePolygonData, vertices: v } })
        }
      },
    }),
    [selectItems],
  )
}
