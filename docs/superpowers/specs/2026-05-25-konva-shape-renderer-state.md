# MatchView Shape Renderer — State Recap

**Date:** 2026-05-25
**Status:** Implemented (v0, working in tree, not yet committed)
**Purpose:** Single canonical reference for what's been built in the
shape-rendering pipeline so we can move forward without drifting.
Complementary to the design doc
(`2026-05-24-konva-shape-renderer-design.md`) and execution plan
(`docs/superpowers/plans/2026-05-24-konva-shape-renderer.md`).

---

## What this is

A unified Konva-based shape renderer for MatchView, replacing the
WebGPU SDF shape pipeline as the **active** path. Targets sport-analysis
shapes: polygons, arrows, and (in future iterations) tactical overlays
like magnifiers, lightbeams, gaze cones, flowing arrows, field overlay,
etc. The GPU SDF pipeline is **kept in the codebase, commented out** at
the render call-site — never deleted, easy to flip back on.

## High-level architecture

```
┌─────────────────────────────────────────────┐
│ DOM <video> (Player) + scrubCanvasRef       │  bottom — video & effects
├─────────────────────────────────────────────┤
│ Konva Stage (one for the whole project)     │  middle — ALL shapes
│   └── Layer                                 │
│         ShapeRouter(item) per visible shape │
│         + draw-tool preview (rubber-band)   │
├─────────────────────────────────────────────┤
│ gpuEffectsCanvasRef (live FX edit overlay)  │  top
│ DOM overlays (transform gizmo, marquee)     │
└─────────────────────────────────────────────┘
```

One Konva `<Stage>` with one `<Layer>` is mounted in
`src/features/preview/components/preview-stage.tsx` at zIndex 5,
sitting on top of the composite canvas (`scrubCanvasRef` zIndex 4) and
under the GPU-effects overlay (zIndex 6). The Konva container's
`pointer-events` is **off** unless a draw tool is active or a shape is
selected, so clicks pass through to the existing DOM gizmo / marquee
when not interacting with shapes.

## Z-order rule

There is **one** Z-order in this system, and it is the timeline track
`order` field — same convention as every other timeline item.

- Lowest `order` value = visually highest in the timeline panel = drawn
  on top of the canvas.
- Items sorted descending by `order` before being mapped into Konva
  children (Konva paints children in document order, so the last child
  wins).
- Helper: `src/features/shapes-konva/utils/track-order.ts` →
  `sortShapesByTrackOrder()`.
- All shapes always sit ABOVE the video composite. Shapes do not
  interleave with video clips on a per-track basis (intentional — for
  analysis the annotations belong on top).

## Data model

`src/types/timeline.ts` — `ShapeItem` is unchanged for the legacy
fields. Two additions:

```ts
type ShapeType =
  | 'rectangle' | 'circle' | 'triangle' | 'ellipse'
  | 'star'      | 'polygon' | 'heart'   | 'path'
  | 'arrow'         // NEW
  | 'free-polygon'  // NEW
```

```ts
type ShapeItem = BaseTimelineItem & {
  type: 'shape'
  shapeType: ShapeType
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  cornerRadius?: number       // Rect / Triangle / Star / Polygon (existing)
  direction?: 'up' | 'down' | 'left' | 'right'  // Triangle (existing)
  points?: number             // Star (5) / Polygon (6) sides COUNT — not a vertex array (existing)
  innerRadius?: number        // Star (existing)
  pathVertices?: MaskVertex[] // bezier path (existing, deferred component)

  // MatchView additions:
  arrowData?: {
    fromX: number; fromY: number
    toX: number;   toY: number
    pointerLength?: number; pointerWidth?: number
    dash?: 'solid' | 'dashed' | 'dotted'
    controlX?: number; controlY?: number   // v1 breadcrumb — curved arrow
  }
  freePolygonData?: {
    vertices: number[]   // flat [x0,y0,x1,y1,…], absolute canvas pixels
    closed: boolean
  }

  // …mask fields and others unchanged…
}
```

Schema version bumped from 10 → **11** with a no-op forward migration
(additive change, no existing project data needs reshaping).

### Coordinate convention (v0)

For the two NEW shape types (`arrow`, `free-polygon`) the geometry is
stored in **absolute canvas-pixel coordinates** — i.e. the same
coordinate space as the Konva Stage (`(0,0)` = canvas top-left, full
canvas dimensions = stage dimensions). The item's `transform.x/y`
fields are not used by these shapes; drag-to-move bakes the delta back
into the vertex/endpoint data so geometry stays in one coordinate
space.

The five ported parametric shapes (`rectangle`, `circle`, `ellipse`,
`triangle`, `polygon`) keep FreeCut's existing convention:
`transform.x/y` is offset from canvas CENTER, `transform.width/height`
is the explicit size, `transform.rotation` is degrees. Helper:
`src/features/shapes-konva/utils/parametric-position.ts` converts
between FreeCut transform space and Konva Stage space.

## Rendering — the shape router pattern

`src/features/shapes-konva/components/shape-router.tsx` switches on
`item.shapeType` and renders the right concrete component. The Stage
just iterates visible items and hands each to the router.

Active variants (each is a small react-konva component):

| `shapeType` | Component | Konva primitive |
|-------------|-----------|-----------------|
| `arrow` | `ArrowShape` | `<Arrow>` + two `<EndpointHandle>` when selected |
| `free-polygon` | `FreePolygonShape` | `<Line>` + per-vertex `<EndpointHandle>` when selected |
| `rectangle` | `RectangleShape` | `<Rect>` |
| `circle` | `CircleShape` | `<Circle>` |
| `ellipse` | `EllipseShape` | `<Ellipse>` |
| `triangle` | `TriangleShape` | `<RegularPolygon sides=3>` + direction rotation |
| `polygon` | `RegularPolygonShape` | `<RegularPolygon sides=N>` |

Deferred variants (rendered as a translucent placeholder + one-time
console warning, data preserved in the project file):

- `star`, `heart`, `path` — Konva components will ship in a later spec.

The router dispatches via exhaustive `switch`; adding a future variant
is one new `case` + one new component file.

## The `update(frame, ctx)` contract

Every shape component is a pure React function of `(item, frame,
isSelected, callbacks, canvasWidth, canvasHeight)`. The `frame` prop
is plumbed through to every component but is **unused** by every shape
in v0 — all v0 shapes are static. The prop is in the contract so future
frame-dependent shapes (animated arrows, magnifier, tracking polygons,
gaze cone) slot in as additional `shapeType` values without
re-architecting.

**No `Konva.Animation` anywhere.** When animation arrives, it will be
driven by the `frame` prop (React re-renders the shape on every frame
during playback / scrub).

## Interaction model — selection alone

One interaction concept: **selected ↔ not selected.** There is no
"edit mode," no "double-click to enter handles" pattern from the
legacy codebase.

- **Click a shape** → `selectionStore.selectItems([id])` → component
  re-renders with `isSelected: true` → handles render.
- **Drag a handle** (free-polygon vertex / arrow endpoint) → calls
  `onUpdateVertex` → `updateVertex()` action → `timelineStore.updateItem`.
- **Drag the body** → Konva auto-translates the Group; on `dragEnd` the
  shape's component bakes the delta back into the item data, then
  resets the Group position so the data stays in one coordinate space.
- **Click outside any shape** → selection cleared → handles disappear.
- **Delete key** (existing selection system) → removes the shape.

## Draw tools

Two click-based tools, both wired through one Zustand store
(`useDrawToolStore`):

- **Polygon tool** — click each vertex, finish on:
  - Double-click anywhere
  - `Enter` key
  - Clicking within 8 px of the first vertex (close-loop)
  - `Esc` to cancel
  - Live rubber-band line follows the cursor between clicks
- **Arrow tool** — mousedown sets the tail, drag rubber-bands the head,
  mouseup commits. Minimum 10 px drag distance to avoid accidental
  arrows from misclicks.

Both create a `ShapeItem` via the timeline-store `addItem` action so
undo/redo works. New shape is auto-selected on creation.

## UI surface

**Draw tool buttons** live in the **media sidebar's left rail**
(`src/features/editor/components/media-sidebar.tsx`), under the
collapse/expand header button — the same vertical icon column where
the legacy Media / Text / Shapes / Effects / Transitions / AI tabs
used to live before the strip-down. Two buttons:

- **Polygon** — Hexagon icon (lucide-react).
- **Arrow** — MoveUpRight icon (lucide-react).

Active-tool styling is subtle: `bg-primary/15 text-primary` (soft blue
tint + brand-blue icon), not the bold solid `bg-primary` fill.

The top editor toolbar is **not** touched for shape tools.

## Broadcast-style defaults

`src/features/shapes-konva/utils/defaults.ts` defines TV-broadcast
styling so new shapes are visible and professional on any frame without
further tweaking:

- **Arrow**: white stroke + fill, 3 px stroke, 16×16 pointer, solid
  dash, subtle drop shadow (`shadowBlur: 4, shadowOpacity: 0.35`).
- **Free-polygon**: semi-transparent white fill
  (`rgba(255,255,255,0.18)`), white 2 px stroke, closed.
- **Parametric (Rectangle/Circle/etc.)**: same translucent-white look.

Six tactical preset colors defined for future preset row (red=Attack,
blue=Defense, yellow=Ball, white=Neutral, green=Open space,
orange=Pressure).

`dashToArray()` helper translates `'solid' | 'dashed' | 'dotted'` to
Konva `dash` arrays.

## How the existing pipeline got out of the way

`src/features/export/utils/canvas-item-renderer/render-item.ts` — the
`case 'shape':` branch body is now commented out with the original
`renderShape(...)` call preserved as restoration text. Shape items no
longer paint into the composite canvas through the GPU SDF / Canvas-2D
fallback path. The pipeline files themselves
(`gpu-shapes/shape-render-pipeline.ts`, `canvas-shapes.ts`) are
**completely untouched** — they remain in the codebase, unreached for
shape items but available for mask paint and any other internal caller.

## File map (what shipped)

New, under `src/features/shapes-konva/`:

```
index.ts                                   public barrel
types.ts                                   ShapeProps, ShapeCallbacks, DrawState

deps/
  timeline.ts                              wraps useTimelineStore
  playback.ts                              wraps usePlaybackStore
  selection.ts                             wraps useSelectionStore

utils/
  defaults.ts                              broadcast styling + tactical preset colors + dashToArray
  track-order.ts                           sortShapesByTrackOrder()
  parametric-position.ts                   FreeCut transform ↔ Konva Stage coord conversion

stores/
  draw-tool-store.ts                       Zustand: idle | drawing-arrow | drawing-polygon
  draw-tool-store.test.ts                  8/8 tests passing
  actions/
    create-arrow.ts                        creates an arrow ShapeItem
    create-free-polygon.ts                 creates a free-polygon ShapeItem
    update-vertex.ts                       moves one vertex or endpoint

components/
  shapes-stage.tsx                         the single Konva Stage + Layer
  shape-router.tsx                         dispatch on shapeType
  use-draw-arrow-tool.tsx                  click-and-drag tool hook
  use-draw-polygon-tool.tsx                click-to-add-vertex tool hook

shapes/
  endpoint-handle.tsx                      reusable draggable vertex handle
  deferred-shape-placeholder.tsx           translucent placeholder for star/heart/path
  arrow-shape.tsx                          react-konva <Arrow>
  free-polygon-shape.tsx                   react-konva <Line> + handles
  rectangle-shape.tsx                      react-konva <Rect>
  circle-shape.tsx                         react-konva <Circle>
  ellipse-shape.tsx                        react-konva <Ellipse>
  triangle-shape.tsx                       react-konva <RegularPolygon sides=3>
  regular-polygon-shape.tsx                react-konva <RegularPolygon sides=N>
```

Modified existing files:

| File | Change |
|------|--------|
| `package.json` | Added `konva@^10.3.0` + `react-konva@^19.2.4` |
| `src/types/timeline.ts` | Added `'arrow'`/`'free-polygon'` to `ShapeType`; added `arrowData` + `freePolygonData` optional fields to `ShapeItem` |
| `src/shared/projects/migrations/types.ts` | Bumped `CURRENT_SCHEMA_VERSION` 10 → 11 |
| `src/shared/projects/migrations/migrations.ts` | Added no-op migration entry for v11 |
| `src/features/preview/components/preview-stage.tsx` | Mounted `<ShapesStage />` above `scrubCanvasRef`, below the GPU-effects overlay |
| `src/features/editor/components/media-sidebar.tsx` | Added Polygon + Arrow draw-tool buttons in the left rail |
| `src/features/export/utils/canvas-item-renderer/render-item.ts` | Commented out the `case 'shape':` body |

## What's deferred (and why)

These are explicit non-goals of the v0 ship — none are blocked by it.

| Deferred | Notes |
|----------|-------|
| **Hatch / gradient / pattern fills** | Solid colors only in v0. Needs new shader-free Konva fill paths. |
| **Player tracking / detection-JSON binding** | Needs a `TrackingProvider` subsystem (load `tracking.json`, index by frame, expose `lookup(mediaId, frame).playerById(id)`) — separate spec. |
| **Magnifier, lightbeam, gaze cone, flowing arrow, field overlay, connected shape, curved arrow, perspective-pass-arrow, free-draw, timer** | Each is a future `shapeType` variant + Konva component + (sometimes) a draw tool. |
| **Animated/flowing arrows** | The v0 arrow is static. Animation arrives when the first frame-dependent shape ships, driven by the `frame` prop. |
| **Export rasterization of Konva shapes** | Exported video does not contain shape items in v0. The `case 'shape':` branch in `render-item.ts` is a no-op. Future: instantiate a headless Konva stage in the export pipeline. |
| **Star / heart / path Konva components** | Rendered as deferred placeholders. Data is preserved on load. |
| **Properties sidebar branches for `arrow` + `free-polygon`** | The properties panel does not currently expose fill / stroke / dash / pointer controls for the new shapes. Mutations are programmatic-only in v0. |
| **TacticalColorPresets swatch row** | Defaults (`TACTICAL_PRESET_COLORS`) exist in `defaults.ts`; the swatch component does not. |
| **Restoring the parametric Shapes sidebar tab** | The strip-down removed (not commented) the Shapes tab JSX from `media-sidebar.tsx`. The parametric shape COMPONENTS exist and render correctly when shape items load; there's just no in-UI way to CREATE rectangles/circles/etc. yet. Rebuilding the picker is a separate task. |
| **Curved arrow** | Data model has `controlX/Y` breadcrumb already (so it ships without a migration), but no rendering / draw-gesture for it. |
| **Hotkeys for the draw tools** | Click the icon — no keyboard accelerator yet. |
| **i18n for the new strings** | Tooltips, ARIA labels for draw tools are hardcoded English. Other locales will fall back to English when the labels render in non-English contexts. |

## Behavior notes / known quirks

- The draw-tool buttons appear in the rail *unconditionally* — even
  when no project is loaded. Clicking them with no project changes the
  tool store state but no shape can be created (no compatible track,
  the create action returns null).
- Existing projects with `star`, `heart`, or `path` shape items will
  log a one-time warning per item on first render and show a dashed
  translucent placeholder where the shape would be.
- A 3-vertex minimum is enforced when committing a polygon (Esc
  cancels; double-clicking with < 3 vertices silently cancels).
- Arrow draws shorter than 10 px (start ≈ end) are silently dropped.
- Selected shape stays selected after creation; clicking elsewhere on
  the canvas clears selection.
- Shapes always render ABOVE video. There is no way in v0 to put a
  shape below a video clip; this is intentional for analysis.

## Build / test status

- `npm run build` — green.
- `npm run test:run -- src/features/shapes-konva` — 8/8 (draw-tool
  store).
- No `npm run lint` / full `npm run test:run` pass run yet (T20 in the
  plan).
- No git commits made — all changes uncommitted on the `pitchsense`
  branch.

## Where to look first when extending

- **Adding a new shape variant**:
  1. Add the new `shapeType` value to `ShapeType` in
     `src/types/timeline.ts`.
  2. Add any type-specific data fields to `ShapeItem`
     (`<variant>Data?: { … }`).
  3. Create the component in `src/features/shapes-konva/shapes/`
     using react-konva.
  4. Register the `case` in `shape-router.tsx`.
- **Adding a new draw tool**:
  1. Extend `DrawState` in `types.ts`.
  2. Add the action setters to `draw-tool-store.ts` (+ tests).
  3. Create a `use-draw-<tool>.tsx` hook returning event handlers + a
     preview node.
  4. Add a creation action in `stores/actions/`.
  5. Compose the handlers + preview into `shapes-stage.tsx`.
  6. Add the toolbar button to the media-sidebar rail.
- **Wiring tracking data**: build `TrackingProvider` first; pass it
  through `ShapeRenderContext` (extend `ShapeProps`); each shape that
  needs it calls `ctx.tracking.lookup(mediaId, sourceFrame).playerById(id)`.

## Snapshot at this point in time

What you can do in the running app right now:

- Click the Polygon icon in the left rail → click 4+ points on the
  preview → double-click → polygon appears with translucent-white fill
  and white stroke. Click it → vertex handles appear. Drag a handle
  → vertex moves. Drag the body → translates.
- Click the Arrow icon → click-and-drag on the preview → arrow
  appears with the broadcast drop-shadow. Click it → two endpoint
  handles. Drag either endpoint to reposition.
- Existing projects with parametric shapes (rectangle/circle/ellipse/
  triangle/polygon) load and render through Konva.
- Existing projects with star/heart/path render as deferred placeholders
  (one console warning each).
- Esc cancels an in-progress draw. Reload preserves drawn shapes.
- Export runs successfully but the output video has no shape items
  (one console warning per export, deferred — see spec).
