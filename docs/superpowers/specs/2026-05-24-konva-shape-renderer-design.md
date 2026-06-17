# Unified Konva Shape Renderer — Design

**Date:** 2026-05-24
**Status:** Approved (architectural direction)
**Topic:** Move ALL shape rendering to Konva (via react-konva). Hide the WebGPU SDF shape pipeline (keep in codebase, dormant). Ship the supported parametric shapes through the new renderer + free-form polygon + a new arrow shape + click-to-draw tools for both. This is the foundation every future sport-analysis shape (lightbeam, magnifier, gaze cone, flowing arrow, field overlay, etc.) will build on.

## Summary

Shape items currently render through a WebGPU SDF fragment shader
(`src/infrastructure/gpu-shapes/shape-render-pipeline.ts`). The shader works
for parametric primitives but cannot scale to the breadth of shapes
sport-analysis needs (gradients, video sampling, per-frame state, composition
of primitives, interactive vertex handles). It also forces every interactive
shape into a hybrid — shader for the body, separate overlay for handles,
with sync between them.

This work moves all active shape rendering to a Konva-based React layer
(react-konva), one `<Stage>` + one `<Layer>` on top of the preview composite.
The timeline data model for `shape` items is unchanged. The MVP ships
**6 supported shape variants** through Konva:

- `rectangle`, `circle`, `ellipse`, `triangle`, `polygon` (regular N-gon) — existing parametric types, re-rendered
- `arrow` — NEW parametric shape with click-and-drag-to-draw + draggable endpoints
- `free-polygon` — NEW free-form shape with click-to-add-vertex-draw + draggable vertices

**3 existing shape variants are deferred** (`star`, `heart`, `path`): their
ShapeType union members stay (hide-not-delete), their picker tiles are
commented out, and the Konva router renders nothing for them in this MVP.
Their components ship later when the team confirms they're needed.

The GPU SDF pipeline is **hidden, not deleted** — its render call is gated;
the pipeline file stays in the codebase. Existing parametric shape data
loads unchanged and renders through Konva from now on.

## Goals

- Every `shape` item of a SUPPORTED type renders through one Konva Stage
  above the preview composite.
- The 5 existing supported parametric types (`rectangle`, `circle`,
  `ellipse`, `triangle`, `polygon`) render with no visual regression from
  the GPU SDF version.
- New `shapeType: 'arrow'` ships with: click-and-drag tool, drag endpoints,
  parametric pointer head.
- New `shapeType: 'free-polygon'` ships with: click-to-add-vertex tool,
  drag handles on every vertex, drag body to translate.
- One uniform Z-order rule: shapes sort by track `order` within the Konva
  layer; the Konva layer itself sits above video.
- Each shape is a pure React component of `(item, frame, isSelected, callbacks)`.
  `frame` is a slot for future frame-dependent shapes (animated arrows,
  magnifier, etc.) — unused by everything in this MVP.
- Build green; existing projects load and render correctly.

## Non-Goals (v0)

- **No Konva components for `star`, `heart`, `path`** — deferred. Existing
  items of these types in any project load (data preserved) and render as
  empty placeholders; one-time console warning identifies them. Their
  ShapeType union members stay; the picker tile entries are commented out.
- **No animated / flowing arrows** — the v0 arrow is a static two-point
  arrow. Animated arrows are a future shape variant.
- **No hatch / pattern / gradient fills.**
- **No player tracking / detection-JSON binding** (separate subsystem).
- **No magnifier, lightbeam, gaze cone, flowing arrow, field overlay,
  connected shape graph, curved arrow, perspective-pass-arrow, free-draw,
  timer.** Each is its own follow-up.
- **No export rasterization of Konva shapes** (preview-only; export emits
  a one-time warning and renders without shapes).
- **No animation / `frame`-driven render state** for any shape in this MVP.
  The contract is in place; nothing uses it yet.
- **No removal of the GPU SDF pipeline.** Gated, not deleted.
- **No keyboard shortcut** for the draw tools.

## Decisions

| Question | Decision |
|----------|----------|
| Renderer | Konva via **react-konva** (declarative React components) |
| Library alternative considered | Fabric.js — rejected. Legacy code is Konva, smaller bundle, native layer model |
| Item type | Existing `shape` item type, no new top-level item type |
| New shape variants | `shapeType: 'arrow'` + `shapeType: 'free-polygon'` |
| Deferred shape variants | `star`, `heart`, `path` — union members kept, components not built, picker tiles commented |
| Canvas placement | One Konva `<Stage>` mounted above `scrubCanvasRef` in `preview-stage.tsx` |
| Component model | Each shape is a React component receiving `(item, frame, isSelected, callbacks)` as props. **No `Konva.Group` subclass.** Data lives in the timeline store; component is a pure function of props |
| Animation model | `frame` prop drives any per-frame state. **No `Konva.Animation`.** All shapes in this MVP are static and ignore `frame` |
| Interaction model | **Selection alone.** Click → handles render & body draggable. No "edit mode" / double-click |
| Z-order vs. video | All shapes sit above video & effects (annotations belong on top) |
| Z-order among shapes | **One-to-one with the timeline: a shape's canvas Z exactly mirrors its track order in the timeline panel** — same convention used everywhere else in the app. Lower `order` value = visually higher in the timeline (top of the stack) = rendered later in the Konva layer's children array = drawn on top of the canvas. There is no second Z system; what the user sees in the timeline is what they see on the canvas. |
| Draw tool location | Editor top toolbar — new "Draw" group with two buttons: Polygon + Arrow |
| Existing GPU SDF pipeline | Gated with comment + commented-out original call, **kept in the codebase** |
| Existing projects | Load unchanged; supported types render through Konva; deferred types render placeholder + log once |

## Architecture

### Z-order correspondence (timeline ↔ canvas)

There is exactly one Z-order in this system, and it is the timeline's
track `order` field. Reordering a shape's track in the timeline panel
reorders that shape's draw position on the preview canvas, immediately.

- All shape items are flattened into the children of a single Konva
  `<Layer>`. Konva paints children in document order, so the **last**
  child wins (drawn on top).
- Items are sorted by `track.order` *descending* — the largest `order`
  value (visually at the BOTTOM of the timeline stack) renders FIRST in
  the children array; the smallest `order` value (visually at the TOP of
  the timeline stack) renders LAST and lands on top of the canvas.
- The helper `sortShapesByTrackOrder()` in
  `src/features/shapes-konva/utils/track-order.ts` encapsulates this
  rule. The shapes stage calls it on every render.
- This is the same convention used by the existing GPU/Canvas-2D
  composite pipeline in `render-item.ts`, so behaviour is unchanged from
  the user's perspective — only the renderer changes.

### One Konva canvas hosts every shape

`src/features/shapes-konva/components/shapes-stage.tsx` (new) renders a
single `<Stage>` + `<Layer>` mounted in `preview-stage.tsx`, sized to the
preview canvas, positioned above `scrubCanvasRef`. Its `pointer-events` CSS
defaults to `none` when no shape is selected and no draw tool is active, so
clicks pass through to existing layers. When a shape is selected or a draw
tool is active, the stage takes pointer events.

Layer stacking in `preview-stage.tsx` (bottom → top):

1. Player / DOM `<video>` elements
2. `scrubCanvasRef` (composited video + effects)
3. **`shapesStageRef` — NEW Konva Stage**
4. `gpuEffectsCanvasRef` (live GPU effect editor — unchanged)
5. DOM overlays (transform gizmo, selection box, marquee)

### Shape router

`src/features/shapes-konva/components/shape-router.tsx`:

```tsx
export function ShapeRouter({ item, frame, isSelected, callbacks }: Props) {
  switch (item.shapeType) {
    // Active in this MVP
    case 'rectangle':    return <RectangleShape item={item} {...common} />
    case 'circle':       return <CircleShape item={item} {...common} />
    case 'ellipse':      return <EllipseShape item={item} {...common} />
    case 'triangle':     return <TriangleShape item={item} {...common} />
    case 'polygon':      return <RegularPolygonShape item={item} {...common} />
    case 'arrow':        return <ArrowShape item={item} {...common} />
    case 'free-polygon': return <FreePolygonShape item={item} {...common} />

    // Deferred — render a placeholder + log once. Components shipped later.
    case 'star':
    case 'heart':
    case 'path':
      return <DeferredShapePlaceholder item={item} />

    default: {
      const _exhaustive: never = item.shapeType
      return null
    }
  }
}
```

The Stage iterates visible shape items, sorted by track `order`:

```tsx
<Stage ref={stageRef} width={projectW} height={projectH}>
  <Layer ref={layerRef}>
    {visibleShapes.map(item => (
      <ShapeRouter
        key={item.id}
        item={item}
        frame={currentFrame}
        isSelected={selectedId === item.id}
        callbacks={callbacks}
      />
    ))}
  </Layer>
</Stage>
```

### Shape component contract

```ts
interface ShapeProps {
  item: ShapeItem
  frame: number
  isSelected: boolean
  callbacks: ShapeCallbacks
}
interface ShapeCallbacks {
  onSelect(id: string): void
  onMove(id: string, x: number, y: number): void
  onUpdateData(id: string, patch: Partial<ShapeItem['data']>): void
  onUpdateVertex(id: string, index: number, x: number, y: number): void  // free-polygon & arrow endpoints
}
```

### Arrow shape

New `shapeType: 'arrow'`. Two-point straight arrow with a parametric pointer
head at the "to" end. Built on Konva's `<Arrow>` primitive.

**Data model** — additive fields on `ShapeItem`, nested under a
type-specific key to avoid collision with the existing `ShapeItem.points`
(which is the *count* of sides for the parametric `polygon` N-gon, not an
array):

```ts
// On the existing ShapeItem (additive, optional):
arrowData?: {
  fromX: number; fromY: number    // tail, item-local coordinates
  toX: number;   toY: number      // head
  pointerLength?: number          // default 16
  pointerWidth?: number           // default 16
  dash?: 'solid' | 'dashed' | 'dotted'  // default 'solid'
  // v1 breadcrumb: Bezier control point for curved arrows.
  // undefined in v0 = straight arrow. Reserved here to avoid migration
  // pain when the curved-arrow variant ships.
  controlX?: number
  controlY?: number
}
freePolygonData?: {
  vertices: number[]              // flat [x0, y0, x1, y1, …], item-local
  closed: boolean
}
```

Plan firms up the exact TypeScript discriminated-union shape so each
`shapeType` value carries only its relevant fields.

**Component** (~50 LOC):

```tsx
export function ArrowShape({ item, isSelected, callbacks }: ShapeProps) {
  const { fromX, fromY, toX, toY, pointerLength = 16, pointerWidth = 16 } = arrowDataFrom(item)
  const { fill, stroke, strokeWidth } = item
  return (
    <Group x={item.x} y={item.y} draggable={isSelected}
           onClick={() => callbacks.onSelect(item.id)}
           onDragEnd={(e) => callbacks.onMove(item.id, e.target.x(), e.target.y())}>
      <Arrow
        points={[fromX, fromY, toX, toY]}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
        pointerLength={pointerLength} pointerWidth={pointerWidth}
      />
      {isSelected && (
        <>
          <EndpointHandle x={fromX} y={fromY} onDrag={(x, y) => callbacks.onUpdateVertex(item.id, 0, x, y)} />
          <EndpointHandle x={toX} y={toY} onDrag={(x, y) => callbacks.onUpdateVertex(item.id, 1, x, y)} />
        </>
      )}
    </Group>
  )
}
```

**Draw tool — click-and-drag.** Mousedown anywhere on the preview sets the
tail position; mousemove rubber-bands the head following the cursor; mouseup
commits. Minimum drag distance ~10 px to prevent accidental creation.

### Free-polygon shape

`shapeType: 'free-polygon'`. Data nested under `freePolygonData` (see Data
model note in the Arrow section): `{ vertices: number[], closed: boolean }`.
Component renders Konva `<Line>` + per-vertex `<Circle>` handles when
selected. Draw tool: click-to-add-vertex, double-click / Enter /
closed-loop click finishes, Esc cancels.

### Click-to-draw tools

Two tools, two toolbar buttons in the "Draw" group:

- **Polygon tool** — `lucide-react` `Spline` icon — click-to-add-vertex gesture
- **Arrow tool** — `lucide-react` `MoveUpRight` icon — click-and-drag gesture

The Draw group sits in the editor top toolbar between the project-info
badge and the Save button (high prominence — drawing is a primary action
for the analysis workflow). Active tool is highlighted with the standard
`bg-primary/15 text-primary` treatment already used elsewhere in the
toolbar.

### Default styling on new shapes (broadcast-clean defaults)

When a shape is created from a drawing tool or a sidebar drag, it is
seeded with TV-broadcast-style defaults so it's visible and professional
on any frame without further tweaking:

- **Arrow** (white-stroke broadcast look): `stroke = '#FFFFFF'`,
  `fill = '#FFFFFF'` (arrowhead), `strokeWidth = 3`, `pointerLength = 16`,
  `pointerWidth = 16`, `dash = 'solid'`. Subtle drop shadow rendered by
  Konva: `shadowColor = 'rgba(0,0,0,0.6)'`, `shadowBlur = 4`,
  `shadowOffset = {x: 1, y: 1}`, `shadowOpacity = 0.35` — so arrows read
  cleanly over grass and bright kit colors.
- **Free-polygon** (tactical-zone look): `fill = 'rgba(255,255,255,0.18)'`
  (semi-transparent white), `stroke = '#FFFFFF'`, `strokeWidth = 2`,
  `closed = true`. No drop shadow (avoids muddying the zone fill).
- **Parametric shapes from the Shapes sidebar** (rectangle / circle /
  ellipse / triangle / polygon): same defaults as free-polygon
  (translucent white fill + white 2 px stroke) so new shapes always read
  on top of video.

Defaults are constants in `src/features/shapes-konva/utils/defaults.ts`,
easy to tune. Any user-applied color (via picker or preset row) overrides
the defaults.

Backed by one `draw-tool-store.ts` with state:

```ts
type DrawState =
  | { kind: 'idle' }
  | { kind: 'drawing-arrow'; tail: { x: number; y: number } | null }
  | { kind: 'drawing-polygon'; vertices: number[] }
```

The draw-tool overlay component reads the store, renders the in-flight
shape preview (rubber-band line for arrow, polyline for polygon), intercepts
mouse events on the Konva stage, and commits a new `ShapeItem` via the
timeline-action layer on completion. Esc returns to `idle`.

### Selection + handles (uniform interaction)

- **Click a shape** → selection store id := item.id → component re-renders
  with `isSelected: true` → handles render.
- **Drag a handle** (free-polygon: any vertex; arrow: either endpoint) →
  calls `onUpdateVertex` → timeline action mutates the right field → React
  re-renders.
- **Drag the body** (`Group draggable={isSelected}`) → on `dragEnd` commits
  the position via `onMove`.
- **Click outside any shape** → selection cleared → handles disappear.
- **Delete key** (existing selection system) → removes the shape.

No double-click handler. No "Edit Path" button. No edit-mode state.

### Properties sidebar

`src/features/editor/components/properties-sidebar/clip-panel/shape-section.tsx`
already mutates `ShapeItem` data through timeline actions. Existing branches
for `rectangle / circle / ellipse / triangle / polygon` keep working as-is.

New branches:

- `arrow`: fill / stroke / stroke-width / pointer length / pointer width /
  **dash style** (segmented control: Solid / Dashed / Dotted).
- `free-polygon`: fill / stroke / stroke-width / vertex count (read-only).
- `star / heart / path`: existing UI controls in the section are **commented
  out** (preserving restoration path) with a note. The deferred placeholder
  in the canvas plus the absent controls keeps the user from interacting
  with shapes that don't render.

**Tactical color preset row** sits above the existing fill / stroke color
pickers for ALL active shape types — a strip of 6 swatches a click away:

| Swatch | Color | Tactical meaning |
|---|---|---|
| Red | `#E63946` | Attack / pressing direction |
| Blue | `#1845C8` | Defense / cover |
| Yellow | `#F5A623` | Ball / key moment |
| White | `#FFFFFF` | Neutral / annotation |
| Green | `#2A9D8F` | Open space / positive |
| Orange | `#F4A261` | Pressure / warning |

Clicking a swatch sets fill (semi-transparent for closed shapes) +
stroke (full opacity, same hue) in one action. The unrestricted color
picker stays available below for custom colors. Component reused across
the active shape types; not shown for the deferred placeholder.

All mutations continue to go through `updateShapeData(id, patch)`.

### GPU SDF pipeline — gated

`src/features/export/utils/canvas-item-renderer/render-item.ts` currently
has a `case 'shape':` branch that calls into the GPU shape pipeline or its
Canvas 2D fallback. The branch is rewritten to:

```ts
case 'shape':
  // MatchView strip-down (Konva renderer): shapes are rendered by the
  // Konva stage in the preview overlay (src/features/shapes-konva/), not
  // in the composite canvas. Original GPU-SDF / Canvas-2D rendering is
  // kept here as a commented-out restoration path.
  // renderShape(ctx, effectiveItem as ShapeItem, resolveItemTransform(transform), {
  //   width: rctx.canvasSettings.width,
  //   height: rctx.canvasSettings.height,
  // })
  break
```

The GPU shape pipeline files (`gpu-shapes/shape-render-pipeline.ts`,
`canvas-shapes.ts`) stay in the codebase, untouched. Any non-shape-item
caller (e.g. mask paint path) keeps working.

### Shapes sidebar tab — restored, partially

The earlier strip-down hid the Shapes rail tab in the media sidebar.
Restore it in this MVP since we now own shape rendering. Important: the
restored picker exposes **only the supported types** —
`rectangle / circle / ellipse / triangle / polygon`. The `arrow` and
`free-polygon` are draw tools (toolbar buttons), not drag-from-sidebar
tiles. The `star / heart / pen` tile entries are **commented out** in the
picker JSX (preserving restoration), with a brief note.

The drag-onto-timeline action for parametric shapes (`addShape` or
equivalent) is unchanged. Those items just render through Konva now.

### Existing project compatibility

- Parametric shapes of supported types: data unchanged, renders through
  Konva.
- Existing items of deferred types (`star`, `heart`, `path`): data preserved
  in the project file, render as a `DeferredShapePlaceholder` (a tiny
  semi-transparent gray box at the item's bounds) on the canvas; a console
  warning logs once per project open: `"Deferred shape type X — will render
  when Konva component ships."`
- `path` items from a previously-used mask flow (if any): the mask-paint
  path goes through different rendering, untouched. Only the shape-as-shape
  rendering is deferred.

### Export — deferred no-op

Same as in the previous draft: `case 'shape':` branch in the export-side
`render-item.ts` becomes a no-op + one-time per-export warning. Exported
video contains no shape items in v0.

## Components / files

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `konva` + `react-konva` dependencies |
| `src/types/timeline.ts` | Modify | Add `'arrow'` + `'free-polygon'` to `ShapeType` union; add optional fields for arrow endpoints + polygon points |
| `src/shared/projects/migrations/types.ts` | Modify | Bump `CURRENT_SCHEMA_VERSION` |
| `src/shared/projects/migrations/migrations.ts` | Modify | Add no-op forward migration for new version |
| `src/features/shapes-konva/components/shapes-stage.tsx` | Create | Konva Stage + Layer; pointer-events management |
| `src/features/shapes-konva/components/shape-router.tsx` | Create | Dispatches on `shapeType` |
| `src/features/shapes-konva/components/deferred-shape-placeholder.tsx` | Create | Placeholder for star/heart/path with one-time warning |
| `src/features/shapes-konva/components/draw-arrow-tool.tsx` | Create | Click-and-drag overlay |
| `src/features/shapes-konva/components/draw-polygon-tool.tsx` | Create | Click-to-add-vertex overlay |
| `src/features/shapes-konva/shapes/rectangle-shape.tsx` | Create | react-konva `<Rect>` |
| `src/features/shapes-konva/shapes/circle-shape.tsx` | Create | react-konva `<Circle>` |
| `src/features/shapes-konva/shapes/ellipse-shape.tsx` | Create | react-konva `<Ellipse>` |
| `src/features/shapes-konva/shapes/triangle-shape.tsx` | Create | `<RegularPolygon sides={3}>` |
| `src/features/shapes-konva/shapes/regular-polygon-shape.tsx` | Create | `<RegularPolygon>` parametric N-gon |
| `src/features/shapes-konva/shapes/arrow-shape.tsx` | Create | `<Arrow>` + endpoint handles |
| `src/features/shapes-konva/shapes/free-polygon-shape.tsx` | Create | `<Line>` + per-vertex handles |
| `src/features/shapes-konva/shapes/endpoint-handle.tsx` | Create | Reusable handle for arrow + polygon |
| `src/features/shapes-konva/utils/defaults.ts` | Create | Broadcast-style default styling per shape type |
| `src/features/shapes-konva/components/tactical-color-presets.tsx` | Create | The 6-swatch tactical color row for the properties panel |
| `src/features/shapes-konva/stores/draw-tool-store.ts` | Create | Draw tool state |
| `src/features/shapes-konva/stores/actions/create-arrow.ts` | Create | Creates an arrow `ShapeItem` |
| `src/features/shapes-konva/stores/actions/create-free-polygon.ts` | Create | Creates a free-polygon `ShapeItem` |
| `src/features/shapes-konva/stores/actions/update-vertex.ts` | Create | Mutates a vertex / endpoint |
| `src/features/shapes-konva/types.ts` | Create | `ShapeProps`, `ShapeCallbacks`, `ArrowData`, `FreePolygonData` |
| `src/features/shapes-konva/index.ts` | Create | Public API barrel |
| `src/features/shapes-konva/deps/*` | Create | Adapter modules per feature-boundary rules |
| `src/features/preview/components/preview-stage.tsx` | Modify | Mount `<ShapesStage />` between scrubCanvas and gpuEffectsCanvas |
| `src/features/editor/components/toolbar.tsx` | Modify | Add the "Draw" group with Polygon + Arrow buttons |
| `src/features/editor/components/properties-sidebar/clip-panel/shape-section.tsx` | Modify | Add `arrow` + `free-polygon` branches; comment out `star`/`heart`/`path` control branches with restoration note |
| `src/features/editor/components/media-sidebar.tsx` | Modify | Uncomment / restore the Shapes rail tab; comment out the star/heart/pen tile entries |
| `src/features/export/utils/canvas-item-renderer/render-item.ts` | Modify | Replace `case 'shape':` body with the gated comment block + one-time export warning |
| `src/infrastructure/gpu-shapes/shape-render-pipeline.ts` | Untouched | Stays in codebase, unreached for shape items |
| `src/features/export/utils/canvas-shapes.ts` | Untouched | Stays in codebase, unreached for shape items |

## Risks

- **Visual parity with the SDF pipeline.** Canvas 2D anti-aliasing differs
  subtly from a 1-px-feathered SDF. Plan must include a visual smoke pass
  across the 5 existing supported types (rectangle / circle / ellipse /
  triangle / polygon).
- **Existing items of deferred types** (star/heart/path) render as
  placeholders. Communicate this in a single console warning per project
  open; acceptable since the MatchView workflow doesn't use those types yet.
- **`pointer-events` on the Stage** must default to `none` so the existing
  transform-gizmo overlay continues to work. Plan must verify.
- **Track-order sort cost** — memoize the sort if profiling shows pressure.
- **Bundle size** — `konva` ~120 KB + `react-konva` ~10 KB. Acceptable;
  plan includes a bundle-delta check.
- **Feature-boundary enforcement** (pre-push `check:boundaries` hook).
  Cross-feature imports from `@/features/shapes-konva/*` must go through
  `deps/`. Plan covers this.
- **Strict TypeScript** — every new file satisfies `noUnusedLocals`,
  `noUncheckedIndexedAccess`.

## Verification

- `npm run build` succeeds.
- `npm run lint` clean.
- `npm run test:run` passes; new tests for the create-arrow,
  create-free-polygon, and update-vertex actions pass.
- Manual smoke test (`npm run dev`):
  1. Open a project that already has shapes of supported types → render
     identically to before; mutations via the properties panel work.
  2. Restored Shapes sidebar tab → drag a rectangle/circle/ellipse/
     triangle/regular-polygon → all appear and render correctly through
     Konva.
  3. Click the **Polygon** toolbar button → cursor switches to cross-hair
     on the preview canvas. Click 5 points, double-click → polygon
     appears with default styling at the playhead. The new shape is
     selected; handles visible.
  4. Drag a polygon vertex → moves; Ctrl+Z reverts; Ctrl+Y redoes.
  5. Click the **Arrow** toolbar button → cursor switches to cross-hair.
     Mousedown at point A, drag to point B, mouseup → arrow appears with
     tail at A and head at B; selected with two endpoint handles.
  6. Drag the arrow's head endpoint → head moves; Ctrl+Z reverts.
  7. Drag the body of either shape → translates the whole shape.
  8. Click outside → handles disappear. Click on the shape → handles
     return. Press Delete → shape removed.
  9. Change fill/stroke in the properties panel → updates immediately.
  10. Save (Ctrl+S), close, reopen → all shapes load and render
      correctly (supported types fully; deferred types as placeholders
      with one console warning).
  11. Esc during drawing → cancelled, no item created.
  12. Scrub the timeline before / after each shape's lifespan → shapes
      appear / disappear at the right frames.
- Export check: export a project containing shapes → completes; exported
  video has no shapes visible; a single console warning per export.
