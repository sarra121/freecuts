import { create } from 'zustand'
import type { ShapeItem } from '@/types/timeline'

/**
 * Live drag preview for a single shape vertex / endpoint.
 *
 * - `itemId` — the ShapeItem currently being edited.
 * - `index` — vertex index for free-polygon (0, 1, 2, …), or 0 / 1 for the
 *   two arrow endpoints (fromX/Y → 0, toX/Y → 1).
 * - `x` / `y` — current Konva-stage pixel coords of the dragged handle.
 *
 * Set during `onDragMove`, cleared on `onDragEnd` (after which the
 * authoritative position is committed to the timeline store).
 */
export interface VertexDragPreview {
  itemId: string
  index: number
  x: number
  y: number
}

/**
 * Live drag preview for whole-shape body drag (polygon / arrow Group is
 * being translated by the cursor). The shape's stored coordinates haven't
 * changed yet — they get the delta baked in on dragEnd — so transformers
 * read this and offset their handles by `(dx, dy)` to stay glued to the
 * body during the drag.
 */
export interface BodyDragPreview {
  itemId: string
  dx: number
  dy: number
}

/**
 * Per-item live preview for shape properties (fill/stroke/cornerRadius/etc.)
 * driven by the properties panel. While a NumberInput/SliderInput/ColorPicker
 * is being dragged, the panel writes to `propertiesPreview` on every tick;
 * ShapeRouter merges the override into the rendered item so the preview
 * canvas updates in real time. On release, the panel clears the preview
 * and commits the final value to the timeline store (one undo entry).
 *
 * The map is keyed by `ShapeItem.id` so a multi-select can preview
 * different changes per item independently.
 */
export type PropertiesPreview = Record<string, Partial<ShapeItem>>

interface ShapeEditStore {
  /** Active vertex/endpoint drag, or null when no drag is in flight. */
  vertexDrag: VertexDragPreview | null
  setVertexDrag(preview: VertexDragPreview): void
  clearVertexDrag(): void

  /** Active body-drag translation, or null when not body-dragging. */
  bodyDrag: BodyDragPreview | null
  setBodyDrag(preview: BodyDragPreview): void
  clearBodyDrag(): void

  /** Live properties preview from the panel (null when no edit in flight). */
  propertiesPreview: PropertiesPreview | null
  setPropertiesPreview(preview: PropertiesPreview): void
  clearPropertiesPreview(): void

  /** Clear ALL in-flight edit previews. Called on project switch so stale
   *  drag/preview state from one project can't leak into the next. */
  reset(): void
}

/**
 * Cheap, undo-free local state for shape-editing UX. Lives outside the
 * timeline store so that high-frequency drag events (60+ Hz) don't push
 * undo entries onto the command stack — only the final committed position
 * does.
 *
 * Pattern mirrors `useGizmoStore.previewTransform` for parametric shapes
 * and `useMaskEditorStore.previewVertices` for mask paths. Both render
 * functions and transformer variants subscribe here for "rubber band"
 * feedback during drag.
 */
export const useShapeEditStore = create<ShapeEditStore>()((set) => ({
  vertexDrag: null,
  setVertexDrag: (preview) => set({ vertexDrag: preview }),
  clearVertexDrag: () => set({ vertexDrag: null }),
  bodyDrag: null,
  setBodyDrag: (preview) => set({ bodyDrag: preview }),
  clearBodyDrag: () => set({ bodyDrag: null }),
  propertiesPreview: null,
  setPropertiesPreview: (preview) => set({ propertiesPreview: preview }),
  clearPropertiesPreview: () => set({ propertiesPreview: null }),
  reset: () => set({ vertexDrag: null, bodyDrag: null, propertiesPreview: null }),
}))
