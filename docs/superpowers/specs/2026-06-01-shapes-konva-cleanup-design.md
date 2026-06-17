# shapes-konva cleanup + ShapeTransformer system — design

**Date:** 2026-06-01
**Status:** approved (pending spec review)
**Author:** in collaboration with the project owner
**Supersedes:** the earlier draft of this same file dated 2026-06-01.

## Goal

Three-phase rework of the shape editing experience:

1. **Phase 1 — Hide unrelated preview overlays.** Comment out the JSX that
   mounts the transform gizmo, mask editor, corner-pin overlay, edit-mode
   overlays (ripple/rolling/slip/slide), the GPU-effects overlay canvas, and
   the color scopes panel. They become invisible without their code being
   deleted. Reversible by uncommenting.
2. **Phase 2 — Clean up the `shapes-konva/` feature folder.** Relocate
   misfiled hooks, lift `endpoint-handle.tsx` out of `shapes/`, extract a
   shared `ParametricShapeBody`, and split `shapes-stage.tsx` into three
   focused hooks.
3. **Phase 3 — Build a unified `ShapeTransformer` system.** One wrapper
   component that switches per-shape under the hood: Konva's built-in
   `<Transformer>` for parametric shapes; the existing endpoint-handle
   pattern repackaged for arrow and free-polygon. Selection and multi-select
   logic move to the stage level. Click on a shape selects it; click on
   empty stage clears selection; Ctrl-click toggles a shape into/out of a
   multi-selection.

## Non-goals

- **Not adding new shape types** (tactical overlays, badges, callouts, etc.).
  Future spec.
- **Not implementing the deferred types** (star, heart, path). They stay as
  placeholders.
- **Not touching `src/runtime/`**. The composition runtime and player keep
  doing whatever they currently do. Transitions still apply if any exist in
  a project.
- **Not touching `src/infrastructure/`**. GPU pipelines stay intact. Video
  itself still renders the same way (DOM `<Player>` during playback,
  fast-scrub renderer during scrub). Mask combine, GPU effects, GPU
  compositor, GPU scopes, GPU transitions — all left in place; just no UI
  triggers them.
- **Not deleting code.** Phase 1 is comment-outs, not file deletions. We
  can uncomment later if any of these features become relevant again.
- **Not modifying the timeline domain stores, selection store, playback
  store, or other shared state.** All wiring goes through their existing
  public APIs (`selectItems`, `clearItemSelection`, etc.).
- **Not re-wiring `ShapeSection` into the editor's `ClipPanel`.** Properties
  panel for selected shapes stays the way it is (dormant). Separate spec.

## Constraints

- **No commits.** Spec stays on disk; implementation changes accumulate
  uncommitted. The user explicitly does not want commits in this session.
- **Walk-the-user-through-every-change.** Every file edit during
  implementation is narrated in chat first; the added/changed code is
  pasted after the edit so the user can read it without leaving the chat.
- **App must work between phases.** Each phase is its own committable unit
  (we just don't commit). After every phase, `npm run dev` builds and the
  editor still renders.
- **No new dependencies.** Stick with React, Konva, react-konva, Zustand —
  all already in `package.json`.
- **Respect the `deps/` adapter pattern.** Any new cross-feature import
  goes through `deps/`. `check:boundaries` and `check:deps-contracts` must
  keep passing.
- **Save fast-scrub.** The fast-scrub renderer is the only "advanced"
  preview feature explicitly kept. Don't disable it in Phase 1.

## Phase 1 — Hide unrelated preview overlays

Surgical comment-outs in the preview component tree. No logic edits; no
file moves; no deletions.

### Changes

In `src/features/preview/components/video-preview.tsx` (and any sub-files it
mounts), wrap the JSX that mounts each of the following in `{/* … */}`
JSX comments:

- `<GizmoOverlay>` mount(s).
- `<CornerPinContainer>` mount.
- `<MaskEditorContainer>` mount.
- The four edit overlays — `<RollingEditOverlay>`, `<RippleEditOverlay>`,
  `<SlipEditOverlay>`, `<SlideEditOverlay>`.
- The `<canvas ref={gpuEffectsCanvasRef}>` mount, if it appears directly in
  the preview tree (the canvas itself, not the `useGpuEffectsOverlay`
  hook which can stay).
- Color scopes panel mount (in whichever file mounts it inside the editor —
  may be `editor.tsx` or `preview-area.tsx`).

If any of those overlays is mounted from a wrapper component (e.g.
`preview-stage.tsx`) instead of the top-level `video-preview.tsx`, comment
out the mount at its actual location and leave a one-line comment noting
*why* it's commented (so future readers know it's intentional, not stale).

### What we explicitly do NOT touch

- The hooks that drive these overlays (`usePreviewOverlayController`, etc.)
  stay imported. Some return values may go unused; that's fine.
- The Zustand stores (`useGizmoStore`, `useMaskEditorStore`,
  `useCornerPinStore`) stay alive. Other features still mutate them; we
  just don't render their UI consequences in the preview.
- `usePreviewRenderPump`, `useCustomPlayer`, `usePreviewRendererController`,
  `usePreviewSourceWarm`, `usePreviewMediaPreload`, etc. — every render and
  fast-scrub-related hook stays untouched. Video continues to render.
- Runtime composition. Transitions still apply if data has them.

### Verification

- `npm run check`, `npm run test:run` pass.
- `npm run dev` boots. Open a project with a video clip — video plays.
- Select a video clip in the timeline — no gizmo handles appear over it in
  the preview (because we commented out the overlay mount).
- Open a project that uses an effect — the effect is no longer visually
  applied in the preview (the overlay canvas isn't mounted). The effect
  field still exists on the item; we just don't render it.
- `ShapesStage` still mounts; existing arrows / polygons still render.

### Risk

Very low. Each comment-out is two lines (open `{/*` and close `*/}`).
Reversible by uncommenting.

## Phase 2 — `shapes-konva/` cleanup

Folder restructure + de-duplication + file split. No behavior changes
relative to Phase 1's end state.

### Step 2.1 — File relocations

- Create `src/features/shapes-konva/hooks/`.
- Move `src/features/shapes-konva/components/use-draw-arrow-tool.tsx` →
  `src/features/shapes-konva/hooks/use-draw-arrow-tool.tsx`.
- Move `src/features/shapes-konva/components/use-draw-polygon-tool.tsx` →
  `src/features/shapes-konva/hooks/use-draw-polygon-tool.tsx`.
- Move `src/features/shapes-konva/shapes/endpoint-handle.tsx` →
  `src/features/shapes-konva/components/endpoint-handle.tsx`.
- Update import paths in:
  - `components/shapes-stage.tsx` (three imports to fix).
  - `shapes/arrow-shape.tsx` (one import).
  - `shapes/free-polygon-shape.tsx` (one import).

### Step 2.2 — De-duplicate parametric shapes

- Create `src/features/shapes-konva/components/parametric-shape-body.tsx`
  exporting `<ParametricShapeBody>`. Owns the shared `<Group>` wrapper,
  the `resolveParametricPosition` call, `draggable={isSelected}`,
  `onClick`/`onTap` → `callbacks.onSelect`, `onDragEnd` →
  `callbacks.onUpdateData` with the konva-position-to-transform math.
  Renders `{children}` inside the Group.
- Refactor each of the five parametric shape files (`rectangle-shape.tsx`,
  `circle-shape.tsx`, `ellipse-shape.tsx`, `triangle-shape.tsx`,
  `regular-polygon-shape.tsx`) to render only their inner Konva primitive
  inside `<ParametricShapeBody>`. Target: each file shrinks to ~12 lines.
- Arrow and free-polygon are NOT touched in this step; their custom drag
  semantics don't fit `ParametricShapeBody`.

### Step 2.3 — Split `shapes-stage.tsx`

Extract three hooks from `shapes-stage.tsx`:

- **`hooks/use-visible-shapes.ts`** — `useVisibleShapes(items, tracks, currentFrame)` returns the filtered + track-sorted `ShapeItem[]`.
- **`hooks/use-shape-callbacks.ts`** — `useShapeCallbacks()` returns the
  `ShapeCallbacks` bag.
- **`hooks/use-shapes-stage-scale.ts`** —
  `useShapesStageScale(displayWidth, displayHeight, projectWidth, projectHeight)`
  returns `{ scaleX, scaleY }`.

`shapes-stage.tsx` shrinks to ~60 lines: orchestrate the hooks, mount draw
tools, render the Stage + Layer + ShapeRouter map. Behavior identical to
before; Phase 3 is where actual interaction changes land.

### Verification (whole Phase 2)

- `npm run check`, `npm run test:run`, `npm run check:boundaries`,
  `npm run check:deps-contracts` all pass.
- Manual smoke: every shape type still renders, drags, selects. Drag tools
  (arrow + polygon) still draw new shapes.

### Risk

Low. Mechanical refactors.

## Phase 3 — `ShapeTransformer` system

Add a unified transformer wrapper for shapes. The bulk of the new
functionality lives here.

### New components

- **`components/shape-transformer.tsx`** — exports `<ShapeTransformer>`.
  Props: `{ selectedShapes: ShapeItem[]; canvasWidth: number; canvasHeight: number }`.
  Switch on selection size + shape type:
  - 0 shapes → returns `null`.
  - 2+ shapes → renders `<ParametricTransformer items={selectedShapes} />`
    (multi-select always uses the bounding-box variant).
  - 1 shape → switches on `selectedShapes[0].shapeType`:
    - `arrow` → `<ArrowTransformer item={shape} />`
    - `free-polygon` → `<PolygonTransformer item={shape} />`
    - `rectangle | circle | ellipse | triangle | polygon` →
      `<ParametricTransformer items={[shape]} />`
    - anything else → `null` (deferred types).

- **`components/parametric-transformer.tsx`** — exports
  `<ParametricTransformer>`. Props:
  `{ items: ShapeItem[] }`. Wraps Konva's built-in `<Transformer>` from
  `react-konva`. Uses a `useEffect` that:
  1. Reads the stage from a ref (`trRef.current?.getStage()`).
  2. Finds each shape's Konva node by id (`stage.findOne(`#${item.id}`)`).
  3. Attaches them via `trRef.current?.nodes(nodes)`.
  4. Calls `trRef.current?.getLayer()?.batchDraw()`.
  
  Per-shape config:
  - `keepRatio: true` when every selected shape is `circle` (locks aspect).
  - `rotateEnabled: true` always.
  - `anchorSize: 8` (slightly bigger than default for touch-friendliness).
  - On `transformend`: read back each attached node's
    `width / height / rotation / x / y` and dispatch
    `callbacks.onUpdateData(item.id, { transform: { ... }, ... })`.
  
  **Implementation note:** the existing parametric shapes don't currently
  set a Konva `id` attribute matching their `ShapeItem.id`. They must be
  updated (in Phase 2's `ParametricShapeBody`) to do so, otherwise
  `stage.findOne` won't find them.

- **`components/arrow-transformer.tsx`** — exports `<ArrowTransformer>`.
  Renders the two existing `<EndpointHandle>` instances. Moves the
  rendering block out of `arrow-shape.tsx`. Props:
  `{ item: ShapeItem; callbacks: ShapeCallbacks }`.

- **`components/polygon-transformer.tsx`** — exports `<PolygonTransformer>`.
  Renders the N `<EndpointHandle>` instances. Moves the rendering block out
  of `free-polygon-shape.tsx`. Props:
  `{ item: ShapeItem; callbacks: ShapeCallbacks }`.

### Shape component changes

- `arrow-shape.tsx` and `free-polygon-shape.tsx` stop rendering handles.
  They render only the body (`<Arrow>`, `<Line>`) inside a `<Group>` that
  retains `draggable={isSelected}` and the body-drag handler. The `isSelected`
  prop is still passed in so `draggable` toggles on/off correctly.
- Parametric shapes (refactored in Phase 2 to use `ParametricShapeBody`)
  also no longer render any selection handles; the Transformer handles that.

### Selection wiring in `ShapesStage`

- `pointer-events: auto` whenever there is at least one visible shape OR a
  draw tool is active. Drop the previous `selectedItemIds.length > 0` gate.
  This is what fixes the click-to-select bug.
- On the Konva `Stage`'s `onClick`:
  1. Check `e.target === e.target.getStage()` — true when click landed on
     empty Stage background.
  2. If empty space → call `clearItemSelection()` from
     `@/shared/state/selection` (preserves track selection). Don't
     `e.cancelBubble = true`; the click ends here.
  3. If on a shape → the shape's own click handler already ran. Detect
     whether `Ctrl`/`Meta` was held:
     - With Ctrl/Meta → toggle the shape into/out of `selectedItemIds`
       (Cmd-click on Mac, Ctrl-click on Windows).
     - Without → replace `selectedItemIds` with just this shape.
  
  Implementation detail: each shape's `onClick`/`onTap` currently calls
  `callbacks.onSelect(item.id)` which does `selectItems([id])`. That
  unconditionally replaces selection. We need to pass the original Konva
  `KonvaEventObject` (or its `evt.ctrlKey` / `evt.metaKey`) into
  `onSelect`, and `onSelect` itself becomes:
  
  ```ts
  onSelect: (id, event) => {
    const isMulti = event.ctrlKey || event.metaKey
    const current = useSelectionStore.getState().selectedItemIds
    if (isMulti) {
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
      selectItems(next)
    } else {
      selectItems([id])
    }
  },
  ```

- `<ShapeTransformer selectedShapes={...} ... />` mounts at the bottom of
  the `<Layer>` (so the Transformer renders **above** all shapes — it's
  the topmost visual layer of the Stage).

### Verification

Manual test matrix:

| Scenario | Expected |
|---|---|
| Click a rectangle in the preview when nothing is selected | Rectangle becomes selected; bounding box + 8 handles appear |
| Drag a handle | Rectangle resizes; on release, change persists |
| Click empty Stage space | Selection cleared; handles disappear |
| Click an arrow | Arrow selected; 2 endpoint handles appear |
| Drag the arrow head endpoint | Just the head moves; tail stays |
| Click a free-polygon | Polygon selected; N vertex handles appear |
| Drag any vertex | Just that vertex moves; rest stays |
| Ctrl-click rectangle A, then Ctrl-click rectangle B | Both selected; one bounding box wraps both |
| Drag the multi-selection bounding box | Both rectangles resize together |
| Click a video clip (non-shape) in the timeline, then click empty preview | Track selection preserved; item selection cleared |
| Draw a new polygon with the polygon tool | Drawing flow works; new polygon appears when finalized |

Automated:
- `npm run check`, `npm run test:run` pass.
- Update existing test fixtures that asserted "no handles when nothing is
  selected" — the assertion still holds since the Transformer renders
  null when `selectedShapes.length === 0`.

### Risk

Medium. New interaction code. Risks:
- Konva node id lookup (`stage.findOne(#id)`) requires shapes to set
  Konva-side `id` attributes. Phase 2's `ParametricShapeBody` must set
  this for the find to work. Verify in implementation.
- Multi-select math: Konva's Transformer can wrap N nodes, but if the
  nodes have different rotations the bounding box's rotate behavior is
  not always intuitive. Mitigation: only enable `rotateEnabled` in
  multi-select when all nodes have rotation = 0; otherwise lock rotate.
- Body drag vs handle drag race: when `draggable={isSelected}` is set
  on the shape group, dragging on the body still moves the shape. Combined
  with the Transformer's resize handles, two drag targets exist for the
  same shape. Konva sorts this by node ordering; verify the Transformer
  takes precedence for clicks inside its bounding-box anchors.

## Architecture after all phases

```
src/features/shapes-konva/
├── index.ts                                  (unchanged)

├── types.ts                                  (unchanged; may add `event` arg to ShapeCallbacks.onSelect)
│
├── components/
│   ├── shapes-stage.tsx                      ← slimmer; mounts <ShapeTransformer>
│   ├── shape-router.tsx                      (unchanged)
│   ├── endpoint-handle.tsx                   ← moved here in Phase 2
│   ├── parametric-shape-body.tsx             ← NEW (Phase 2)
│   ├── shape-transformer.tsx                 ← NEW (Phase 3)
│   ├── parametric-transformer.tsx            ← NEW (Phase 3)
│   ├── arrow-transformer.tsx                 ← NEW (Phase 3)
│   └── polygon-transformer.tsx               ← NEW (Phase 3)
│
├── hooks/
│   ├── use-draw-arrow-tool.tsx               ← moved here in Phase 2
│   ├── use-draw-polygon-tool.tsx             ← moved here in Phase 2
│   ├── use-visible-shapes.ts                 ← NEW (Phase 2)
│   ├── use-shape-callbacks.ts                ← NEW (Phase 2)
│   └── use-shapes-stage-scale.ts             ← NEW (Phase 2)
│
├── shapes/
│   ├── arrow-shape.tsx                       ← Phase 3: drops handle rendering
│   ├── free-polygon-shape.tsx                ← Phase 3: drops handle rendering
│   ├── rectangle-shape.tsx                   ← Phase 2: uses ParametricShapeBody
│   ├── circle-shape.tsx                      ← Phase 2: ditto
│   ├── ellipse-shape.tsx                     ← Phase 2: ditto
│   ├── triangle-shape.tsx                    ← Phase 2: ditto
│   ├── regular-polygon-shape.tsx             ← Phase 2: ditto
│   └── deferred-shape-placeholder.tsx        (unchanged)
│
├── stores/                                    (unchanged)
├── deps/                                      (unchanged)
└── utils/                                     (unchanged)
```

## Implementation pacing

Each phase ends with a checkpoint where:

1. Every file change has been shown to the user (added code pasted in chat
   right after the edit).
2. `npm run check` and `npm run test:run` pass.
3. The phase's manual verification matrix has been confirmed.
4. No commits are made.

Within Phase 2, the three steps (2.1 → 2.2 → 2.3) get their own mini-
checkpoints so the user can confirm direction before each.

Within Phase 3, the order is:

1. Build `ShapeTransformer` + `ParametricTransformer` + wire them into
   `ShapesStage`. Test single-select on a rectangle.
2. Build `ArrowTransformer` + `PolygonTransformer`. Move handle rendering
   out of the shape components. Test single-select on arrow + polygon.
3. Implement multi-select via Ctrl-click (modify `onSelect` callback).
   Test multi-select scenarios.
4. Apply per-shape Transformer configs (e.g., `keepRatio` for circle).
   Test the matrix.

## Success criteria

- The unrelated overlays (gizmo, mask editor, edit overlays, GPU effects
  canvas, scopes) are not visible in the preview.
- Video playback works. Fast-scrub works.
- The `shapes-konva/` folder matches the diagram in "Architecture after all
  phases."
- Each parametric shape file is ~12 lines (just inner Konva primitive +
  `ParametricShapeBody` wrapper).
- `shapes-stage.tsx` is ~60 lines.
- Click any shape in the preview → that shape selects, its corresponding
  transformer renders.
- Click empty Stage space → item selection clears.
- Ctrl-click toggles a shape into/out of a multi-selection.
- Multi-select renders one Konva `<Transformer>` wrapping the group.
- All boundary checks, type checks, existing tests pass.
- Nothing is committed unless the user explicitly asks.

## Out of scope (for future specs)

- Adding new shape types beyond the existing ten.
- Implementing the deferred types (star, heart, path) as real shapes.
- Re-wiring `ShapeSection` into the active `ClipPanel`.
- Polygon vertex insert/delete (right-click to add/remove a vertex).
- Snap-during-Transformer-drag (snap to canvas center, edges, other
  shapes).
- A "stencil-only" rendering mode that doesn't go through the GPU
  compositor at all (alternative path for low-end devices).
- Re-enabling any of the Phase 1 commented-out features. If we want them
  back, uncomment.
