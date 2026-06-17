import { useCallback, useMemo } from 'react'
import { Group, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type Konva from 'konva'
// MatchView: EndpointHandle moved to PolygonTransformer (mounted by ShapesStage).
// Restore this import if reverting to inline handle rendering below.
// import { EndpointHandle } from '../components/endpoint-handle'
import { FREE_POLYGON_DEFAULTS } from '../utils/defaults'
import { useShapeEditStore } from '../stores/shape-edit-store'
import type { ShapeProps } from '../types'

/**
 * Free-form polygon with arbitrary vertices. Vertices are stored in absolute
 * canvas-pixel coords. Vertex drag handles live in PolygonTransformer.
 *
 * Body drag translates every vertex together; on dragEnd the delta is
 * baked back into the data so the vertex array stays in one coordinate
 * space (Konva-side Group position resets to (0,0)).
 *
 * Rubber-band rendering: while a vertex handle is being dragged in
 * PolygonTransformer, that transformer pushes the live position into
 * `useShapeEditStore.vertexDrag`. We subscribe here and, if there's an
 * active drag for THIS polygon, swap in the live coords for the right
 * vertex when computing the `<Line>`'s points. Result: the polygon body
 * follows the cursor without the timeline store being touched.
 */
export function FreePolygonShape({ item, isSelected, callbacks }: ShapeProps) {
  const data = item.freePolygonData
  const fill = item.fillColor ?? FREE_POLYGON_DEFAULTS.fill
  const stroke = item.strokeColor ?? FREE_POLYGON_DEFAULTS.stroke
  const strokeWidth = item.strokeWidth ?? FREE_POLYGON_DEFAULTS.strokeWidth

  // Read the active vertex-drag preview (if any) so the Line rubber-bands.
  const vertexDrag = useShapeEditStore((s) => s.vertexDrag)
  const setBodyDrag = useShapeEditStore((s) => s.setBodyDrag)
  const clearBodyDrag = useShapeEditStore((s) => s.clearBodyDrag)

  // Push the live Group translation into the preview store on every
  // dragmove so PolygonTransformer can offset its vertex handles to
  // track the body. Without this, handles freeze at the pre-drag
  // positions until dragEnd bakes the delta in.
  const handleBodyDragMove = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      setBodyDrag({ itemId: item.id, dx: e.target.x(), dy: e.target.y() })
    },
    [item.id, setBodyDrag],
  )

  const handleBodyDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      clearBodyDrag()
      if (!data) return
      const dx = e.target.x()
      const dy = e.target.y()
      if (dx === 0 && dy === 0) return
      const next = data.vertices.map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
      callbacks.onUpdateData(item.id, {
        freePolygonData: { ...data, vertices: next },
      })
      e.target.position({ x: 0, y: 0 })
    },
    [clearBodyDrag, data, callbacks, item.id],
  )

  // Apply the live-drag override (if any) so the Line follows the cursor
  // during vertex drag. When no drag is active for this polygon, the
  // stored vertices are used as-is.
  const livePoints = useMemo(() => {
    if (!data) return null
    if (!vertexDrag || vertexDrag.itemId !== item.id) return data.vertices
    const i2 = vertexDrag.index * 2
    if (i2 < 0 || i2 + 1 >= data.vertices.length) return data.vertices
    const next = data.vertices.slice()
    next[i2] = vertexDrag.x
    next[i2 + 1] = vertexDrag.y
    return next
  }, [data, vertexDrag, item.id])

  if (!data) return null

  return (
    <Group
      id={item.id}
      x={0}
      y={0}
      draggable={isSelected}
      onClick={(e) => callbacks.onSelect(item.id, e)}
      onTap={(e) => callbacks.onSelect(item.id, e)}
      onDragMove={handleBodyDragMove}
      onDragEnd={handleBodyDragEnd}
    >
      <Line
        points={livePoints ?? data.vertices}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        closed={data.closed}
        // Make the polygon easy to click. Two cases:
        //   1. closed=true → custom hitFunc draws + fills the closed
        //      polygon in the hit canvas EVEN WHEN the visual fill is
        //      transparent. Without this, an outline-only polygon
        //      (alpha=0 fill) is only clickable along its 2px stroke.
        //      Konva's hit canvas uses the shape's invisible colorKey
        //      for the fill, so this doesn't change visuals.
        //   2. closed=false (open polyline) → no interior to fill; we
        //      widen the stroke's hit-test region via hitStrokeWidth so
        //      clicks within ~18px of the line still register.
        {...(data.closed
          ? {
              hitFunc: (ctx: Konva.Context, shape: Konva.Shape) => {
                const v = livePoints ?? data.vertices
                if (v.length < 4) return
                ctx.beginPath()
                ctx.moveTo(v[0]!, v[1]!)
                for (let i = 2; i < v.length; i += 2) {
                  ctx.lineTo(v[i]!, v[i + 1]!)
                }
                ctx.closePath()
                ctx.fillStrokeShape(shape)
              },
            }
          : { hitStrokeWidth: 18 })}
      />
      {/* MatchView: vertex handles moved into PolygonTransformer
          (mounted by ShapesStage). The shape now just draws the body.
          Restore by uncommenting if reverting to inline handles.
      {isSelected &&
        Array.from({ length: vertexCount }, (_, i) => {
          const x = data.vertices[i * 2] ?? 0
          const y = data.vertices[i * 2 + 1] ?? 0
          return (
            <EndpointHandle
              key={i}
              x={x}
              y={y}
              onDrag={(nx, ny) => callbacks.onUpdateVertex(item.id, i, nx, ny)}
            />
          )
        })}
      */}
    </Group>
  )
}
