import type { ShapeProps } from '../types'
import { FIELD_RING_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import { useFieldRingSpin } from '../hooks/use-field-ring-spin'
import { ellipsePerimeter } from '../utils/field-ring-geometry'
import { fieldRingNodes } from './field-ring-graphic'

/**
 * Field-level player ring. A dashed Konva ellipse band with optional
 * extrusion (stacked darker copies), contact shadow, and frame-locked spin.
 * Squash, segments, gap, thickness, etc. come from item.fieldRingData;
 * radius comes from transform.width and the band colour from fillColor.
 * The actual ring nodes are built by the shared fieldRingNodes() helper so
 * the look matches each node of a connected-rings group.
 */
export function FieldRingShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const d = item.fieldRingData

  const { width } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  const fill = item.fillColor ?? FIELD_RING_DEFAULTS.fill

  const squash = d?.squash ?? FIELD_RING_DEFAULTS.squash
  const bandThickness = d?.bandThickness ?? FIELD_RING_DEFAULTS.bandThickness
  const segments = d?.segments ?? FIELD_RING_DEFAULTS.segments
  const continuous = d?.continuous ?? FIELD_RING_DEFAULTS.continuous
  const gapRatio = d?.gapRatio ?? FIELD_RING_DEFAULTS.gapRatio
  const roundedEnds = d?.roundedEnds ?? FIELD_RING_DEFAULTS.roundedEnds
  const extrusionHeight = d?.extrusionHeight ?? FIELD_RING_DEFAULTS.extrusionHeight
  const spin = d?.spin ?? FIELD_RING_DEFAULTS.spin
  const spinSpeed = d?.spinSpeed ?? FIELD_RING_DEFAULTS.spinSpeed
  const contactShadow = d?.contactShadow ?? FIELD_RING_DEFAULTS.contactShadow

  const radiusX = width / 2
  const perimeter = ellipsePerimeter(radiusX, radiusX * squash)
  const dashOffset = useFieldRingSpin(spin, spinSpeed, perimeter)

  // Rendered inside ParametricShapeBody, which positions the Group at the
  // shape centre, so the ring is drawn at local (0, 0).
  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      {fieldRingNodes({
        cx: 0,
        cy: 0,
        radiusX,
        squash,
        fill,
        bandThickness,
        segments,
        continuous,
        gapRatio,
        roundedEnds,
        extrusionHeight,
        contactShadow,
        dashOffset,
        keyPrefix: 'fr',
      })}
    </ParametricShapeBody>
  )
}
