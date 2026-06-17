import { Image as KonvaImage } from 'react-konva'
import type { ShapeProps } from '../types'
import { IMAGE_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import { useShapeImage } from '../hooks/use-shape-image'

// Stored as degrees (intuitive in the panel); Konva skew is a shear FACTOR.
const toFactor = (deg: number) => Math.tan((deg * Math.PI) / 180)

/**
 * Image overlay shape. Renders a react-konva <Image> inside the shared
 * ParametricShapeBody (drag / select / position / opacity / transformer). The
 * picture is resolved from `imageShapeData.mediaId`; `skewX`/`skewY` (degrees)
 * shear it so it can lie on the pitch with perspective — mirrors TextShape.
 * Opacity is applied to the group by ParametricShapeBody (transform.opacity),
 * so semi-transparent overlays work with the shared opacity control.
 *
 * Renders nothing until the image has decoded (the transformer still attaches
 * to the Group via its id, so it can be moved/resized immediately).
 */
export function ImageShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const d = item.imageShapeData
  const { width, height } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  const image = useShapeImage(d?.mediaId)
  const skewX = toFactor(d?.skewX ?? IMAGE_DEFAULTS.skewX)
  const skewY = toFactor(d?.skewY ?? IMAGE_DEFAULTS.skewY)

  return (
    <ParametricShapeBody {...props} centerOrigin>
      {image ? (
        <KonvaImage image={image} width={width} height={height} skewX={skewX} skewY={skewY} />
      ) : null}
    </ParametricShapeBody>
  )
}
