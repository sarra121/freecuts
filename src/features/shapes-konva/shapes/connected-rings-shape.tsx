import { useCallback, useMemo } from 'react'
import { Group, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { ShapeProps } from '../types'
import { CONNECTED_RINGS_DEFAULTS } from '../utils/defaults'
import { useShapeEditStore } from '../stores/shape-edit-store'
import { useFieldRingSpin } from '../hooks/use-field-ring-spin'
import { ellipsePerimeter, connectorEndpoints } from '../utils/field-ring-geometry'
import { fieldRingNodes } from './field-ring-graphic'

/**
 * A connected group of field rings. Node positions + open/closed are stored
 * in `freePolygonData` (absolute canvas-pixel coords, reusing the free-polygon
 * draw tool, vertex handles, and update-vertex action). Each node renders a
 * spinning field ring; consecutive nodes are joined by an undirected link that
 * stops at each ring's edge. Dragging a node (via PolygonTransformer) or the
 * whole body recomputes everything live.
 */
export function ConnectedRingsShape({ item, isSelected, callbacks }: ShapeProps) {
  const poly = item.freePolygonData
  const data = item.connectedRingsData

  const vertexDrag = useShapeEditStore((s) => s.vertexDrag)
  const setBodyDrag = useShapeEditStore((s) => s.setBodyDrag)
  const clearBodyDrag = useShapeEditStore((s) => s.clearBodyDrag)

  const nodeRadius = data?.nodeRadius ?? CONNECTED_RINGS_DEFAULTS.nodeRadius
  const ring = data?.ring ?? CONNECTED_RINGS_DEFAULTS.ring
  const connectorColor = data?.connectorColor ?? CONNECTED_RINGS_DEFAULTS.connectorColor
  const connectorWidth = data?.connectorWidth ?? CONNECTED_RINGS_DEFAULTS.connectorWidth

  const radiusX = nodeRadius
  const radiusY = nodeRadius * ring.squash
  const perimeter = ellipsePerimeter(radiusX, radiusY)
  const dashOffset = useFieldRingSpin(ring.spin, ring.spinSpeed, perimeter)

  // Live vertices: swap in the dragged handle's position so rings + links
  // rubber-band with the cursor during a vertex drag (the Group's own drag
  // handles whole-body translation, so bodyDrag isn't applied here).
  const verts = useMemo(() => {
    if (!poly) return []
    if (!vertexDrag || vertexDrag.itemId !== item.id) return poly.vertices
    const i2 = vertexDrag.index * 2
    if (i2 < 0 || i2 + 1 >= poly.vertices.length) return poly.vertices
    const next = poly.vertices.slice()
    next[i2] = vertexDrag.x
    next[i2 + 1] = vertexDrag.y
    return next
  }, [poly, vertexDrag, item.id])

  const handleBodyDragMove = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      setBodyDrag({ itemId: item.id, dx: e.target.x(), dy: e.target.y() })
    },
    [item.id, setBodyDrag],
  )

  const handleBodyDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      clearBodyDrag()
      if (!poly) return
      const dx = e.target.x()
      const dy = e.target.y()
      if (dx === 0 && dy === 0) return
      const next = poly.vertices.map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
      callbacks.onUpdateData(item.id, { freePolygonData: { ...poly, vertices: next } })
      e.target.position({ x: 0, y: 0 })
    },
    [clearBodyDrag, poly, callbacks, item.id],
  )

  if (!poly || !data) return null

  const count = verts.length / 2
  const centres: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    centres.push({ x: verts[i * 2] ?? 0, y: verts[i * 2 + 1] ?? 0 })
  }

  // Connectors: consecutive pairs, plus the closing pair when closed.
  const links = []
  const lastIndex = poly.closed ? count : count - 1
  for (let i = 0; i < lastIndex; i++) {
    const a = centres[i]!
    const b = centres[(i + 1) % count]!
    const pts = connectorEndpoints(a.x, a.y, b.x, b.y, radiusX, radiusY, 2)
    if (!pts) continue
    links.push(
      <Line
        key={`link-${i}`}
        points={pts}
        stroke={connectorColor}
        strokeWidth={connectorWidth}
        lineCap="round"
        listening={false}
      />,
    )
  }

  const rings = centres.flatMap((c, i) =>
    fieldRingNodes({
      cx: c.x,
      cy: c.y,
      radiusX,
      squash: ring.squash,
      fill: item.fillColor ?? connectorColor,
      bandThickness: ring.bandThickness,
      segments: ring.segments,
      continuous: ring.continuous,
      gapRatio: ring.gapRatio,
      roundedEnds: ring.roundedEnds,
      extrusionHeight: ring.extrusionHeight,
      contactShadow: ring.contactShadow,
      dashOffset,
      keyPrefix: `n${i}`,
    }),
  )

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
      {/* Links render behind the rings. */}
      {links}
      {rings}
    </Group>
  )
}
