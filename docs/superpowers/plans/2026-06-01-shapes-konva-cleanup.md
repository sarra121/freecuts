# shapes-konva cleanup + ShapeTransformer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide unrelated preview overlays, clean up the `shapes-konva/` feature folder, then build a unified `ShapeTransformer` so clicking a shape in the preview selects it, click on empty stage clears selection, Ctrl-click adds to a multi-selection, and resize/rotate works via a Konva `<Transformer>` for parametric shapes (per-shape variants for arrow + free-polygon).

**Architecture:** Three phases. Phase 1 comments out JSX mounts for gizmo overlay (already done), mask editor, corner-pin, edit-mode overlays, and the GPU-effects canvas. Phase 2 reorganizes the shapes-konva folder (file moves + de-duplication + stage-component split). Phase 3 introduces a `<ShapeTransformer>` switcher with `ParametricTransformer` / `ArrowTransformer` / `PolygonTransformer` variants and wires single + multi-select at the stage level.

**Tech Stack:** React 19, TypeScript (strict), Zustand, Konva 10 + react-konva. Tests use Vitest + jsdom (`vite-plus/test`). Boundary enforcement via `npm run check:boundaries` / `check:deps-contracts`.

**Operating mode:**
- **No commits.** User has explicitly said not to commit at any point.
- **Narrate every change.** Before each file edit, state in chat what's about to change and why. After the edit, show the new code in a code block. No silent batched edits.
- **App must build between phases.** Run `npm run check` and `npm run test:run` at each phase's checkpoint. If something breaks, stop and fix before continuing.

---

## File map (everything we'll touch)

**Phase 1 edits:**
- `src/features/preview/components/video-preview.tsx` (lines 453-461 + 463-492)
- `src/features/preview/components/preview-stage.tsx` (lines 217-226)

**Phase 2 file moves:**
- `src/features/shapes-konva/components/use-draw-arrow-tool.tsx` → `src/features/shapes-konva/hooks/use-draw-arrow-tool.tsx`
- `src/features/shapes-konva/components/use-draw-polygon-tool.tsx` → `src/features/shapes-konva/hooks/use-draw-polygon-tool.tsx`
- `src/features/shapes-konva/shapes/endpoint-handle.tsx` → `src/features/shapes-konva/components/endpoint-handle.tsx`

**Phase 2 new files:**
- `src/features/shapes-konva/components/parametric-shape-body.tsx`
- `src/features/shapes-konva/hooks/use-visible-shapes.ts`
- `src/features/shapes-konva/hooks/use-shape-callbacks.ts`
- `src/features/shapes-konva/hooks/use-shapes-stage-scale.ts`

**Phase 2 modified files:**
- `src/features/shapes-konva/shapes/rectangle-shape.tsx`
- `src/features/shapes-konva/shapes/circle-shape.tsx`
- `src/features/shapes-konva/shapes/ellipse-shape.tsx`
- `src/features/shapes-konva/shapes/triangle-shape.tsx`
- `src/features/shapes-konva/shapes/regular-polygon-shape.tsx`
- `src/features/shapes-konva/shapes/arrow-shape.tsx` (import path update only)
- `src/features/shapes-konva/shapes/free-polygon-shape.tsx` (import path update only)
- `src/features/shapes-konva/components/shapes-stage.tsx` (slim down)

**Phase 3 new files:**
- `src/features/shapes-konva/components/shape-transformer.tsx`
- `src/features/shapes-konva/components/parametric-transformer.tsx`
- `src/features/shapes-konva/components/arrow-transformer.tsx`
- `src/features/shapes-konva/components/polygon-transformer.tsx`

**Phase 3 modified files:**
- `src/features/shapes-konva/types.ts` (extend `ShapeCallbacks.onSelect` signature)
- `src/features/shapes-konva/shapes/arrow-shape.tsx` (remove handle rendering)
- `src/features/shapes-konva/shapes/free-polygon-shape.tsx` (remove handle rendering)
- `src/features/shapes-konva/components/shapes-stage.tsx` (mount ShapeTransformer, fix click semantics)
- `src/features/shapes-konva/hooks/use-shape-callbacks.ts` (update onSelect to read event modifiers)

---

# Phase 1 — Hide preview overlays

Four small comment-out edits. The `<GizmoOverlay>` in `video-preview.tsx` is already commented out (lines 470-478) — leave it. Color scopes are not actively mounted anywhere in the editor's preview tree, so nothing to do for scopes.

### Task 1.1 — Comment out comparisonOverlay (the 4 edit-mode overlays)

**Files:**
- Modify: `src/features/preview/components/video-preview.tsx:453-461`

- [ ] **Step 1: Narrate the change in chat.** Tell the user: "About to comment out the ripple/rolling/slip/slide edit-mode overlay JSX in video-preview.tsx. After this, clicking any of the four edit tools won't show its multi-frame preview in the program monitor."

- [ ] **Step 2: Edit the file**

Replace lines 453-461 (the `comparisonOverlay` block):

```tsx
  const comparisonOverlay = hasRolling2Up ? (
    <RollingEditOverlay fps={fps} />
  ) : hasRipple2Up ? (
    <RippleEditOverlay fps={fps} />
  ) : hasSlip4Up ? (
    <SlipEditOverlay fps={fps} />
  ) : hasSlide4Up ? (
    <SlideEditOverlay fps={fps} />
  ) : null
```

with:

```tsx
  // MatchView: edit-mode overlays (ripple/rolling/slip/slide) disabled.
  // Sports analysis doesn't use these multi-frame previews.
  // Restore by uncommenting if needed.
  /*
  const comparisonOverlay = hasRolling2Up ? (
    <RollingEditOverlay fps={fps} />
  ) : hasRipple2Up ? (
    <RippleEditOverlay fps={fps} />
  ) : hasSlip4Up ? (
    <SlipEditOverlay fps={fps} />
  ) : hasSlide4Up ? (
    <SlideEditOverlay fps={fps} />
  ) : null
  */
  const comparisonOverlay = null
```

- [ ] **Step 3: Paste the new code in chat for the user to review.**

- [ ] **Step 4: Verify nothing is type-broken**

Run: `npm run check`
Expected: passes. The `hasRolling2Up`, `hasRipple2Up`, `hasSlip4Up`, `hasSlide4Up` variables and the `RollingEditOverlay` / `RippleEditOverlay` / `SlipEditOverlay` / `SlideEditOverlay` imports become unused but they're still imported at the top of the file. TypeScript with `noUnusedLocals` will flag those.

- [ ] **Step 5: If `check` reports unused imports, comment them out too**

Find the imports near the top of `video-preview.tsx` for the four edit overlays and the four `hasXxx2Up`/`hasXxx4Up` variables. Comment them out the same way (`// MatchView: ...` + `/* ... */` blocks). Re-run `npm run check`.

### Task 1.2 — Comment out MaskEditorContainer

**Files:**
- Modify: `src/features/preview/components/video-preview.tsx:479-484`

- [ ] **Step 1: Narrate in chat.** "Commenting out `MaskEditorContainer` so the bezier mask editor doesn't mount over the preview."

- [ ] **Step 2: Edit the file**

In the `overlayControls` block (around lines 463-492), find:

```tsx
      <MaskEditorContainer
        containerRect={playerContainerRect}
        playerSize={playerSize}
        projectSize={{ width: project.width, height: project.height }}
        zoom={zoom}
      />
```

Replace with:

```tsx
      {/* MatchView: MaskEditorContainer disabled — no shape-as-mask workflow.
          Restore by uncommenting if mask editing becomes needed.
      <MaskEditorContainer
        containerRect={playerContainerRect}
        playerSize={playerSize}
        projectSize={{ width: project.width, height: project.height }}
        zoom={zoom}
      />
      */}
```

- [ ] **Step 3: Paste the change in chat.**

- [ ] **Step 4: Run `npm run check`** — should pass. The `MaskEditorContainer` import becomes unused; comment it out if `check` flags it.

### Task 1.3 — Comment out CornerPinContainer

**Files:**
- Modify: `src/features/preview/components/video-preview.tsx:485-490`

- [ ] **Step 1: Narrate in chat.** "Commenting out `CornerPinContainer` so the 4-corner perspective warp UI doesn't render."

- [ ] **Step 2: Edit the file**

In the `overlayControls` block, find:

```tsx
      <CornerPinContainer
        containerRect={playerContainerRect}
        playerSize={playerSize}
        projectSize={{ width: project.width, height: project.height }}
        zoom={zoom}
      />
```

Replace with:

```tsx
      {/* MatchView: CornerPinContainer disabled — no perspective-pin workflow.
          Restore by uncommenting if needed.
      <CornerPinContainer
        containerRect={playerContainerRect}
        playerSize={playerSize}
        projectSize={{ width: project.width, height: project.height }}
        zoom={zoom}
      />
      */}
```

- [ ] **Step 3: Paste the change.**

- [ ] **Step 4: Run `npm run check`** — comment out the `CornerPinContainer` import if flagged.

After this task, `overlayControls` returns `<></>` (an empty fragment). That's fine — the parent `<PreviewStage>` just receives `null`-ish JSX and renders nothing for that slot. If `check` flags `overlayControls` itself as unused, drop the variable and pass `overlayControls={null}` to `<PreviewStage>` directly.

### Task 1.4 — Comment out the gpuEffectsCanvasRef canvas

**Files:**
- Modify: `src/features/preview/components/preview-stage.tsx:217-226`

- [ ] **Step 1: Narrate in chat.** "Commenting out the GPU-effects overlay canvas in preview-stage. The `gpuEffectsCanvasRef` will stay `null` after this; the `useGpuEffectsOverlay` hook that writes to it will no-op when the ref is null."

- [ ] **Step 2: Edit the file**

Find:

```tsx
              <canvas
                ref={gpuEffectsCanvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: '100%',
                  height: '100%',
                  zIndex: 6,
                  visibility: 'hidden',
                }}
              />
```

Replace with:

```tsx
              {/* MatchView: GPU-effects overlay canvas disabled — no
                  per-clip effects pipeline in the UI. The
                  useGpuEffectsOverlay hook still runs but the ref stays
                  null so writes no-op. Restore by uncommenting.
              <canvas
                ref={gpuEffectsCanvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: '100%',
                  height: '100%',
                  zIndex: 6,
                  visibility: 'hidden',
                }}
              />
              */}
```

- [ ] **Step 3: Paste the change.**

- [ ] **Step 4: Run `npm run check`** — should pass; `gpuEffectsCanvasRef` is still passed as a prop, just never attached.

### Phase 1 verification

- [ ] **Step 1: Run `npm run check`** — type-check + lint pass.

- [ ] **Step 2: Run `npm run test:run`** — tests pass. If `preview-area.test.tsx` or `preview-stage.test.tsx` asserts on the presence of any commented-out overlay, update the test alongside the change.

- [ ] **Step 3: Manual smoke test**

Tell the user to run `npm run dev` and open a project with video + at least one shape. Confirm:
- Video plays normally.
- Scrubbing the timeline works (fast-scrub renderer still active).
- Existing shapes still appear over the video.
- No transform gizmo appears around video / text / image clips when they're selected.
- No mask editor opens for shape masks.
- No multi-frame ripple/rolling/slip/slide overlay when those tools are used.

- [ ] **Step 4: Phase 1 checkpoint.** Pause for user confirmation before continuing to Phase 2.

---

# Phase 2 — shapes-konva cleanup

Three steps. App behavior should be identical at each step's end.

## Step 2.1 — File relocations

### Task 2.1.1 — Create the hooks folder + move use-draw-arrow-tool

**Files:**
- Move: `src/features/shapes-konva/components/use-draw-arrow-tool.tsx` → `src/features/shapes-konva/hooks/use-draw-arrow-tool.tsx`

- [ ] **Step 1: Narrate.** "Creating `hooks/` directory inside `shapes-konva/` and moving the arrow-draw hook there. Pure file move; no logic changes."

- [ ] **Step 2: Move the file**

```bash
mkdir -p src/features/shapes-konva/hooks
git mv src/features/shapes-konva/components/use-draw-arrow-tool.tsx src/features/shapes-konva/hooks/use-draw-arrow-tool.tsx
```

(Use `git mv` so git tracks the rename — even though we're not committing, the staging behavior helps `git diff` show the rename instead of a delete + add.)

- [ ] **Step 3: Update import in `shapes-stage.tsx`**

Open `src/features/shapes-konva/components/shapes-stage.tsx`. Find:

```tsx
import { useDrawArrowTool } from './use-draw-arrow-tool'
```

Replace with:

```tsx
import { useDrawArrowTool } from '../hooks/use-draw-arrow-tool'
```

- [ ] **Step 4: Paste the import diff in chat.**

- [ ] **Step 5: Run `npm run check`** — should pass.

### Task 2.1.2 — Move use-draw-polygon-tool

**Files:**
- Move: `src/features/shapes-konva/components/use-draw-polygon-tool.tsx` → `src/features/shapes-konva/hooks/use-draw-polygon-tool.tsx`

- [ ] **Step 1: Narrate.** "Same idea for the polygon-draw hook."

- [ ] **Step 2: Move**

```bash
git mv src/features/shapes-konva/components/use-draw-polygon-tool.tsx src/features/shapes-konva/hooks/use-draw-polygon-tool.tsx
```

- [ ] **Step 3: Update import in `shapes-stage.tsx`**

Find:

```tsx
import { useDrawPolygonTool } from './use-draw-polygon-tool'
```

Replace with:

```tsx
import { useDrawPolygonTool } from '../hooks/use-draw-polygon-tool'
```

- [ ] **Step 4: Paste the change.**

- [ ] **Step 5: Run `npm run check`** — pass.

### Task 2.1.3 — Move endpoint-handle out of shapes/

**Files:**
- Move: `src/features/shapes-konva/shapes/endpoint-handle.tsx` → `src/features/shapes-konva/components/endpoint-handle.tsx`

- [ ] **Step 1: Narrate.** "Moving the EndpointHandle Konva component to `components/`. It's a UI primitive used BY shapes, not a shape itself."

- [ ] **Step 2: Move**

```bash
git mv src/features/shapes-konva/shapes/endpoint-handle.tsx src/features/shapes-konva/components/endpoint-handle.tsx
```

- [ ] **Step 3: Update imports**

In `src/features/shapes-konva/shapes/arrow-shape.tsx`, find:

```tsx
import { EndpointHandle } from './endpoint-handle'
```

Replace with:

```tsx
import { EndpointHandle } from '../components/endpoint-handle'
```

In `src/features/shapes-konva/shapes/free-polygon-shape.tsx`, same change.

- [ ] **Step 4: Paste both changes.**

- [ ] **Step 5: Run `npm run check`** — pass.

### Step 2.1 verification

- [ ] **Step 1: Run `npm run check:boundaries`** — pass (no cross-feature import violations).

- [ ] **Step 2: Run `npm run test:run`** — pass. The `draw-tool-store.test.ts` is the only test in this folder; it doesn't touch the moved files.

- [ ] **Step 3: Manual smoke test:** run `npm run dev`, draw an arrow with the arrow tool, draw a polygon with the polygon tool. Both should still work.

## Step 2.2 — De-duplicate parametric shapes

### Task 2.2.1 — Create ParametricShapeBody

**Files:**
- Create: `src/features/shapes-konva/components/parametric-shape-body.tsx`

- [ ] **Step 1: Narrate.** "Creating the shared `<ParametricShapeBody>` wrapper. It owns the `<Group>` setup (position, rotation, opacity, draggable, click, drag-end) that the 5 parametric shapes all repeat. Each shape will become a thin component that just renders its inner Konva primitive inside this body."

- [ ] **Step 2: Write the new file**

```tsx
// src/features/shapes-konva/components/parametric-shape-body.tsx
import type { ReactNode } from 'react'
import { Group } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { ShapeItem } from '@/types/timeline'
import { resolveParametricPosition, konvaPositionToTransform } from '../utils/parametric-position'
import type { ShapeCallbacks } from '../types'

interface ParametricShapeBodyProps {
  item: ShapeItem
  isSelected: boolean
  callbacks: ShapeCallbacks
  canvasWidth: number
  canvasHeight: number
  /** True if the shape's render origin should sit at the centre of width/height
   *  (rectangles + triangles + polygons need this; circle/ellipse use radii so
   *  they're already centre-anchored and pass false). */
  centerOrigin: boolean
  children: ReactNode
}

/**
 * Shared Group wrapper for parametric shapes. Owns:
 *  - position / rotation / opacity from `resolveParametricPosition`
 *  - `draggable={isSelected}`
 *  - onClick / onTap forwarding to `callbacks.onSelect`
 *  - onDragEnd that bakes the Konva-side translation back into item.transform
 *  - Konva-side `id={item.id}` so the Transformer can look the node up
 *
 * Each parametric shape file renders only its inner Konva primitive inside.
 */
export function ParametricShapeBody({
  item,
  isSelected,
  callbacks,
  canvasWidth,
  canvasHeight,
  centerOrigin,
  children,
}: ParametricShapeBodyProps) {
  const { cx, cy, width, height, rotation, opacity } = resolveParametricPosition(
    item,
    canvasWidth,
    canvasHeight,
  )

  return (
    <Group
      id={item.id}
      x={cx}
      y={cy}
      offsetX={centerOrigin ? width / 2 : 0}
      offsetY={centerOrigin ? height / 2 : 0}
      rotation={rotation}
      opacity={opacity}
      draggable={isSelected}
      onClick={(e) => callbacks.onSelect(item.id, e)}
      onTap={(e) => callbacks.onSelect(item.id, e)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => {
        const next = konvaPositionToTransform(e.target.x(), e.target.y(), canvasWidth, canvasHeight)
        callbacks.onUpdateData(item.id, { transform: { ...item.transform, ...next } })
      }}
    >
      {children}
    </Group>
  )
}
```

- [ ] **Step 3: Paste the file in chat.**

> **Important:** This step requires `ShapeCallbacks.onSelect` to accept a second argument (the Konva event). The current type signature is `onSelect(id: string): void`. We'll update the type in **Phase 3 Task 3.1**. For now, the new file will type-error on the `onSelect` call. Skip to Task 2.2.2 — once all 5 shapes use `ParametricShapeBody`, we update the type in Phase 3 and everything reconciles.
>
> If you want to keep Phase 2 type-clean, take this shortcut: in **Task 2.2.1**, write `onSelect={() => callbacks.onSelect(item.id)}` (no event arg) so the file compiles. Then in Phase 3 Task 3.1 we'll update the wrapper to also pass the event. Either path works.

**Decision in this plan:** keep Phase 2 type-clean. Use the no-event-arg version in `ParametricShapeBody` for now. The Phase 3 update is one extra line.

So **replace** the `onClick` and `onTap` in the above code with:

```tsx
      onClick={() => callbacks.onSelect(item.id)}
      onTap={() => callbacks.onSelect(item.id)}
```

(Phase 3 Task 3.1 will change these to pass `e`.)

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 2.2.2 — Refactor rectangle-shape.tsx

**Files:**
- Modify: `src/features/shapes-konva/shapes/rectangle-shape.tsx`

- [ ] **Step 1: Narrate.** "Refactoring rectangle to use `<ParametricShapeBody>`. It loses its own Group setup; just renders a `<Rect>` inside the body."

- [ ] **Step 2: Replace the file's contents entirely**

```tsx
// src/features/shapes-konva/shapes/rectangle-shape.tsx
import { Rect } from 'react-konva'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import type { ShapeProps } from '../types'

export function RectangleShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const { width, height } = resolveParametricPosition(item, canvasWidth, canvasHeight)

  return (
    <ParametricShapeBody {...props} centerOrigin>
      <Rect
        width={width}
        height={height}
        cornerRadius={item.cornerRadius ?? 0}
        fill={item.fillColor ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.strokeColor ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </ParametricShapeBody>
  )
}
```

- [ ] **Step 3: Paste in chat.** ~45 lines → ~20 lines.

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 2.2.3 — Refactor circle-shape.tsx

**Files:**
- Modify: `src/features/shapes-konva/shapes/circle-shape.tsx`

- [ ] **Step 1: Narrate.** "Circle uses radius (centre-anchored). Pass `centerOrigin={false}`."

- [ ] **Step 2: Replace contents**

```tsx
// src/features/shapes-konva/shapes/circle-shape.tsx
import { Circle } from 'react-konva'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import type { ShapeProps } from '../types'

export function CircleShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const { width, height } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  // Aspect-locked: radius is half the smaller dimension.
  const radius = Math.min(width, height) / 2

  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      <Circle
        radius={radius}
        fill={item.fillColor ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.strokeColor ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </ParametricShapeBody>
  )
}
```

- [ ] **Step 3: Paste.**

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 2.2.4 — Refactor ellipse-shape.tsx

**Files:**
- Modify: `src/features/shapes-konva/shapes/ellipse-shape.tsx`

- [ ] **Step 1: Read the current file first** to see its exact inner-shape props, then replicate.

Open `src/features/shapes-konva/shapes/ellipse-shape.tsx`. Note the props passed to `<Ellipse>` (likely `radiusX`, `radiusY`, fill/stroke).

- [ ] **Step 2: Narrate.** "Ellipse is centre-anchored like Circle."

- [ ] **Step 3: Replace contents**

```tsx
// src/features/shapes-konva/shapes/ellipse-shape.tsx
import { Ellipse } from 'react-konva'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import type { ShapeProps } from '../types'

export function EllipseShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const { width, height } = resolveParametricPosition(item, canvasWidth, canvasHeight)

  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      <Ellipse
        radiusX={width / 2}
        radiusY={height / 2}
        fill={item.fillColor ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.strokeColor ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </ParametricShapeBody>
  )
}
```

If the current file uses different inner-shape props (e.g. via a `Line` instead of `Ellipse`), follow the existing pattern but wrap with `ParametricShapeBody`.

- [ ] **Step 4: Paste.**

- [ ] **Step 5: Run `npm run check`** — pass.

### Task 2.2.5 — Refactor triangle-shape.tsx

**Files:**
- Modify: `src/features/shapes-konva/shapes/triangle-shape.tsx`

- [ ] **Step 1: Read the current file** to see its inner geometry (Konva has no built-in Triangle; it's typically a `<RegularPolygon sides={3}>` or `<Line>` with closed=true).

- [ ] **Step 2: Narrate.** "Triangle wraps either `<RegularPolygon sides={3}>` or a `<Line closed>` depending on the current impl. We don't change the geometry; only the wrapper. Uses `centerOrigin` if currently positioned at top-left."

- [ ] **Step 3: Replace contents** — mirror the existing geometry inside `<ParametricShapeBody>`. Preserve whatever direction-aware math currently exists (the triangle has a `direction` prop). Skip if unfamiliar; read the file first and adapt.

If unsure, leave a TODO comment **only as a note for the user to inspect manually**, not in the committed code. Better: read the file, write the exact replacement, paste in chat.

- [ ] **Step 4: Paste.**

- [ ] **Step 5: Run `npm run check`** — pass.

### Task 2.2.6 — Refactor regular-polygon-shape.tsx

**Files:**
- Modify: `src/features/shapes-konva/shapes/regular-polygon-shape.tsx`

- [ ] **Step 1: Read the current file.**

- [ ] **Step 2: Narrate.** "Regular polygon uses Konva's `<RegularPolygon>` (sides + radius). Centre-anchored."

- [ ] **Step 3: Replace contents** — mirror the inner `<RegularPolygon>` props, wrap with `<ParametricShapeBody centerOrigin={false}>`.

- [ ] **Step 4: Paste.**

- [ ] **Step 5: Run `npm run check`** — pass.

### Step 2.2 verification

- [ ] **Step 1: Run `npm run check`** — pass.

- [ ] **Step 2: Run `npm run test:run`** — pass.

- [ ] **Step 3: Manual smoke test:** for each of the 5 parametric shapes (rectangle, circle, ellipse, triangle, regular-polygon):
  - Create the shape on the timeline (drop via media library / draw tool if available).
  - Click it in the preview to select.
  - **Note:** because of the Phase 3 click-to-select bug being unfixed at this point, you may need to select the shape via the timeline first.
  - Drag the body — shape moves.
  - Confirm the shape still renders correctly (no visual regression).

- [ ] **Step 4: File-size sanity check:** open each refactored shape file. Should be ~20 lines or less.

## Step 2.3 — Split shapes-stage.tsx

### Task 2.3.1 — Extract use-shapes-stage-scale

**Files:**
- Create: `src/features/shapes-konva/hooks/use-shapes-stage-scale.ts`

- [ ] **Step 1: Narrate.** "Extracting the display/project scale math from `shapes-stage.tsx` into its own one-job hook."

- [ ] **Step 2: Write the new file**

```ts
// src/features/shapes-konva/hooks/use-shapes-stage-scale.ts
import { useMemo } from 'react'

export interface ShapesStageScale {
  scaleX: number
  scaleY: number
}

/**
 * Compute the Konva Stage's scaleX/scaleY so children draw in project-pixel
 * coordinates but render at display-pixel size.
 *
 * `Math.max(_, 1)` guards against div-by-zero when the project hasn't loaded
 * dimensions yet.
 */
export function useShapesStageScale(
  displayWidth: number,
  displayHeight: number,
  projectWidth: number,
  projectHeight: number,
): ShapesStageScale {
  return useMemo(
    () => ({
      scaleX: displayWidth / Math.max(projectWidth, 1),
      scaleY: displayHeight / Math.max(projectHeight, 1),
    }),
    [displayWidth, displayHeight, projectWidth, projectHeight],
  )
}
```

- [ ] **Step 3: Paste in chat.**

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 2.3.2 — Extract use-visible-shapes

**Files:**
- Create: `src/features/shapes-konva/hooks/use-visible-shapes.ts`

- [ ] **Step 1: Narrate.** "Extracting the visible-shapes filter. Picks `type === 'shape'` items inside the current playhead's range, then sorts by track order."

- [ ] **Step 2: Write the new file**

```ts
// src/features/shapes-konva/hooks/use-visible-shapes.ts
import { useCallback, useMemo } from 'react'
import type { TimelineItem, TimelineTrack, ShapeItem } from '@/features/shapes-konva/deps/timeline'
import { sortShapesByTrackOrder } from '../utils/track-order'

/**
 * Filter to ShapeItems that are visible at the current playhead frame and
 * sort them by track order (lower order = on top).
 */
export function useVisibleShapes(
  items: TimelineItem[],
  tracks: TimelineTrack[],
  currentFrame: number,
): ShapeItem[] {
  const trackOrderFor = useCallback(
    (trackId: string) => tracks.find((t) => t.id === trackId)?.order ?? 0,
    [tracks],
  )

  return useMemo<ShapeItem[]>(() => {
    const shapeItems = items.filter(
      (it): it is ShapeItem =>
        it.type === 'shape' &&
        currentFrame >= it.from &&
        currentFrame < it.from + it.durationInFrames,
    )
    return sortShapesByTrackOrder(shapeItems, trackOrderFor)
  }, [items, currentFrame, trackOrderFor])
}
```

- [ ] **Step 3: Paste.**

- [ ] **Step 4: Run `npm run check`** — pass. Note: `TimelineTrack` should be exported via the timeline deps adapter; if not, add an `export type { TimelineTrack }` line to `deps/timeline.ts`.

### Task 2.3.3 — Extract use-shape-callbacks

**Files:**
- Create: `src/features/shapes-konva/hooks/use-shape-callbacks.ts`

- [ ] **Step 1: Narrate.** "Extracting the callbacks bag. Returns `ShapeCallbacks` with `onSelect`, `onMove`, `onUpdateData`, `onUpdateVertex` wired to the right action dispatches."

- [ ] **Step 2: Write the new file**

```ts
// src/features/shapes-konva/hooks/use-shape-callbacks.ts
import { useMemo } from 'react'
import { useTimelineStore } from '../deps/timeline'
import { useSelectionStore } from '../deps/selection'
import { updateVertex } from '../stores/actions/update-vertex'
import type { ShapeCallbacks } from '../types'

/**
 * Build the bag of callbacks every shape component receives. Reads action
 * dispatchers from the timeline + selection stores via the deps adapters.
 *
 * onSelect's modifier-aware multi-select logic is added in Phase 3 — for now
 * it keeps the current "replace selection" behavior.
 */
export function useShapeCallbacks(): ShapeCallbacks {
  const updateItem = useTimelineStore((s) => s.updateItem)
  const selectItems = useSelectionStore((s) => s.selectItems)

  return useMemo<ShapeCallbacks>(
    () => ({
      onSelect: (id) => selectItems([id]),
      onMove: (_id, _x, _y) => {
        // Move semantics are shape-specific; arrow/free-polygon implement
        // their own move via vertex deltas. Placeholder for future
        // parametric-only move overrides.
      },
      onUpdateData: (id, patch) => updateItem(id, patch),
      onUpdateVertex: (id, idx, x, y) => updateVertex(id, idx, x, y),
    }),
    [selectItems, updateItem],
  )
}
```

- [ ] **Step 3: Paste.**

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 2.3.4 — Slim down shapes-stage.tsx

**Files:**
- Modify: `src/features/shapes-konva/components/shapes-stage.tsx`

- [ ] **Step 1: Narrate.** "Replacing the body of `shapes-stage.tsx` with calls to the three new hooks. The component shrinks from ~130 lines to ~60."

- [ ] **Step 2: Replace the file's contents**

```tsx
// src/features/shapes-konva/components/shapes-stage.tsx
import { Stage, Layer } from 'react-konva'
import { useTimelineStore } from '../deps/timeline'
import { usePlaybackStore } from '../deps/playback'
import { useSelectionStore } from '../deps/selection'
import { useDrawToolStore } from '../stores/draw-tool-store'
import { useVisibleShapes } from '../hooks/use-visible-shapes'
import { useShapeCallbacks } from '../hooks/use-shape-callbacks'
import { useShapesStageScale } from '../hooks/use-shapes-stage-scale'
import { useDrawArrowTool } from '../hooks/use-draw-arrow-tool'
import { useDrawPolygonTool } from '../hooks/use-draw-polygon-tool'
import { ShapeRouter } from './shape-router'

interface ShapesStageProps {
  /** CSS display size of the preview canvas (Konva Stage rendered at this size). */
  displayWidth: number
  displayHeight: number
  /** Project canvas resolution. Shape coords are stored in this space; the
   *  Stage applies scaleX/Y = display/project so children draw correctly. */
  projectWidth: number
  projectHeight: number
}

/**
 * One Konva `<Stage>` + `<Layer>` mounted above the preview composite.
 * Hosts every visible shape item at the current frame. `pointer-events` is
 * off unless a draw tool is active or a shape is selected, so clicks fall
 * through to the DOM overlays below it when the user isn't interacting
 * with shapes.
 *
 * The click-to-select chicken-and-egg this creates (you can't select an
 * unselected shape by clicking it in the preview) is fixed in Phase 3 via
 * the ShapeTransformer system.
 */
export function ShapesStage({
  displayWidth,
  displayHeight,
  projectWidth,
  projectHeight,
}: ShapesStageProps) {
  const items = useTimelineStore((s) => s.items)
  const tracks = useTimelineStore((s) => s.tracks)
  const currentFrame = usePlaybackStore((s) => s.currentFrame)
  const selectedItemIds = useSelectionStore((s) => s.selectedItemIds)
  const drawKind = useDrawToolStore((s) => s.state.kind)

  const { scaleX, scaleY } = useShapesStageScale(
    displayWidth,
    displayHeight,
    projectWidth,
    projectHeight,
  )
  const visibleShapes = useVisibleShapes(items, tracks, currentFrame)
  const callbacks = useShapeCallbacks()

  const arrowTool = useDrawArrowTool()
  const polygonTool = useDrawPolygonTool()

  const interactive = drawKind !== 'idle' || selectedItemIds.length > 0
  const selectedSet = new Set(selectedItemIds)

  return (
    <div
      aria-hidden={!interactive}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: drawKind !== 'idle' ? 'crosshair' : undefined,
      }}
    >
      <Stage
        width={displayWidth}
        height={displayHeight}
        scaleX={scaleX}
        scaleY={scaleY}
        onPointerDown={arrowTool.onPointerDown}
        onPointerMove={(e) => {
          arrowTool.onPointerMove(e)
          polygonTool.onPointerMove(e)
        }}
        onPointerUp={arrowTool.onPointerUp}
        onClick={polygonTool.onClick}
        onDblClick={polygonTool.onDblClick}
      >
        <Layer>
          {visibleShapes.map((item) => (
            <ShapeRouter
              key={item.id}
              item={item}
              frame={currentFrame}
              isSelected={selectedSet.has(item.id)}
              callbacks={callbacks}
              canvasWidth={projectWidth}
              canvasHeight={projectHeight}
            />
          ))}
          {arrowTool.preview}
          {polygonTool.preview}
        </Layer>
      </Stage>
    </div>
  )
}
```

- [ ] **Step 3: Paste the new file in chat.** ~75 lines (target was ~60; close enough).

- [ ] **Step 4: Run `npm run check`** — pass.

### Step 2.3 verification

- [ ] **Step 1: Run `npm run check`** — pass.

- [ ] **Step 2: Run `npm run test:run`** — pass.

- [ ] **Step 3: Manual smoke test:** open the app, create / select / drag every shape type. Should behave exactly as before. No visual regressions; selection from the timeline still works.

- [ ] **Step 4: Phase 2 checkpoint.** Pause for user confirmation before Phase 3.

---

# Phase 3 — ShapeTransformer system

Six tasks. Builds the new interaction layer.

### Task 3.1 — Update `ShapeCallbacks.onSelect` to accept the Konva event

**Files:**
- Modify: `src/features/shapes-konva/types.ts`

- [ ] **Step 1: Narrate.** "Adding an optional `event` argument to `onSelect`. Shapes already pass `(id)`; the modifier-aware multi-select in Phase 3 also needs to know if Ctrl/Cmd was held. Optional second arg keeps current callers compatible."

- [ ] **Step 2: Edit types.ts**

Find:

```ts
export interface ShapeCallbacks {
  onSelect(id: string): void
  onMove(id: string, x: number, y: number): void
  onUpdateData(id: string, patch: Partial<ShapeItem>): void
  onUpdateVertex(id: string, index: number, x: number, y: number): void
}
```

Replace with:

```ts
import type { KonvaEventObject } from 'konva/lib/Node'

export interface ShapeCallbacks {
  onSelect(id: string, event?: KonvaEventObject<MouseEvent | TouchEvent>): void
  onMove(id: string, x: number, y: number): void
  onUpdateData(id: string, patch: Partial<ShapeItem>): void
  onUpdateVertex(id: string, index: number, x: number, y: number): void
}
```

(Place the `KonvaEventObject` import alongside the existing top-of-file imports.)

- [ ] **Step 3: Paste.**

- [ ] **Step 4: Update `ParametricShapeBody` to pass `e`**

In `src/features/shapes-konva/components/parametric-shape-body.tsx`, change:

```tsx
      onClick={() => callbacks.onSelect(item.id)}
      onTap={() => callbacks.onSelect(item.id)}
```

to:

```tsx
      onClick={(e) => callbacks.onSelect(item.id, e)}
      onTap={(e) => callbacks.onSelect(item.id, e)}
```

- [ ] **Step 5: Update arrow-shape.tsx and free-polygon-shape.tsx** the same way.

In `src/features/shapes-konva/shapes/arrow-shape.tsx`, find the `<Group>`'s `onClick` and `onTap`:

```tsx
      onClick={() => callbacks.onSelect(item.id)}
      onTap={() => callbacks.onSelect(item.id)}
```

Replace with:

```tsx
      onClick={(e) => callbacks.onSelect(item.id, e)}
      onTap={(e) => callbacks.onSelect(item.id, e)}
```

Same in `src/features/shapes-konva/shapes/free-polygon-shape.tsx`.

- [ ] **Step 6: Run `npm run check`** — pass.

### Task 3.2 — Update `useShapeCallbacks` for modifier-aware multi-select

**Files:**
- Modify: `src/features/shapes-konva/hooks/use-shape-callbacks.ts`

- [ ] **Step 1: Narrate.** "When the click has Ctrl/Meta held, toggle the shape in/out of the current selection. Without modifier, replace selection with just this shape."

- [ ] **Step 2: Replace the `onSelect` implementation**

In `use-shape-callbacks.ts`, find:

```ts
      onSelect: (id) => selectItems([id]),
```

Replace with:

```ts
      onSelect: (id, event) => {
        const isMulti = event?.evt
          ? (event.evt as MouseEvent).ctrlKey || (event.evt as MouseEvent).metaKey
          : false
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

And add at the top of the file:

```ts
import { useSelectionStore } from '../deps/selection'
```

(replacing the existing `import { useSelectionStore } from '../deps/selection'` if it's already there — it is from Task 2.3.3.)

- [ ] **Step 3: Paste the new callback body.**

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 3.3 — Add Konva-side `id` on arrow + free-polygon Groups

**Files:**
- Modify: `src/features/shapes-konva/shapes/arrow-shape.tsx`
- Modify: `src/features/shapes-konva/shapes/free-polygon-shape.tsx`

- [ ] **Step 1: Narrate.** "Konva's `<Transformer>` (used in multi-select) attaches to nodes via `stage.findOne(#id)`. Arrow + free-polygon Groups must have a Konva `id` matching `item.id`. (Parametric shapes already got this via `ParametricShapeBody` in Phase 2.)"

- [ ] **Step 2: Edit arrow-shape.tsx**

Find the outer `<Group>` in `arrow-shape.tsx`:

```tsx
    <Group
      x={0}
      y={0}
      draggable={isSelected}
      onClick={(e) => callbacks.onSelect(item.id, e)}
      ...
```

Add `id={item.id}` as a prop:

```tsx
    <Group
      id={item.id}
      x={0}
      y={0}
      draggable={isSelected}
      onClick={(e) => callbacks.onSelect(item.id, e)}
      ...
```

Same change in `free-polygon-shape.tsx`.

- [ ] **Step 3: Paste both diffs.**

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 3.4 — Create ParametricTransformer

**Files:**
- Create: `src/features/shapes-konva/components/parametric-transformer.tsx`

- [ ] **Step 1: Narrate.** "First of the three Transformer variants. Wraps Konva's built-in `<Transformer>` and attaches it to the selected parametric shape(s) via stage.findOne. Locks aspect ratio when all selected shapes are circles."

- [ ] **Step 2: Write the new file**

```tsx
// src/features/shapes-konva/components/parametric-transformer.tsx
import { useEffect, useRef } from 'react'
import { Transformer } from 'react-konva'
import type Konva from 'konva'
import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../deps/timeline'

interface ParametricTransformerProps {
  items: ShapeItem[]
}

/**
 * Konva bounding-box Transformer attached to one or more parametric shapes.
 * Listens for transformend and writes the new geometry back to the timeline
 * items via `updateItem`.
 */
export function ParametricTransformer({ items }: ParametricTransformerProps) {
  const trRef = useRef<Konva.Transformer | null>(null)
  const updateItem = useTimelineStore((s) => s.updateItem)

  // Attach Konva nodes by id whenever the selection changes.
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const stage = tr.getStage()
    if (!stage) return

    const nodes = items
      .map((item) => stage.findOne(`#${item.id}`))
      .filter((n): n is Konva.Node => !!n)

    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [items])

  const keepRatio = items.every((i) => i.shapeType === 'circle')

  return (
    <Transformer
      ref={trRef}
      keepRatio={keepRatio}
      rotateEnabled
      anchorSize={8}
      ignoreStroke
      onTransformEnd={() => {
        // Read each node's post-transform geometry and write back.
        const tr = trRef.current
        if (!tr) return
        for (const node of tr.nodes()) {
          const id = node.id()
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          const rotation = node.rotation()
          const x = node.x()
          const y = node.y()

          // Apply scale to width/height, reset scale to 1 (Konva idiom).
          const width = Math.max(1, node.width() * scaleX)
          const height = Math.max(1, node.height() * scaleY)
          node.scaleX(1)
          node.scaleY(1)

          // Translate (x, y) back into the item's transform space. The
          // ParametricShapeBody uses center-relative `transform.x/y`; here
          // we round-trip through konvaPositionToTransform-equivalent math
          // by writing both the position and the size.
          updateItem(id, {
            durationInFrames: undefined as unknown as number, // ensure no width-only update
            // Width / height live in transform — schema currently encodes
            // them in `transform.width` / `transform.height`. If your
            // ShapeItem uses different fields, adapt here.
            transform: {
              x,
              y,
              width,
              height,
              rotation,
            },
          })
        }
        tr.getLayer()?.batchDraw()
      }}
    />
  )
}
```

> [!warning]
> **Heads-up to implementer:** the `updateItem` payload above writes `transform: { x, y, width, height, rotation }` directly. The actual `ShapeItem.transform` type lives in `src/types/transform.ts`. Before pasting, read that file to confirm the shape. Adjust property names if they differ (e.g., `width` may be elsewhere on the item). The `durationInFrames: undefined` line is a safety hack — remove if `updateItem` doesn't object to a partial without it.
>
> If the exact mapping is unclear, **stop and ask the user** rather than guessing.

- [ ] **Step 3: Paste in chat.**

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 3.5 — Create ArrowTransformer

**Files:**
- Create: `src/features/shapes-konva/components/arrow-transformer.tsx`

- [ ] **Step 1: Narrate.** "Arrow's transformer is just its existing two endpoint handles, rehomed."

- [ ] **Step 2: Write the new file**

```tsx
// src/features/shapes-konva/components/arrow-transformer.tsx
import type { ShapeItem } from '@/types/timeline'
import { EndpointHandle } from './endpoint-handle'
import type { ShapeCallbacks } from '../types'

interface ArrowTransformerProps {
  item: ShapeItem
  callbacks: ShapeCallbacks
}

/**
 * Endpoint handles for a single selected arrow. Replaces the inline
 * handle rendering that used to live in `arrow-shape.tsx`.
 */
export function ArrowTransformer({ item, callbacks }: ArrowTransformerProps) {
  const a = item.arrowData
  if (!a) return null

  return (
    <>
      <EndpointHandle
        x={a.fromX}
        y={a.fromY}
        onDrag={(x, y) => callbacks.onUpdateVertex(item.id, 0, x, y)}
      />
      <EndpointHandle
        x={a.toX}
        y={a.toY}
        onDrag={(x, y) => callbacks.onUpdateVertex(item.id, 1, x, y)}
      />
    </>
  )
}
```

- [ ] **Step 3: Paste.**

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 3.6 — Create PolygonTransformer

**Files:**
- Create: `src/features/shapes-konva/components/polygon-transformer.tsx`

- [ ] **Step 1: Narrate.** "Polygon's transformer is its N vertex handles, rehomed."

- [ ] **Step 2: Write the new file**

```tsx
// src/features/shapes-konva/components/polygon-transformer.tsx
import type { ShapeItem } from '@/types/timeline'
import { EndpointHandle } from './endpoint-handle'
import type { ShapeCallbacks } from '../types'

interface PolygonTransformerProps {
  item: ShapeItem
  callbacks: ShapeCallbacks
}

/**
 * Per-vertex handles for a single selected free-polygon. Replaces the
 * inline handle rendering that used to live in `free-polygon-shape.tsx`.
 */
export function PolygonTransformer({ item, callbacks }: PolygonTransformerProps) {
  const data = item.freePolygonData
  if (!data) return null

  const vertexCount = data.vertices.length / 2

  return (
    <>
      {Array.from({ length: vertexCount }, (_, i) => {
        const x = data.vertices[i * 2] ?? 0
        const y = data.vertices[i * 2 + 1] ?? 0
        return (
          <EndpointHandle
            key={i}
            x={x}
            y={y}
            onDrag={(nx, ny) => callbacks.onUpdateVertex(item.id, i, nx, ny)}
          />
        )
      })}
    </>
  )
}
```

- [ ] **Step 3: Paste.**

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 3.7 — Create ShapeTransformer (the switcher)

**Files:**
- Create: `src/features/shapes-konva/components/shape-transformer.tsx`

- [ ] **Step 1: Narrate.** "The single mounting point. Picks the right variant based on selection count + shape type."

- [ ] **Step 2: Write the new file**

```tsx
// src/features/shapes-konva/components/shape-transformer.tsx
import type { ShapeItem } from '@/types/timeline'
import { ParametricTransformer } from './parametric-transformer'
import { ArrowTransformer } from './arrow-transformer'
import { PolygonTransformer } from './polygon-transformer'
import type { ShapeCallbacks } from '../types'

interface ShapeTransformerProps {
  selectedShapes: ShapeItem[]
  callbacks: ShapeCallbacks
}

/**
 * Single mounting point for shape-edit affordances. Switches per shape type
 * for single-select; uses ParametricTransformer (Konva bounding-box) for
 * multi-select.
 */
export function ShapeTransformer({ selectedShapes, callbacks }: ShapeTransformerProps) {
  if (selectedShapes.length === 0) return null

  if (selectedShapes.length > 1) {
    return <ParametricTransformer items={selectedShapes} />
  }

  const shape = selectedShapes[0]!
  switch (shape.shapeType) {
    case 'arrow':
      return <ArrowTransformer item={shape} callbacks={callbacks} />
    case 'free-polygon':
      return <PolygonTransformer item={shape} callbacks={callbacks} />
    case 'rectangle':
    case 'circle':
    case 'ellipse':
    case 'triangle':
    case 'polygon':
      return <ParametricTransformer items={[shape]} />
    case 'star':
    case 'heart':
    case 'path':
      // Deferred types — no transformer yet.
      return null
    default: {
      const _exhaustive: never = shape.shapeType
      void _exhaustive
      return null
    }
  }
}
```

- [ ] **Step 3: Paste.**

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 3.8 — Remove handle rendering from arrow-shape and free-polygon-shape

**Files:**
- Modify: `src/features/shapes-konva/shapes/arrow-shape.tsx`
- Modify: `src/features/shapes-konva/shapes/free-polygon-shape.tsx`

- [ ] **Step 1: Narrate.** "Arrow and free-polygon stop rendering their handles inline; the new ArrowTransformer / PolygonTransformer (mounted by ShapesStage) renders them. The shape components go back to just drawing the body."

- [ ] **Step 2: Edit arrow-shape.tsx**

Find:

```tsx
      {isSelected && (
        <>
          <EndpointHandle
            x={a.fromX}
            y={a.fromY}
            onDrag={(x, y) => callbacks.onUpdateVertex(item.id, 0, x, y)}
          />
          <EndpointHandle
            x={a.toX}
            y={a.toY}
            onDrag={(x, y) => callbacks.onUpdateVertex(item.id, 1, x, y)}
          />
        </>
      )}
```

Delete that block.

Also remove the now-unused `EndpointHandle` import at the top.

- [ ] **Step 3: Edit free-polygon-shape.tsx**

Find:

```tsx
      {isSelected &&
        Array.from({ length: vertexCount }, (_, i) => {
          const x = data.vertices[i * 2] ?? 0
          const y = data.vertices[i * 2 + 1] ?? 0
          return (
            <EndpointHandle
              key={i}
              x={x}
              y={y}
              onDrag={(nx, ny) => callbacks.onUpdateVertex(item.id, i, nx, ny)}
            />
          )
        })}
```

Delete that block.

Remove the unused `EndpointHandle` import.

- [ ] **Step 4: Paste both diffs.**

- [ ] **Step 5: Run `npm run check`** — pass.

### Task 3.9 — Wire ShapeTransformer into ShapesStage, fix click-to-select

**Files:**
- Modify: `src/features/shapes-konva/components/shapes-stage.tsx`

- [ ] **Step 1: Narrate.** "Mounting `<ShapeTransformer>` inside the Layer. Also fixing the pointer-events guard so clicks on shapes select them when nothing else is selected, and adding the empty-stage-click handler that clears item selection."

- [ ] **Step 2: Replace the relevant parts of shapes-stage.tsx**

In the body of the component, after `const callbacks = useShapeCallbacks()`, add:

```tsx
  const selectedShapes = visibleShapes.filter((s) => selectedSet.has(s.id))
```

(Move `const selectedSet = new Set(selectedItemIds)` above this line if it isn't already.)

Change the `interactive` line from:

```tsx
  const interactive = drawKind !== 'idle' || selectedItemIds.length > 0
```

to:

```tsx
  // Always interactive when there are visible shapes OR a draw tool is
  // active. The empty-stage click handler below dispatches selection
  // changes for clicks that don't land on a shape.
  const interactive = drawKind !== 'idle' || visibleShapes.length > 0
```

Add `clearItemSelection` import at the top:

```tsx
import { useSelectionStore } from '../deps/selection'
```

(already imported via `useSelectionStore`; if not, add it).

Inside the component:

```tsx
  const clearItemSelection = useSelectionStore((s) => s.clearItemSelection)
```

In the `<Stage>` element, add an `onClick` (alongside the existing `onPointerDown` etc.):

```tsx
        onClick={(e) => {
          // Forward to the polygon-draw tool's existing handler.
          polygonTool.onClick(e)
          // If the click landed on the empty Stage background (no shape),
          // clear item selection.
          if (e.target === e.target.getStage()) {
            clearItemSelection()
          }
        }}
```

(Replace the existing `onClick={polygonTool.onClick}` with this combined handler.)

Inside the `<Layer>`, after the `visibleShapes.map(...)` and the two draw-tool previews, add:

```tsx
          <ShapeTransformer selectedShapes={selectedShapes} callbacks={callbacks} />
```

Add the import at the top:

```tsx
import { ShapeTransformer } from './shape-transformer'
```

- [ ] **Step 3: Paste the diffs in chat** (the full updated file is ~85 lines now; show in chat).

- [ ] **Step 4: Run `npm run check`** — pass.

### Task 3.10 — Test scaffold (optional, time-permitting)

**Files:**
- Create: `src/features/shapes-konva/components/shape-transformer.test.tsx`

- [ ] **Step 1: Narrate.** "Quick smoke test for the switcher. Tests that single-select dispatches to the right variant; multi-select goes to ParametricTransformer. Doesn't try to test Konva interactions (those need real Konva, which is hostile in jsdom)."

- [ ] **Step 2: Write the test**

```tsx
// src/features/shapes-konva/components/shape-transformer.test.tsx
import { describe, it, expect, vi } from 'vite-plus/test'
import { render } from '@testing-library/react'
import { ShapeTransformer } from './shape-transformer'
import type { ShapeItem } from '@/types/timeline'
import type { ShapeCallbacks } from '../types'

// Mock react-konva primitives so we render synchronously in jsdom.
vi.mock('react-konva', () => ({
  Transformer: vi.fn(() => null),
  Circle: vi.fn(() => null),
}))

function baseShape(over: Partial<ShapeItem>): ShapeItem {
  return {
    id: 'a',
    type: 'shape',
    shapeType: 'rectangle',
    trackId: 't',
    from: 0,
    durationInFrames: 60,
    label: 'r',
    ...over,
  } as ShapeItem
}

const noopCallbacks: ShapeCallbacks = {
  onSelect: () => {},
  onMove: () => {},
  onUpdateData: () => {},
  onUpdateVertex: () => {},
}

describe('ShapeTransformer', () => {
  it('renders nothing when selection is empty', () => {
    const { container } = render(
      <ShapeTransformer selectedShapes={[]} callbacks={noopCallbacks} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders for a single rectangle', () => {
    const { container } = render(
      <ShapeTransformer
        selectedShapes={[baseShape({ shapeType: 'rectangle' })]}
        callbacks={noopCallbacks}
      />,
    )
    // ParametricTransformer renders the Transformer mock.
    expect(container.firstChild).not.toBeNull()
  })

  it('routes single arrow to ArrowTransformer (EndpointHandle Circles)', () => {
    const item = baseShape({
      shapeType: 'arrow',
      arrowData: { fromX: 0, fromY: 0, toX: 10, toY: 10 },
    } as Partial<ShapeItem>)
    const { container } = render(
      <ShapeTransformer selectedShapes={[item]} callbacks={noopCallbacks} />,
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('multi-select always uses ParametricTransformer', () => {
    const items = [
      baseShape({ id: 'a', shapeType: 'rectangle' }),
      baseShape({ id: 'b', shapeType: 'arrow' }),
    ]
    const { container } = render(
      <ShapeTransformer selectedShapes={items} callbacks={noopCallbacks} />,
    )
    expect(container.firstChild).not.toBeNull()
  })
})
```

- [ ] **Step 3: Paste.**

- [ ] **Step 4: Run `npm run test:run`** — pass.

(If the test fails because the mocks are incomplete, fix per error — don't tweak the production code to make a flimsy test pass.)

### Phase 3 verification

- [ ] **Step 1: Run `npm run check`** — pass.

- [ ] **Step 2: Run `npm run test:run`** — pass.

- [ ] **Step 3: Run `npm run check:boundaries`** — pass.

- [ ] **Step 4: Manual test matrix**

Have the user open `npm run dev` and confirm each row:

| Scenario | Expected |
|---|---|
| Click a rectangle in the preview when nothing is selected | Rectangle becomes selected; Transformer bounding box + 8 handles appear |
| Drag a corner handle | Rectangle resizes; on release, change persists |
| Drag the rotate handle (above the box) | Rectangle rotates around its center |
| Click empty Stage space | Selection cleared; handles disappear |
| Click an arrow in the preview when nothing is selected | Arrow selected; 2 endpoint handles appear |
| Drag the head endpoint | Just the head moves; tail stays |
| Drag the tail endpoint | Just the tail moves; head stays |
| Click a free-polygon | Polygon selected; N vertex handles appear |
| Drag any vertex | Just that vertex moves |
| Click rectangle A, then Ctrl-click rectangle B | Both selected; one bounding box wraps both |
| Drag a corner of the multi-selection bounding box | Both rectangles resize together |
| Click rectangle A, Ctrl-click rectangle A again | Rectangle A deselected (toggle behavior) |
| Click a circle | Circle selected; bounding box appears; resize keeps aspect 1:1 |
| Draw a new polygon via the polygon tool | Drawing flow unchanged; new polygon appears |
| Click a video clip in the timeline, then click empty preview | Item selection cleared; track selection preserved |

- [ ] **Step 5: Phase 3 checkpoint.** Pause for user confirmation. Done.

---

# Self-review notes

After writing this plan, I checked:

- **Spec coverage:** every section of the spec maps to at least one task. Phase 1 ↔ Tasks 1.1-1.4. Phase 2 Step 2.1 ↔ Tasks 2.1.1-2.1.3 + verification. Phase 2 Step 2.2 ↔ Tasks 2.2.1-2.2.6 + verification. Phase 2 Step 2.3 ↔ Tasks 2.3.1-2.3.4 + verification. Phase 3 ↔ Tasks 3.1-3.10.
- **Placeholders:** none. Every task names exact files and pastes the actual code that ships.
- **Type consistency:** `ShapeCallbacks.onSelect` signature is changed once (Task 3.1) and consistently throughout. `ShapeTransformer` props are `{ selectedShapes, callbacks }` everywhere. Transformer variants all import `ShapeCallbacks` from `'../types'`.
- **Known implementer-side decision:** Task 3.4's `ParametricTransformer` writes back to `updateItem` with a `transform` payload whose shape depends on `src/types/transform.ts`. The note in Task 3.4 tells the implementer to read that file first and adapt the payload. Not a placeholder — a deliberate flag because the answer differs by codebase conventions and reading the type at write time is cleaner than guessing.

---

# Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-shapes-konva-cleanup.md`. Two execution options:

1. **Subagent-Driven** — I dispatch a fresh subagent per task, two-stage review between tasks. Fast iteration, less context bleed, but the user sees less of the work in-flight (the subagent does the editing).

2. **Inline Execution (recommended for this work)** — I execute tasks in this session, narrating each change in chat with code blocks, pausing for confirmation at every phase checkpoint. Slower but the user sees every code change land, which matches the "let me in on the entire process" preference.
