import { Rect } from 'react-konva'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import type { ShapeProps } from '../types'

export function RectangleShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const { width, height } = resolveParametricPosition(item, canvasWidth, canvasHeight)

  return (
    <ParametricShapeBody {...props} centerOrigin>
      <Rect
        width={width}
        height={height}
        cornerRadius={item.cornerRadius ?? 0}
        fill={item.fillColor ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.strokeColor ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </ParametricShapeBody>
  )
}
