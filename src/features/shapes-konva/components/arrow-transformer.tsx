import type { ShapeItem } from '@/types/timeline'
import { EndpointHandle } from './endpoint-handle'
import type { ShapeCallbacks } from '../types'
import { useShapeEditStore } from '../stores/shape-edit-store'
import { controlFromMidpoint, curveMidpoint, lineMidpoint } from '../utils/arrow-curve'

interface ArrowTransformerProps {
  item: ShapeItem
  callbacks: ShapeCallbacks
}

/**
 * Transformer variant for arrows. Renders draggable handles at the two
 * endpoints (`fromX/Y` → vertex index 0, `toX/Y` → vertex index 1).
 *
 * Drag protocol — same as PolygonTransformer:
 *  - `onDragLive` writes to the shape-edit preview store so `ArrowShape`
 *    can rubber-band the body during drag without touching the timeline
 *    store.
 *  - `onDrag` clears the preview and commits via `callbacks.onUpdateVertex`,
 *    producing a single undo entry covering the whole drag.
 *
 * No bounding box / no rotate handle — those don't fit an arrow's
 * head-and-tail semantics. The user manipulates the arrow by its ends.
 */
export function ArrowTransformer({ item, callbacks }: ArrowTransformerProps) {
  const setVertexDrag = useShapeEditStore((s) => s.setVertexDrag)
  const clearVertexDrag = useShapeEditStore((s) => s.clearVertexDrag)
  // Body-drag offset (if the whole arrow is being translated). We add this
  // to each endpoint so the handles track the arrow line during body drag.
  const bodyDrag = useShapeEditStore((s) => s.bodyDrag)
  const bodyDx = bodyDrag && bodyDrag.itemId === item.id ? bodyDrag.dx : 0
  const bodyDy = bodyDrag && bodyDrag.itemId === item.id ? bodyDrag.dy : 0
  // Endpoint/vertex drag override — applied to `from` and `to` below so
  // the curve handle's computed midpoint tracks the cursor in real time
  // while the user drags an endpoint (not just on dragEnd).
  const vertexDrag = useShapeEditStore((s) => s.vertexDrag)

  const a = item.arrowData
  if (!a) return null

  // Live from/to: stored data overridden by an in-flight endpoint drag.
  // Index 0 = from-endpoint, Index 1 = to-endpoint. The curve handle (2)
  // doesn't change the endpoints, so we don't override here for index 2.
  const liveFrom =
    vertexDrag && vertexDrag.itemId === item.id && vertexDrag.index === 0
      ? { x: vertexDrag.x, y: vertexDrag.y }
      : { x: a.fromX, y: a.fromY }
  const liveTo =
    vertexDrag && vertexDrag.itemId === item.id && vertexDrag.index === 1
      ? { x: vertexDrag.x, y: vertexDrag.y }
      : { x: a.toX, y: a.toY }

  // Where to draw the curve handle:
  //   - If the arrow has an explicit control point, place the handle at
  //     the visible apex of the curve (i.e. on the curve at t=0.5).
  //   - Otherwise, place it at the straight-line midpoint so the user
  //     can grab it and bend the arrow from a flat state.
  // The bodyDrag offset is applied so the handle tracks during whole-shape
  // drag, same as the endpoints.
  const hasControl = a.controlX != null && a.controlY != null
  const curveHandle = hasControl
    ? curveMidpoint(liveFrom, liveTo, { x: a.controlX!, y: a.controlY! })
    : lineMidpoint(liveFrom, liveTo)

  return (
    <>
      <EndpointHandle
        x={a.fromX + bodyDx}
        y={a.fromY + bodyDy}
        onDragLive={(x, y) => setVertexDrag({ itemId: item.id, index: 0, x, y })}
        onDrag={(x, y) => {
          clearVertexDrag()
          callbacks.onUpdateVertex(item.id, 0, x, y)
        }}
      />
      <EndpointHandle
        x={a.toX + bodyDx}
        y={a.toY + bodyDy}
        onDragLive={(x, y) => setVertexDrag({ itemId: item.id, index: 1, x, y })}
        onDrag={(x, y) => {
          clearVertexDrag()
          callbacks.onUpdateVertex(item.id, 1, x, y)
        }}
      />
      {/* Curve handle (index 2). Drag this to bend the arrow into a
          concave/convex curve. The handle position is the desired apex of
          the curve at t=0.5; we run it through controlFromMidpoint() to
          get the actual quadratic Bezier control point P1 to commit. */}
      <EndpointHandle
        x={curveHandle.x + bodyDx}
        y={curveHandle.y + bodyDy}
        onDragLive={(x, y) => setVertexDrag({ itemId: item.id, index: 2, x, y })}
        onDrag={(x, y) => {
          clearVertexDrag()
          // Commit the new control point. We compute it from the dragged
          // midpoint position using the *stored* endpoints (a.fromX/Y,
          // a.toX/Y) — when this fires the user is releasing the curve
          // handle, not the endpoints, so the stored values are current.
          const control = controlFromMidpoint(
            { x: a.fromX, y: a.fromY },
            { x: a.toX, y: a.toY },
            { x, y },
          )
          callbacks.onUpdateVertex(item.id, 2, control.x, control.y)
        }}
      />
    </>
  )
}
