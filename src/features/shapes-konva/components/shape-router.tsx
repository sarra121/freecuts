import { DeferredShapePlaceholder } from '../shapes/deferred-shape-placeholder'
import { ArrowShape } from '../shapes/arrow-shape'
import { FreePolygonShape } from '../shapes/free-polygon-shape'
import { RectangleShape } from '../shapes/rectangle-shape'
import { CircleShape } from '../shapes/circle-shape'
import { EllipseShape } from '../shapes/ellipse-shape'
import { TriangleShape } from '../shapes/triangle-shape'
import { RegularPolygonShape } from '../shapes/regular-polygon-shape'
import { FieldRingShape } from '../shapes/field-ring-shape'
import { ConnectedRingsShape } from '../shapes/connected-rings-shape'
import { SpotlightShape } from '../shapes/spotlight-shape'
import { TextShape } from '../shapes/text-shape'
import { TimerShape } from '../shapes/timer-shape'
import { ImageShape } from '../shapes/image-shape'
import { useShapeEditStore } from '../stores/shape-edit-store'
import { resolveShapeAtFrame } from '../utils/shape-keyframes'
import type { ShapeProps } from '../types'
import type { ShapeItem } from '@/types/timeline'

/**
 * Merge a per-item properties preview into the underlying shape item.
 *
 * Top-level fields (fillColor, strokeWidth, cornerRadius, …) are
 * straight overrides. Nested discriminated-union fields like
 * `arrowData` and `freePolygonData` need a SHALLOW merge so a partial
 * preview (e.g. just `{ pointerLength: 30 }`) doesn't wipe the
 * coordinates that came with the stored data.
 */
function mergePreview(item: ShapeItem, preview: Partial<ShapeItem> | undefined): ShapeItem {
  if (!preview) return item
  const merged: ShapeItem = { ...item, ...preview }
  if (preview.arrowData && item.arrowData) {
    merged.arrowData = { ...item.arrowData, ...preview.arrowData }
  }
  if (preview.freePolygonData && item.freePolygonData) {
    merged.freePolygonData = { ...item.freePolygonData, ...preview.freePolygonData }
  }
  if (preview.fieldRingData && item.fieldRingData) {
    merged.fieldRingData = { ...item.fieldRingData, ...preview.fieldRingData }
  }
  if (preview.connectedRingsData && item.connectedRingsData) {
    merged.connectedRingsData = { ...item.connectedRingsData, ...preview.connectedRingsData }
  }
  if (preview.spotlightData && item.spotlightData) {
    merged.spotlightData = { ...item.spotlightData, ...preview.spotlightData }
  }
  if (preview.textShapeData && item.textShapeData) {
    merged.textShapeData = { ...item.textShapeData, ...preview.textShapeData }
  }
  if (preview.timerData && item.timerData) {
    merged.timerData = { ...item.timerData, ...preview.timerData }
  }
  if (preview.imageShapeData && item.imageShapeData) {
    merged.imageShapeData = { ...item.imageShapeData, ...preview.imageShapeData }
  }
  return merged
}

/**
 * Dispatch a shape item to the right Konva component based on its
 * `shapeType`. Single chokepoint for property-preview merging so the
 * individual shape components don't each have to subscribe to
 * `useShapeEditStore.propertiesPreview`.
 */
export function ShapeRouter(props: ShapeProps) {
  // Subscribe to JUST this item's slice of the preview map so we only
  // re-render when our specific overrides change, not when an unrelated
  // shape is being edited in a multi-select scenario.
  const previewSlice = useShapeEditStore((s) => s.propertiesPreview?.[props.item.id])

  // Order of merges (last wins):
  //   1. base item   — what's stored on the timeline item.
  //   2. resolved    — keyframe change log up to current frame.
  //   3. preview     — live drag from the properties panel (preview wins
  //                    so the slider feels instant; once released the
  //                    preview clears and the keyframe entry takes over).
  // `props.frame` is the project-absolute playhead. The change log is
  // clip-relative so we subtract `item.from`.
  const relativeFrame = props.frame - props.item.from
  const itemAfterKeyframes = resolveShapeAtFrame(props.item, relativeFrame)
  const item = mergePreview(itemAfterKeyframes, previewSlice)
  const mergedProps = item !== props.item ? { ...props, item } : props

  switch (item.shapeType) {
    case 'arrow':
      return <ArrowShape {...mergedProps} />

    case 'free-polygon':
      return <FreePolygonShape {...mergedProps} />

    case 'rectangle':
      return <RectangleShape {...mergedProps} />

    case 'circle':
      return <CircleShape {...mergedProps} />

    case 'ellipse':
      return <EllipseShape {...mergedProps} />

    case 'triangle':
      return <TriangleShape {...mergedProps} />

    case 'polygon':
      return <RegularPolygonShape {...mergedProps} />

    case 'field-ring':
      return <FieldRingShape {...mergedProps} />

    case 'connected-rings':
      return <ConnectedRingsShape {...mergedProps} />

    case 'spotlight':
      return <SpotlightShape {...mergedProps} />

    case 'text':
      return <TextShape {...mergedProps} />

    case 'timer':
      return <TimerShape {...mergedProps} />

    case 'image':
      return <ImageShape {...mergedProps} />

    case 'star':
    case 'heart':
    case 'path':
      // Deferred variants — placeholder permanently in v0.
      return <DeferredShapePlaceholder item={item} />

    default: {
      const _exhaustive: never = item.shapeType
      void _exhaustive
      return null
    }
  }
}
