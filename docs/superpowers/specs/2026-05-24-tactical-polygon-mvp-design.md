# Tactical Polygon MVP — Design

> **SUPERSEDED** by `2026-05-24-konva-shape-renderer-design.md` in the same directory.
> That spec broadens this one to unify ALL shapes under Konva (instead of a separate
> `tactical-shape` item type) and replaces this scope. This file is kept for history.

**Date:** 2026-05-24
**Status:** Superseded (kept for history)
**Topic:** Introduce a Konva-rendered tactical-shape system to MatchView, starting with a free-form Polygon as the first shape. Establish the architecture, components, drawing flow, persistence, and UI seam for future tactical shapes (arrows, magnifier, gaze cone, field overlay, etc.) without building them yet.

## Summary

MatchView's analysis workflow needs shapes the existing GPU SDF pipeline can't support:
free-form polygons with drag-vertex editing, hatch fills, custom per-frame draw
logic, gradients, composite groups, and per-frame state bound to external data
(player tracking, video samples). This work introduces a parallel rendering
layer for those "tactical" shapes built on **Konva** (a 2D canvas scene-graph
library) and ships the **free-form Polygon** as the first concrete shape. Every
later tactical shape (flowing arrow, magnifier, gaze cone, …) will be built on
the architecture this MVP establishes.

The existing GPU shape pipeline (parametric rectangle / circle / triangle /
ellipse / star / polygon / heart / path) is **unchanged** — it remains the
renderer for simple `shape` items.

## Goals

- A new timeline item type `tactical-shape` distinct from the existing `shape`.
- A Konva canvas layer mounted on top of the preview, transparent where empty,
  hosting all tactical shapes at all times.
- A `BaseTacticalShape` class establishing the `update(timelineFrame, ctx)`
  contract every later tactical shape will implement.
- A `PolygonTacticalShape` — Konva-based, free-form, click-to-draw, drag-vertex
  edit mode, solid fill, stroke. Static (no animation, no tracking) in v0.
- A "Draw Polygon" tool that activates a canvas drawing mode, accepts
  click-to-add-vertex input, finishes on double-click / Enter / closed-loop,
  creates a `tactical-shape` item at the current playhead.
- A properties-sidebar branch that surfaces fill, stroke, "Edit Path" for a
  selected tactical shape.
- Project persistence: the polygon serializes into the project file and
  re-loads as a Konva shape on project open.
- Build + manual smoke test green at the end.

## Non-Goals (v0)

- **No animation engine for tactical shapes** — `update(frame, ctx)` is in
  place but the polygon's body is static. Later tactical shapes will use it.
- **No hatch fill / gradient fill / pattern fill** — solid color only.
- **No player tracking / detection-JSON binding** — needs a `TrackingProvider`
  subsystem; separate feature.
- **No export rasterization** — preview-only. Exporting a project with tactical
  shapes will render the rest correctly but omit them. (Loud TODO in the export
  path with a one-line warning toast — design covers the seam, work is deferred.)
- **No keyboard shortcuts** for the draw tool.
- **No additional tactical shapes** — only Polygon. Future shapes are out of
  scope of this spec.
- **No re-exposing the existing Shapes sidebar tab** — the user's earlier
  "bring back the rectangle buttons" request is handled as a *separate* tiny
  task documented here but not implemented in this MVP: uncomment the Shapes
  rail entry in `media-sidebar.tsx`. It's UI-independent of the tactical
  pipeline.

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Renderer | Konva (Canvas 2D scene graph), not WGSL shader |
| Library alternative considered | Fabric.js — rejected. Legacy code is Konva, smaller bundle, native layer model |
| Item type | New `'tactical-shape'` alongside existing `'shape'` |
| Canvas placement | New Konva `<canvas>` layer mounted as a sibling of `scrubCanvasRef` in `preview-stage.tsx` |
| Animation model | `update(timelineFrame, ctx)` driven by preview render pump; **no `Konva.Animation`** |
| Drawing tool location | Editor top toolbar — new "Draw" group |
| First tactical shape | Free-form Polygon (legacy `Polygon2D` shape, structurally) |
| Outer pose (x/y/rotation/opacity) | Standard timeline-item properties + future keyframes; orthogonal to inner state |

## Architecture

### New timeline item type

`src/types/timeline.ts` — extend the `TimelineItem` union:

```ts
| {
    type: 'tactical-shape'
    subtype: 'polygon'   // discriminator for the shape variant
    data: PolygonShapeData
    // …plus the standard timeline-item fields: id, from, durationInFrames,
    // trackId, x, y, width, height, rotation, opacity, etc.
  }
```

`PolygonShapeData` (in the new feature dir):

```ts
interface PolygonShapeData {
  points: number[]       // flat [x0, y0, x1, y1, …], relative to item origin
  closed: boolean        // closed polygon vs open polyline
  fill: string           // CSS color
  stroke: string         // CSS color
  strokeWidth: number
}
```

Project-schema migration: bump `CURRENT_SCHEMA_VERSION`, add a no-op forward
migration (older projects load with no `tactical-shape` items, so nothing to
upgrade — the migration just establishes the boundary).

### Render layer

`src/features/tactical-shapes/components/tactical-shapes-stage.tsx` mounts a
single Konva `Stage` + `Layer` into a `<div>` placed as a sibling of
`scrubCanvasRef` inside `preview-stage.tsx`. Order of stacking
(bottom → top):

1. Player / DOM `<video>` elements
2. `scrubCanvasRef` — composited video, effects, GPU shapes
3. **`tacticalShapesStageRef` — NEW Konva canvas**
4. `gpuEffectsCanvasRef` — overlay for live GPU effect editing (unchanged)
5. DOM overlays (selection box, transform gizmo)

The Konva canvas is sized to the preview canvas. Its CSS `pointer-events` toggles
based on whether a draw tool is active or a tactical shape is selected — when no
tactical interaction is happening, clicks pass through to the layer below.

### The `update(frame, ctx)` contract

Every tactical shape extends `BaseTacticalShape extends Konva.Group`. The base
class declares:

```ts
abstract update(timelineFrame: number, ctx: ShapeRenderContext): void
```

`ShapeRenderContext`:

```ts
interface ShapeRenderContext {
  fps: number
  itemFrame: number              // frame within the item's lifespan (frame - from)
  itemDurationInFrames: number
  // Reserved for future shapes — populated as features ship:
  tracking?: TrackingProvider    // not used in v0
  previewCanvas?: HTMLCanvasElement  // not used in v0 (magnifier will use this)
}
```

For the v0 Polygon, `update()` is a **no-op** — the polygon's geometry is fully
stored on the item; no per-frame computation is needed. The contract is laid down
now so every later tactical shape slots in without re-architecting.

The render pump (`use-preview-render-pump-controller.ts`) gets a new step in its
loop: after the existing composite pass, call `tacticalShapesStage.tick(frame)`,
which iterates active tactical-shape items, calls `shape.update(frame, ctx)` on
each, and triggers `konvaLayer.batchDraw()`.

### Drawing flow — Polygon

State machine (in a new `useDrawToolStore`):

- `idle` (no tool active)
- `drawing-polygon` — cursor in cross-hair; click adds a vertex; mouse-move
  updates a "next vertex" rubber-band line; double-click or Enter finishes;
  Esc cancels; clicking the first vertex (within 8 px) closes the polygon
- The provisional vertex list is held in the store, not on the Konva canvas
  proper — a `DrawingOverlay` component reads the store and draws the in-flight
  geometry as Konva nodes that don't yet correspond to a timeline item

On finish:

1. Translate the absolute-pixel vertex list to item-relative coordinates
   (subtract `minX`/`minY`, store the offset as the item's `x`/`y`).
2. Create a new `tactical-shape` item at the current playhead frame, default
   duration `fps * 5` frames (5 seconds), via a timeline-actions module
   (`features/tactical-shapes/stores/actions/create-shape.ts`).
3. Clear the drawing state. The new shape appears on the canvas immediately.
4. Select the new item; properties sidebar switches to the tactical-shape branch.

### Edit mode

Double-clicking a selected polygon enters edit mode. A `Konva.Group` named
`handles` (sibling of the polygon's `Konva.Line`) becomes visible and contains
one `Konva.Circle` per vertex. Each handle is `draggable: true`; on `dragmove`
the corresponding vertex in the item's data is updated through a timeline action
(so undo/redo work). Hover changes the radius + cursor. Esc or click-outside
exits edit mode and hides the handle group.

This is a direct port of the legacy `Polygon2D.enterEditMode()` /
`addHandles()` logic, with two changes:

- Vertex mutations go through the timeline-store action, not directly on the
  Konva node — so undo/redo + persistence are correct.
- Handle counter-scaling (legacy `updateHandleAppearance`) is retained so
  handles stay 6 px on screen regardless of item scale.

### Properties sidebar branch

`src/features/editor/components/properties-sidebar/index.tsx` (already routes
between Canvas / Clip / Transition / Marker panels): add a new branch for
`tactical-shape` items → render `TacticalShapePanel`.

`TacticalShapePanel` (new) shows:

- Shape type label ("Polygon")
- Fill color picker
- Stroke color picker
- Stroke width slider
- "Edit Path" button (toggles edit mode)
- Vertex count (read-only)

Changes here mutate the item's `data` through a single
`updateTacticalShapeData(id, patch)` action so undo/redo works.

### Toolbar — "Draw" group

`src/features/editor/components/toolbar.tsx`: add a new icon-button group
between the project-info badge and the Save button, containing one button:

- **Polygon** (pentagon icon, `Pentagon` from `lucide-react`): toggles the
  draw-polygon tool. Active state is highlighted (matches existing toolbar
  button-active styling).

Clicking the button flips the draw-tool store to `drawing-polygon` (or back to
`idle` if already active). The preview-canvas overlay reads this store to know
to show the cross-hair cursor and intercept clicks.

### Persistence + migration

Project files store `tactical-shape` items as plain JSON via the existing
timeline-store serialization path. `PolygonShapeData` is fully JSON-serializable
(no Maps, no Konva refs — those are reconstructed on load). On project open, the
tactical-shapes stage reads the items from the store and instantiates Konva
shapes from the data.

Migration: bump `CURRENT_SCHEMA_VERSION` in `src/shared/projects/migrations/types.ts`;
add a forward migration entry that's a no-op for projects without
`tactical-shape` items. Tactical shapes are inert in pre-MVP project loads
because they didn't exist.

### Export seam (deferred)

`src/features/export/utils/canvas-item-renderer/render-item.ts`: add a
`'tactical-shape'` branch that, in v0, **does nothing visible** and emits a
single warning log (`log.warn` once per export). The export path doesn't crash
on tactical-shape items; they're just absent from the rendered output. A loud
TODO comment in the branch points to the future work: instantiate a headless
Konva stage in the export pipeline, call `update(frame, ctx)` per shape, draw
the layer to the offscreen canvas. We'll do this in a follow-up spec.

## Components / files

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `"konva"` dependency |
| `src/types/timeline.ts` | Modify | Add `'tactical-shape'` to `TimelineItem` union |
| `src/shared/projects/migrations/types.ts` | Modify | Bump `CURRENT_SCHEMA_VERSION` |
| `src/shared/projects/migrations/migrations.ts` | Modify | Add no-op migration for new version |
| `src/features/tactical-shapes/types.ts` | Create | `TacticalShapeItem`, `PolygonShapeData`, `ShapeRenderContext` |
| `src/features/tactical-shapes/shapes/base-tactical-shape.ts` | Create | `BaseTacticalShape extends Konva.Group` + `update()` contract |
| `src/features/tactical-shapes/shapes/polygon-tactical-shape.ts` | Create | The Polygon implementation (Konva.Line + handle group) |
| `src/features/tactical-shapes/components/tactical-shapes-stage.tsx` | Create | Konva Stage/Layer + per-frame tick loop |
| `src/features/tactical-shapes/components/draw-polygon-tool.tsx` | Create | Click-to-add-vertex drawing overlay |
| `src/features/tactical-shapes/stores/draw-tool-store.ts` | Create | Active draw tool + in-flight vertices |
| `src/features/tactical-shapes/stores/actions/create-shape.ts` | Create | `createPolygonShape(points, frame, fps)` |
| `src/features/tactical-shapes/stores/actions/update-shape.ts` | Create | `updateTacticalShapeData(id, patch)` + vertex actions |
| `src/features/tactical-shapes/index.ts` | Create | Public API barrel |
| `src/features/tactical-shapes/deps/*` | Create | Adapter modules per the feature-boundary rules |
| `src/features/preview/components/preview-stage.tsx` | Modify | Mount `<TacticalShapesStage />` as a sibling layer |
| `src/features/editor/components/toolbar.tsx` | Modify | Add the "Polygon" draw button |
| `src/features/editor/components/properties-sidebar/index.tsx` | Modify | Route `tactical-shape` items to new panel |
| `src/features/editor/components/properties-sidebar/tactical-shape-panel/index.tsx` | Create | Properties UI |
| `src/features/export/utils/canvas-item-renderer/render-item.ts` | Modify | Add `'tactical-shape'` no-op branch with TODO + warning |

## Risks

- **Feature-boundary enforcement.** The codebase has a pre-push hook
  (`check:boundaries`) enforcing that cross-feature imports go through `deps/`.
  All `@/features/tactical-shapes/*` imports from outside the feature must be
  routed through `deps/*` adapters. Spec accounts for this; plan must enforce.
- **Konva + the existing render pump.** Mounting a real DOM `<canvas>` inside
  `preview-stage.tsx` interacts with the existing layer stacking and pointer
  events. The Konva canvas's `pointer-events` must default to `none` when no
  draw tool is active and no tactical shape is selected, so clicks pass through
  to existing layers. Implementation must verify this.
- **Coordinate space.** Tactical shapes live in the same coordinate space as
  the preview canvas — project pixels (e.g. 1920×1080). The Konva stage must be
  scaled to match the preview canvas's CSS size, so Konva-internal pixel
  coordinates map to project pixels and stored vertex data is resolution-agnostic.
- **Bundle size.** Konva is ~120 KB minified. Acceptable for a video-editor
  bundle; should be tree-shaken if possible. Plan checks the final bundle delta.
- **Strict TypeScript.** `noUnusedLocals`, `noUncheckedIndexedAccess` —
  every new file must satisfy these.
- **Drawing canvas pointer events vs. existing transform gizmo.** The transform
  gizmo on selected items expects pointer events. Tactical-shape selection +
  edit-mode handles must not conflict — they're a separate layer with different
  selection semantics. Spec keeps them isolated; plan must verify in code.

## Verification

- `npm run build` succeeds.
- `npm run lint` clean.
- `npm run test:run` passes; new tests for the create/update/edit actions pass.
- Manual smoke test via `npm run dev`:
  1. Open a project, click the Polygon toolbar button → cursor switches to
     cross-hair.
  2. Click 5 points on the preview canvas, double-click → polygon appears with
     blue fill and a 5-second timeline-clip placed at the playhead.
  3. Click off the polygon → handles hide; click the polygon → it selects; the
     properties panel shows fill/stroke/width and an "Edit Path" button.
  4. Click "Edit Path" → handles appear; drag a handle → polygon vertex moves;
     Ctrl+Z undoes the move; Ctrl+Y redoes.
  5. Change fill color via the picker → polygon fill updates immediately.
  6. Save the project (Ctrl+S), close, reopen → polygon is still there with all
     its data.
  7. Scrub the timeline before / after the polygon's lifespan → polygon
     appears / disappears at the right frames.
  8. Press Esc during drawing → polygon is cancelled, no item created.
- Export check: export a project containing a tactical polygon → export
  completes, video has no polygon visible (expected), a single console warning
  logged about deferred tactical-shape export.
