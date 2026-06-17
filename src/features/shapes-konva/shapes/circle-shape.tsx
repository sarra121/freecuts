import { Circle } from 'react-konva'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import type { ShapeProps } from '../types'

export function CircleShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const { width, height } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  // Aspect-locked: radius is half the smaller dimension.
  const radius = Math.min(width, height) / 2

  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      <Circle
        radius={radius}
        fill={item.fillColor ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.strokeColor ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </ParametricShapeBody>
  )
}
