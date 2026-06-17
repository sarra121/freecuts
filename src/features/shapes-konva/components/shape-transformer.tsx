import type { ShapeItem } from '@/types/timeline'
import { ParametricTransformer } from './parametric-transformer'
import { ArrowTransformer } from './arrow-transformer'
import { PolygonTransformer } from './polygon-transformer'
import { TextTransformer } from './text-transformer'
import type { ShapeCallbacks } from '../types'

interface ShapeTransformerProps {
  selectedShapes: ShapeItem[]
  callbacks: ShapeCallbacks
  canvasWidth: number
  canvasHeight: number
}

/**
 * Single mounting point for shape edit affordances on the Konva Stage.
 * Switches per shape type for single-select; multi-select always routes
 * to `ParametricTransformer` (Konva bounding-box) per the M1 design
 * decision — mixed-type groups allow non-aspect-locked resize, accepting
 * that circles may temporarily distort during drag.
 *
 * Renders `null` when nothing's selected so the Stage has no overlay.
 */
export function ShapeTransformer({
  selectedShapes,
  callbacks,
  canvasWidth,
  canvasHeight,
}: ShapeTransformerProps) {
  if (selectedShapes.length === 0) return null

  // Multi-select → bounding-box Transformer for the whole group.
  if (selectedShapes.length > 1) {
    return (
      <ParametricTransformer
        items={selectedShapes}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
      />
    )
  }

  // Single-select → pick the variant that matches the shape's edit model.
  const shape = selectedShapes[0]!
  switch (shape.shapeType) {
    case 'arrow':
      return <ArrowTransformer item={shape} callbacks={callbacks} />
    case 'free-polygon':
    case 'connected-rings':
      return <PolygonTransformer item={shape} callbacks={callbacks} />
    case 'text':
      return (
        <TextTransformer
          item={shape}
          callbacks={callbacks}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      )
    case 'rectangle':
    case 'circle':
    case 'ellipse':
    case 'triangle':
    case 'polygon':
    case 'field-ring':
    case 'timer':
    case 'image':
      return (
        <ParametricTransformer
          items={[shape]}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      )
    case 'spotlight':
      // No on-canvas transformer — its cached/composited group doesn't
      // round-trip the parametric resize. Move by dragging; size in properties.
      return null
    case 'star':
    case 'heart':
    case 'path':
      // Deferred shape types — no UI to create them, no transformer
      // variant yet. Silently render nothing.
      return null
    default: {
      const _exhaustive: never = shape.shapeType
      void _exhaustive
      return null
    }
  }
}
