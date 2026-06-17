import { useCallback, useMemo } from 'react'
import { Arrow, Group, Shape } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type Konva from 'konva'
// MatchView: EndpointHandle moved to ArrowTransformer (mounted by ShapesStage).
// Restore this import if reverting to inline handle rendering below.
// import { EndpointHandle } from '../components/endpoint-handle'
import { ARROW_DEFAULTS, dashToArray } from '../utils/defaults'
import { controlFromMidpoint, lineMidpoint } from '../utils/arrow-curve'
import { useShapeEditStore } from '../stores/shape-edit-store'
import type { ShapeProps } from '../types'

/**
 * Curved-arrow body — split into TWO separate <Shape> children to
 * eliminate the "half-disc fill" bug:
 *
 *   1. Body: stroke-only quadratic Bezier curve. We pass `fillEnabled={false}`
 *      so even if Konva (or a bug in our sceneFunc) tried to fill the path,
 *      there's nothing to fill with. The body sceneFunc only ever calls
 *      `ctx.strokeShape(shape)`.
 *   2. Head: filled triangle. Its path is closed (`ctx.closePath()`) so
 *      `ctx.fillStrokeShape(shape)` works correctly — fills a triangle,
 *      not a chord-bounded half-disc.
 *
 * The earlier single-Shape approach had both fill and stroke configured on
 * the same Shape — even with `ctx.strokeShape()` for the body, certain
 * Konva render paths (buffered canvas for fill+stroke+shadow combos) can
 * paint fill artefacts. Splitting into two Shapes makes it impossible.
 */
function CurvedArrowBody({
  from,
  to,
  control,
  stroke,
  fill,
  strokeWidth,
  dash,
  pointerLength,
  pointerWidth,
}: {
  from: { x: number; y: number }
  to: { x: number; y: number }
  control: { x: number; y: number }
  stroke: string
  fill: string
  strokeWidth: number
  dash: number[] | undefined
  pointerLength: number
  pointerWidth: number
}) {
  // Arrowhead geometry — tangent at t=1 of a quadratic Bezier is 2(P2−P1).
  const tx = to.x - control.x
  const ty = to.y - control.y
  const angle = Math.atan2(ty, tx)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const baseX = to.x - pointerLength * cos
  const baseY = to.y - pointerLength * sin
  const halfW = pointerWidth / 2
  const leftX = baseX + halfW * sin
  const leftY = baseY - halfW * cos
  const rightX = baseX - halfW * sin
  const rightY = baseY + halfW * cos

  return (
    <>
      <Shape
        // Stroke-only — fill DISABLED at the Shape level so it's impossible
        // for the path to get filled, even if a render-path quirk would.
        stroke={stroke}
        strokeWidth={strokeWidth}
        fillEnabled={false}
        dash={dash}
        // Widen the hit canvas's stroke so the curved arrow is clickable
        // along a generous region around the visible line. Konva's hit
        // canvas uses an invisible colorKey for stroking, so this changes
        // ONLY the click target — visuals stay identical.
        hitStrokeWidth={Math.max(strokeWidth, 18)}
        shadowColor={ARROW_DEFAULTS.shadowColor}
        shadowBlur={ARROW_DEFAULTS.shadowBlur}
        shadowOffsetX={ARROW_DEFAULTS.shadowOffsetX}
        shadowOffsetY={ARROW_DEFAULTS.shadowOffsetY}
        shadowOpacity={ARROW_DEFAULTS.shadowOpacity}
        sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
          ctx.beginPath()
          ctx.moveTo(from.x, from.y)
          ctx.quadraticCurveTo(control.x, control.y, to.x, to.y)
          ctx.strokeShape(shape)
        }}
      />
      <Shape
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        shadowColor={ARROW_DEFAULTS.shadowColor}
        shadowBlur={ARROW_DEFAULTS.shadowBlur}
        shadowOffsetX={ARROW_DEFAULTS.shadowOffsetX}
        shadowOffsetY={ARROW_DEFAULTS.shadowOffsetY}
        shadowOpacity={ARROW_DEFAULTS.shadowOpacity}
        sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
          // Closed triangle — fill is well-defined here, no chord magic.
          ctx.beginPath()
          ctx.moveTo(to.x, to.y)
          ctx.lineTo(leftX, leftY)
          ctx.lineTo(rightX, rightY)
          ctx.closePath()
          ctx.fillStrokeShape(shape)
        }}
      />
    </>
  )
}

/**
 * Two-point arrow with optional quadratic-Bezier curvature. Endpoint
 * handles + a curve-midpoint handle live in `ArrowTransformer` and use
 * `useShapeEditStore.vertexDrag` to broadcast their live position while
 * the user drags. We subscribe here and apply overrides to from/to/control
 * so the arrow body rubber-bands with the cursor.
 *
 * Body drag translates both endpoints together; we bake the delta into
 * the data on dragEnd and reset the Group origin so the data stays in
 * one coordinate space.
 *
 * Rendering:
 *  - When `controlX/Y` are unset, render as a plain <Arrow> (Konva's
 *    polyline-with-head).
 *  - When set, render via <CurvedArrowBody> (above) which uses two
 *    separate <Shape> children: stroke-only body + fill+stroke head.
 */
export function ArrowShape({ item, isSelected, callbacks }: ShapeProps) {
  const a = item.arrowData
  const stroke = item.strokeColor ?? ARROW_DEFAULTS.stroke
  const fill = item.fillColor ?? ARROW_DEFAULTS.fill
  const strokeWidth = item.strokeWidth ?? ARROW_DEFAULTS.strokeWidth

  // Live-drag override pushed by ArrowTransformer's EndpointHandle.
  const vertexDrag = useShapeEditStore((s) => s.vertexDrag)
  const setBodyDrag = useShapeEditStore((s) => s.setBodyDrag)
  const clearBodyDrag = useShapeEditStore((s) => s.clearBodyDrag)

  // On every drag-move tick during body drag, push the Group's current
  // translation into the preview store so ArrowTransformer can offset
  // the endpoint handles to track the body.
  const handleBodyDragMove = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      setBodyDrag({ itemId: item.id, dx: e.target.x(), dy: e.target.y() })
    },
    [item.id, setBodyDrag],
  )

  const handleBodyDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      clearBodyDrag()
      if (!a) return
      const dx = e.target.x()
      const dy = e.target.y()
      if (dx === 0 && dy === 0) return
      callbacks.onUpdateData(item.id, {
        arrowData: {
          ...a,
          fromX: a.fromX + dx,
          fromY: a.fromY + dy,
          toX: a.toX + dx,
          toY: a.toY + dy,
        },
      })
      // Reset Konva-side translation; the new data is now the truth.
      e.target.position({ x: 0, y: 0 })
    },
    [a, callbacks, item.id, clearBodyDrag],
  )

  // Apply live-drag overrides for the three handle indices:
  //   0 → from-endpoint, 1 → to-endpoint, 2 → curve midpoint
  // The curve handle gives us the desired apex position; we run it
  // through controlFromMidpoint() to get the P1 control point.
  const liveGeometry = useMemo(() => {
    if (!a) return null
    let from = { x: a.fromX, y: a.fromY }
    let to = { x: a.toX, y: a.toY }
    // Default control = line midpoint when no explicit control set (this
    // collapses the Bezier to a straight line — no visual change vs the
    // plain <Arrow> path, but it lets the handle math stay uniform).
    let control =
      a.controlX != null && a.controlY != null
        ? { x: a.controlX, y: a.controlY }
        : lineMidpoint(from, to)
    let hasExplicitCurve = a.controlX != null && a.controlY != null

    if (vertexDrag && vertexDrag.itemId === item.id) {
      if (vertexDrag.index === 0) from = { x: vertexDrag.x, y: vertexDrag.y }
      else if (vertexDrag.index === 1) to = { x: vertexDrag.x, y: vertexDrag.y }
      else if (vertexDrag.index === 2) {
        // User is dragging the curve handle. Compute the new control
        // point so the curve passes through the drag position at t=0.5.
        control = controlFromMidpoint(from, to, { x: vertexDrag.x, y: vertexDrag.y })
        hasExplicitCurve = true
      }
    }

    return { from, to, control, hasExplicitCurve }
  }, [a, vertexDrag, item.id])

  if (!a) return null

  const pointerLength = a.pointerLength ?? ARROW_DEFAULTS.pointerLength
  const pointerWidth = a.pointerWidth ?? ARROW_DEFAULTS.pointerWidth
  const dash = dashToArray(a.dash)

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
      {liveGeometry?.hasExplicitCurve ? (
        <CurvedArrowBody
          from={liveGeometry.from}
          to={liveGeometry.to}
          control={liveGeometry.control}
          stroke={stroke}
          fill={fill}
          strokeWidth={strokeWidth}
          dash={dash}
          pointerLength={pointerLength}
          pointerWidth={pointerWidth}
        />
      ) : (
        <Arrow
          points={
            liveGeometry
              ? [liveGeometry.from.x, liveGeometry.from.y, liveGeometry.to.x, liveGeometry.to.y]
              : [a.fromX, a.fromY, a.toX, a.toY]
          }
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          // Same widened hit region as the curved variant — clicking
          // anywhere within ~18px of the line selects the arrow. The
          // arrowhead has its own filled triangle hit area, so this only
          // affects the body line.
          hitStrokeWidth={Math.max(strokeWidth, 18)}
          pointerLength={pointerLength}
          pointerWidth={pointerWidth}
          dash={dash}
          shadowColor={ARROW_DEFAULTS.shadowColor}
          shadowBlur={ARROW_DEFAULTS.shadowBlur}
          shadowOffsetX={ARROW_DEFAULTS.shadowOffsetX}
          shadowOffsetY={ARROW_DEFAULTS.shadowOffsetY}
          shadowOpacity={ARROW_DEFAULTS.shadowOpacity}
        />
      )}
      {/* MatchView: endpoint handles moved into ArrowTransformer
          (mounted by ShapesStage). The shape now just draws the body.
          Restore by uncommenting if reverting to inline handles.
      {isSelected && (
        <>
          <EndpointHandle
            x={a.fromX}
            y={a.fromY}
            onDrag={(x, y) => callbacks.onUpdateVertex(item.id, 0, x, y)}
          />
          <EndpointHandle
            x={a.toX}
            y={a.toY}
            onDrag={(x, y) => callbacks.onUpdateVertex(item.id, 1, x, y)}
          />
        </>
      )}
      */}
    </Group>
  )
}
