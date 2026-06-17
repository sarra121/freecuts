import { Group, RegularPolygon } from 'react-konva'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import type { ShapeProps } from '../types'

/**
 * Triangle = Konva RegularPolygon (sides=3). The `direction` prop
 * (up/down/left/right) is an extra rotation applied INSIDE the body wrapper
 * — the body owns the user's `transform.rotation`; this inner Group adds
 * the direction-specific spin on top.
 */
function rotationForDirection(direction: 'up' | 'down' | 'left' | 'right' | undefined): number {
  switch (direction) {
    case 'down':
      return 180
    case 'left':
      return -90
    case 'right':
      return 90
    case 'up':
    default:
      return 0
  }
}

export function TriangleShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const { width, height } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  const directionRot = rotationForDirection(item.direction)
  const radius = Math.min(width, height) / 2

  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      <Group rotation={directionRot}>
        <RegularPolygon
          sides={3}
          radius={radius}
          fill={item.fillColor ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
          stroke={item.strokeColor ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
          strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
        />
      </Group>
    </ParametricShapeBody>
  )
}
