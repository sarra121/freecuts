import { RegularPolygon } from 'react-konva'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import type { ShapeProps } from '../types'

export function RegularPolygonShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const { width, height } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  const sides = Math.max(3, item.points ?? 6)
  const radius = Math.min(width, height) / 2

  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      <RegularPolygon
        sides={sides}
        radius={radius}
        fill={item.fillColor ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.strokeColor ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </ParametricShapeBody>
  )
}
