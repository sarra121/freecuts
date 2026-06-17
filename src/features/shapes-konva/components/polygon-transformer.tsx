import type { ShapeItem } from '@/types/timeline'
import { EndpointHandle } from './endpoint-handle'
import type { ShapeCallbacks } from '../types'
import { useShapeEditStore } from '../stores/shape-edit-store'

interface PolygonTransformerProps {
  item: ShapeItem
  callbacks: ShapeCallbacks
}

/**
 * Transformer variant for free-form polygons. Renders one draggable handle
 * per stored vertex. Each handle uses the preview-store pattern:
 *
 *  - On every dragmove → `useShapeEditStore.setVertexDrag` updates a cheap
 *    local store. `FreePolygonShape` subscribes to it and re-renders the
 *    `<Line>` with the live override, so the polygon rubber-bands with the
 *    cursor.
 *  - On dragEnd → clear the preview, then commit the final position via
 *    `callbacks.onUpdateVertex` (which goes through `updateVertex` →
 *    `execute()` → one undo entry).
 *
 * No bounding-box Transformer here — free polygons don't have a meaningful
 * bounding box for resize/rotate (those would distort vertex ratios). Per-
 * vertex editing is the right control surface for this shape type.
 */
export function PolygonTransformer({ item, callbacks }: PolygonTransformerProps) {
  const setVertexDrag = useShapeEditStore((s) => s.setVertexDrag)
  const clearVertexDrag = useShapeEditStore((s) => s.clearVertexDrag)
  // Body-drag offset (if the whole polygon is being translated by the cursor)
  // — added to each handle position so handles track the body in real time.
  const bodyDrag = useShapeEditStore((s) => s.bodyDrag)
  const bodyDx = bodyDrag && bodyDrag.itemId === item.id ? bodyDrag.dx : 0
  const bodyDy = bodyDrag && bodyDrag.itemId === item.id ? bodyDrag.dy : 0

  const data = item.freePolygonData
  if (!data) return null

  const vertexCount = data.vertices.length / 2

  return (
    <>
      {Array.from({ length: vertexCount }, (_, i) => {
        const x = (data.vertices[i * 2] ?? 0) + bodyDx
        const y = (data.vertices[i * 2 + 1] ?? 0) + bodyDy
        return (
          <EndpointHandle
            key={i}
            x={x}
            y={y}
            onDragLive={(nx, ny) =>
              setVertexDrag({ itemId: item.id, index: i, x: nx, y: ny })
            }
            onDrag={(nx, ny) => {
              clearVertexDrag()
              callbacks.onUpdateVertex(item.id, i, nx, ny)
            }}
          />
        )
      })}
    </>
  )
}
