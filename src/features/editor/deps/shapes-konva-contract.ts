/**
 * Cross-feature import seam (contract) for editor -> shapes-konva.
 *
 * Per `check:deps-contracts`, all raw `@/features/shapes-konva/*` imports live
 * in this `*-contract.ts` file; the sibling `shapes-konva.ts` adapter re-exports
 * from here so consumers import from one stable place.
 */
export {
  useShapeEditStore,
  type PropertiesPreview,
  type VertexDragPreview,
  type BodyDragPreview,
} from '@/features/shapes-konva/stores/shape-edit-store'

export { resolveShapeAtFrame } from '@/features/shapes-konva/utils/shape-keyframes'
export { commitShapeUpdate } from '@/features/shapes-konva/stores/actions/commit-shape-update'
export { createImageShape } from '@/features/shapes-konva/stores/actions/create-image-shape'
export { useDrawToolStore, type ParametricShapeType } from '@/features/shapes-konva'
