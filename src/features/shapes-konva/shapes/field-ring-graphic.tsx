import type { ReactNode } from 'react'
import { Ellipse } from 'react-konva'
import { ellipsePerimeter, computeDash, darken } from '../utils/field-ring-geometry'

export interface FieldRingGraphicParams {
  /** Centre in the coordinate space of the parent Konva node. */
  cx: number
  cy: number
  radiusX: number
  squash: number
  fill: string
  bandThickness: number
  segments: number
  continuous: boolean
  gapRatio: number
  roundedEnds: boolean
  extrusionHeight: number
  contactShadow: boolean
  /** Frame-locked dash offset (from useFieldRingSpin). */
  dashOffset: number
  /** Unique prefix for React keys (e.g. the vertex index). */
  keyPrefix: string
}

/**
 * Build the Konva nodes for one field ring at (cx, cy): contact shadow,
 * extruded wall, and the dashed top band. Shared by the standalone
 * FieldRingShape and each node of a connected-rings group so the look stays
 * identical. The band is the only listening node; wall/shadow are inert.
 */
export function fieldRingNodes(p: FieldRingGraphicParams): ReactNode[] {
  const radiusX = p.radiusX
  const radiusY = radiusX * p.squash
  const perimeter = ellipsePerimeter(radiusX, radiusY)
  const dash = computeDash(perimeter, p.segments, p.gapRatio, p.continuous)
  const lineCap = p.roundedEnds ? 'round' : 'butt'
  const k = p.keyPrefix
  const nodes: ReactNode[] = []

  if (p.contactShadow) {
    nodes.push(
      <Ellipse
        key={`${k}-shadow`}
        x={p.cx}
        y={p.cy + p.extrusionHeight + 3}
        radiusX={radiusX}
        radiusY={Math.max(radiusY, 6)}
        fill="rgba(0,0,0,0.30)"
        shadowColor="#000"
        shadowBlur={12}
        shadowOpacity={0.5}
        listening={false}
      />,
    )
  }

  for (let i = p.extrusionHeight; i >= 1; i--) {
    const f = 0.34 + 0.26 * (1 - i / Math.max(p.extrusionHeight, 1))
    nodes.push(
      <Ellipse
        key={`${k}-wall-${i}`}
        x={p.cx}
        y={p.cy + i}
        radiusX={radiusX}
        radiusY={radiusY}
        stroke={darken(p.fill, f)}
        strokeWidth={Math.max(p.bandThickness - 1, 1)}
        dash={dash}
        dashOffset={p.dashOffset}
        lineCap={lineCap}
        listening={false}
      />,
    )
  }

  nodes.push(
    <Ellipse
      key={`${k}-band`}
      x={p.cx}
      y={p.cy}
      radiusX={radiusX}
      radiusY={radiusY}
      stroke={p.fill}
      strokeWidth={p.bandThickness}
      dash={dash}
      dashOffset={p.dashOffset}
      lineCap={lineCap}
    />,
  )

  return nodes
}
