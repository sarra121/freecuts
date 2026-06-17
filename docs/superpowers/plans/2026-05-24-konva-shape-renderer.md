# Konva Shape Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all active shape rendering in MatchView from the WebGPU SDF pipeline to a unified Konva (via react-konva) layer that sits above the preview composite, ship two new shape variants (parametric arrow + free-form polygon) with click-to-draw tools, and pre-load sport-broadcast-style defaults.

**Architecture:** Each shape is a small react-konva React component receiving `(item, frame, isSelected, callbacks)` — pure function of props, no `Konva.Group` subclasses. One `<Stage>` + one `<Layer>` mounted on top of `scrubCanvasRef` in `preview-stage.tsx` hosts every shape; items sorted by track `order`. Existing parametric shape types (rectangle/circle/ellipse/triangle/polygon) are re-rendered through Konva with no data change. The GPU SDF pipeline is **gated, not deleted** — its call sites in `render-item.ts` and `canvas-shapes.ts` are commented out in place, the pipeline files stay untouched. Two new variants ship: `arrow` (parametric two-point with optional curve breadcrumb + dash + drop-shadow) and `free-polygon` (arbitrary points + per-vertex handles). Three existing variants are deferred (`star`/`heart`/`path`) — their data is preserved on load and they render as a placeholder. Drawing tools live in a new toolbar "Draw" group; the existing Shapes sidebar tab is restored. Selection alone shows handles — no edit mode.

**Tech Stack:** React 19, TypeScript (strict), Vite, Tailwind, Zustand (for the draw-tool store), Konva 9 + react-konva 18, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-24-konva-shape-renderer-design.md`

**No git commits** — per the user's standing preference, every change stays uncommitted in the working tree on the `pitchsense` branch. Each task ends with a build/verify step.

---

## File Structure

| File | Action |
|------|--------|
| `package.json` | Modify — add `konva`, `react-konva` |
| `src/types/timeline.ts` | Modify — extend `ShapeType` union + add type-specific data fields to `ShapeItem` |
| `src/shared/projects/migrations/types.ts` | Modify — bump `CURRENT_SCHEMA_VERSION` |
| `src/shared/projects/migrations/migrations.ts` | Modify — no-op forward migration |
| `src/features/shapes-konva/index.ts` | Create — public barrel |
| `src/features/shapes-konva/types.ts` | Create — `ShapeProps`, `ShapeCallbacks`, `ArrowData`, `FreePolygonData`, `DrawState` |
| `src/features/shapes-konva/utils/defaults.ts` | Create — broadcast styling defaults |
| `src/features/shapes-konva/utils/track-order.ts` | Create — sort helper |
| `src/features/shapes-konva/stores/draw-tool-store.ts` | Create — Zustand store for draw mode |
| `src/features/shapes-konva/stores/actions/create-arrow.ts` | Create |
| `src/features/shapes-konva/stores/actions/create-free-polygon.ts` | Create |
| `src/features/shapes-konva/stores/actions/update-vertex.ts` | Create |
| `src/features/shapes-konva/shapes/rectangle-shape.tsx` | Create |
| `src/features/shapes-konva/shapes/circle-shape.tsx` | Create |
| `src/features/shapes-konva/shapes/ellipse-shape.tsx` | Create |
| `src/features/shapes-konva/shapes/triangle-shape.tsx` | Create |
| `src/features/shapes-konva/shapes/regular-polygon-shape.tsx` | Create |
| `src/features/shapes-konva/shapes/arrow-shape.tsx` | Create |
| `src/features/shapes-konva/shapes/free-polygon-shape.tsx` | Create |
| `src/features/shapes-konva/shapes/endpoint-handle.tsx` | Create |
| `src/features/shapes-konva/shapes/deferred-shape-placeholder.tsx` | Create |
| `src/features/shapes-konva/components/shapes-stage.tsx` | Create |
| `src/features/shapes-konva/components/shape-router.tsx` | Create |
| `src/features/shapes-konva/components/draw-arrow-tool.tsx` | Create |
| `src/features/shapes-konva/components/draw-polygon-tool.tsx` | Create |
| `src/features/shapes-konva/components/tactical-color-presets.tsx` | Create |
| `src/features/shapes-konva/deps/timeline.ts` | Create — wrap timeline store/actions |
| `src/features/shapes-konva/deps/playback.ts` | Create — wrap playback store |
| `src/features/shapes-konva/deps/selection.ts` | Create — wrap selection store |
| `src/features/preview/components/preview-stage.tsx` | Modify — mount `<ShapesStage />` |
| `src/features/editor/components/toolbar.tsx` | Modify — add Draw group with two buttons |
| `src/features/editor/components/properties-sidebar/clip-panel/shape-section.tsx` | Modify — add arrow/free-polygon branches, comment-out deferred branches, color preset row |
| `src/features/editor/components/media-sidebar.tsx` | Modify — restore Shapes rail tab, comment-out star/heart/pen tiles |
| `src/features/export/utils/canvas-item-renderer/render-item.ts` | Modify — gate `case 'shape':` body |
| `src/features/export/utils/canvas-shapes.ts` | Untouched (file stays in codebase, unreached) |
| `src/infrastructure/gpu-shapes/shape-render-pipeline.ts` | Untouched |

---

## Task 1: Install Konva + react-konva

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run: `npm install konva@^9 react-konva@^18`
Expected: dependencies installed; `package.json` has both under `dependencies`.

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: build succeeds. (No imports yet; this just confirms the install didn't break the build.)

---

## Task 2: Extend the `ShapeType` union + add type-specific data fields

**Files:**
- Modify: `src/types/timeline.ts`

The existing `ShapeItem` has fields like `shapeType`, `width`, `height`, `cornerRadius`, `points` (count of N-gon sides), etc. The new arrow and free-polygon variants store their data under type-specific keys (`arrowData`, `freePolygonData`) to avoid collision with the existing `points: number` field.

- [ ] **Step 1: Locate `ShapeType`**

Open `src/types/timeline.ts`. Find the `ShapeType` definition (a union like `'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'polygon' | 'star' | 'heart' | 'path'`). It is referenced by `ShapeItem`.

- [ ] **Step 2: Add the two new variants to `ShapeType`**

Replace the `ShapeType` union with:

```ts
export type ShapeType =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'polygon'
  | 'star'
  | 'heart'
  | 'path'
  | 'arrow'           // NEW
  | 'free-polygon'    // NEW
```

- [ ] **Step 3: Add the type-specific data fields to `ShapeItem`**

Find the `ShapeItem` interface (the `shape`-typed member of the `TimelineItem` union). Add two optional fields next to the existing shape fields:

```ts
arrowData?: {
  fromX: number
  fromY: number
  toX: number
  toY: number
  pointerLength?: number   // default 16
  pointerWidth?: number    // default 16
  dash?: 'solid' | 'dashed' | 'dotted'  // default 'solid'
  // v1 breadcrumb — reserved for the curved-arrow variant:
  controlX?: number
  controlY?: number
}

freePolygonData?: {
  vertices: number[]   // flat [x0, y0, x1, y1, …], item-local
  closed: boolean
}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds. No usages of the new variants yet — this is just type plumbing.

---

## Task 3: Bump schema version + no-op forward migration

**Files:**
- Modify: `src/shared/projects/migrations/types.ts`
- Modify: `src/shared/projects/migrations/migrations.ts`

The added union members and optional fields are additive — no existing project data needs reshaping. We still bump the schema version so older app builds can detect a newer project file.

- [ ] **Step 1: Read the migrations module**

Open `src/shared/projects/migrations/types.ts` and `migrations.ts`. Note the current `CURRENT_SCHEMA_VERSION` value (call it `N`). The migrations list is keyed by `from → to` version.

- [ ] **Step 2: Bump the constant**

In `types.ts`, change `CURRENT_SCHEMA_VERSION` from `N` to `N + 1`.

- [ ] **Step 3: Add the no-op migration**

In `migrations.ts`, add an entry that migrates `N → N+1` and returns the project unchanged. Follow the file's existing pattern (probably an object literal entry); the function body is just `return project` or equivalent.

- [ ] **Step 4: Verify the build + migration tests**

Run: `npm run build && npm run test:run -- src/shared/projects/migrations`
Expected: build green, migration tests pass (the no-op migration is exercised by any existing migration round-trip test).

---

## Task 4: Broadcast-style defaults

**Files:**
- Create: `src/features/shapes-konva/utils/defaults.ts`
- Create: `src/features/shapes-konva/utils/track-order.ts`

- [ ] **Step 1: Create the defaults module**

Create `src/features/shapes-konva/utils/defaults.ts`:

```ts
/**
 * Broadcast-clean default styling for new shapes. Tuned to read on grass
 * and bright kit colors. User-applied properties override these.
 */

export const ARROW_DEFAULTS = {
  stroke: '#FFFFFF',
  fill: '#FFFFFF',
  strokeWidth: 3,
  pointerLength: 16,
  pointerWidth: 16,
  dash: 'solid' as const,
  shadowColor: 'rgba(0, 0, 0, 0.6)',
  shadowBlur: 4,
  shadowOffsetX: 1,
  shadowOffsetY: 1,
  shadowOpacity: 0.35,
}

export const FREE_POLYGON_DEFAULTS = {
  fill: 'rgba(255, 255, 255, 0.18)',
  stroke: '#FFFFFF',
  strokeWidth: 2,
  closed: true,
}

export const PARAMETRIC_SHAPE_DEFAULTS = {
  fill: 'rgba(255, 255, 255, 0.18)',
  stroke: '#FFFFFF',
  strokeWidth: 2,
}

export const TACTICAL_PRESET_COLORS: Array<{ id: string; label: string; hex: string }> = [
  { id: 'red', label: 'Attack', hex: '#E63946' },
  { id: 'blue', label: 'Defense', hex: '#1845C8' },
  { id: 'yellow', label: 'Ball / Key', hex: '#F5A623' },
  { id: 'white', label: 'Neutral', hex: '#FFFFFF' },
  { id: 'green', label: 'Open space', hex: '#2A9D8F' },
  { id: 'orange', label: 'Pressure', hex: '#F4A261' },
]

/** Convert a `dash` style to a Konva `dash` array (or undefined for solid). */
export function dashToArray(
  dash: 'solid' | 'dashed' | 'dotted' | undefined,
): number[] | undefined {
  if (dash === 'dashed') return [10, 6]
  if (dash === 'dotted') return [2, 6]
  return undefined
}
```

- [ ] **Step 2: Create the track-order sort helper**

Create `src/features/shapes-konva/utils/track-order.ts`:

```ts
import type { ShapeItem } from '@/types/timeline'

/**
 * Sort shape items so the lowest track `order` (which means visually
 * highest on the timeline) renders LAST and therefore on top in Konva,
 * matching the project's Z-order convention.
 */
export function sortShapesByTrackOrder(
  items: ShapeItem[],
  trackOrderFor: (trackId: string) => number,
): ShapeItem[] {
  return [...items].sort((a, b) => {
    const oa = trackOrderFor(a.trackId)
    const ob = trackOrderFor(b.trackId)
    return ob - oa
  })
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

---

## Task 5: Draw-tool store (Zustand)

**Files:**
- Create: `src/features/shapes-konva/types.ts`
- Create: `src/features/shapes-konva/stores/draw-tool-store.ts`
- Test: `src/features/shapes-konva/stores/draw-tool-store.test.ts`

- [ ] **Step 1: Create the public types file**

Create `src/features/shapes-konva/types.ts`:

```ts
import type { ShapeItem } from '@/types/timeline'

export interface ShapeCallbacks {
  onSelect(id: string): void
  onMove(id: string, x: number, y: number): void
  onUpdateData(id: string, patch: Partial<ShapeItem>): void
  onUpdateVertex(id: string, index: number, x: number, y: number): void
}

export interface ShapeProps {
  item: ShapeItem
  frame: number
  isSelected: boolean
  callbacks: ShapeCallbacks
}

export type DrawState =
  | { kind: 'idle' }
  | { kind: 'drawing-arrow'; tail: { x: number; y: number } | null }
  | { kind: 'drawing-polygon'; vertices: number[] }   // flat [x0,y0,x1,y1,…]
```

- [ ] **Step 2: Write the failing test**

Create `src/features/shapes-konva/stores/draw-tool-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useDrawToolStore } from './draw-tool-store'

describe('draw-tool-store', () => {
  beforeEach(() => {
    useDrawToolStore.setState({ state: { kind: 'idle' } })
  })

  it('starts idle', () => {
    expect(useDrawToolStore.getState().state.kind).toBe('idle')
  })

  it('startArrow puts the store into drawing-arrow with no tail yet', () => {
    useDrawToolStore.getState().startArrow()
    expect(useDrawToolStore.getState().state).toEqual({ kind: 'drawing-arrow', tail: null })
  })

  it('startPolygon puts the store into drawing-polygon with empty vertices', () => {
    useDrawToolStore.getState().startPolygon()
    expect(useDrawToolStore.getState().state).toEqual({ kind: 'drawing-polygon', vertices: [] })
  })

  it('appendPolygonVertex pushes to the vertex list', () => {
    useDrawToolStore.getState().startPolygon()
    useDrawToolStore.getState().appendPolygonVertex(10, 20)
    useDrawToolStore.getState().appendPolygonVertex(30, 40)
    expect(useDrawToolStore.getState().state).toEqual({
      kind: 'drawing-polygon',
      vertices: [10, 20, 30, 40],
    })
  })

  it('setArrowTail stores the tail position', () => {
    useDrawToolStore.getState().startArrow()
    useDrawToolStore.getState().setArrowTail(50, 60)
    expect(useDrawToolStore.getState().state).toEqual({
      kind: 'drawing-arrow',
      tail: { x: 50, y: 60 },
    })
  })

  it('cancel returns to idle', () => {
    useDrawToolStore.getState().startPolygon()
    useDrawToolStore.getState().appendPolygonVertex(1, 2)
    useDrawToolStore.getState().cancel()
    expect(useDrawToolStore.getState().state.kind).toBe('idle')
  })
})
```

- [ ] **Step 3: Run the failing test**

Run: `npm run test:run -- src/features/shapes-konva/stores/draw-tool-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the store**

Create `src/features/shapes-konva/stores/draw-tool-store.ts`:

```ts
import { create } from 'zustand'
import type { DrawState } from '../types'

interface DrawToolStore {
  state: DrawState
  startArrow(): void
  startPolygon(): void
  setArrowTail(x: number, y: number): void
  appendPolygonVertex(x: number, y: number): void
  cancel(): void
}

export const useDrawToolStore = create<DrawToolStore>()((set) => ({
  state: { kind: 'idle' },
  startArrow: () => set({ state: { kind: 'drawing-arrow', tail: null } }),
  startPolygon: () => set({ state: { kind: 'drawing-polygon', vertices: [] } }),
  setArrowTail: (x, y) =>
    set((s) =>
      s.state.kind === 'drawing-arrow' ? { state: { kind: 'drawing-arrow', tail: { x, y } } } : s,
    ),
  appendPolygonVertex: (x, y) =>
    set((s) =>
      s.state.kind === 'drawing-polygon'
        ? { state: { kind: 'drawing-polygon', vertices: [...s.state.vertices, x, y] } }
        : s,
    ),
  cancel: () => set({ state: { kind: 'idle' } }),
}))
```

- [ ] **Step 5: Run the tests**

Run: `npm run test:run -- src/features/shapes-konva/stores/draw-tool-store.test.ts`
Expected: PASS — 6/6 tests green.

---

## Task 6: Add Draw group buttons to the toolbar

**Files:**
- Modify: `src/features/editor/components/toolbar.tsx`

This is the first visible deliverable — the toolbar shows the new tool buttons even before the drawing logic exists. Clicking a button flips the store; the cursor + interception logic ships in later tasks.

- [ ] **Step 1: Read the toolbar**

Open `src/features/editor/components/toolbar.tsx`. Locate the existing JSX structure between the project-info badge and the Save button — that's where the Draw group goes.

- [ ] **Step 2: Import the icons + store**

Add imports near the existing `lucide-react` import:

```ts
import { Spline, MoveUpRight } from 'lucide-react'
import { useDrawToolStore } from '@/features/shapes-konva/stores/draw-tool-store'
```

If `Spline` or `MoveUpRight` are unavailable from your installed lucide-react version, fall back to `PenTool` and `ArrowUpRight` respectively (both broadly available). Verify by running the build after the change.

- [ ] **Step 3: Read the store inside `Toolbar`**

Inside the `Toolbar` component body, near the other store reads, add:

```ts
const drawState = useDrawToolStore((s) => s.state)
const startArrow = useDrawToolStore((s) => s.startArrow)
const startPolygon = useDrawToolStore((s) => s.startPolygon)
const cancelDraw = useDrawToolStore((s) => s.cancel)
```

- [ ] **Step 4: Insert the Draw group JSX**

Insert this group between the project-info badge and the Save button. Match the existing button styling (`h-8 gap-1.5 glow-primary-sm` etc. — pattern-match the surrounding buttons):

```tsx
<div className="flex items-center gap-1 ml-2">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => (drawState.kind === 'drawing-polygon' ? cancelDraw() : startPolygon())}
    className={cn(
      'h-8 w-8 p-0',
      drawState.kind === 'drawing-polygon' ? 'bg-primary/15 text-primary' : 'text-muted-foreground',
    )}
    title={t('toolbar.drawPolygon')}
  >
    <Spline className="h-4 w-4" />
  </Button>
  <Button
    variant="ghost"
    size="sm"
    onClick={() => (drawState.kind === 'drawing-arrow' ? cancelDraw() : startArrow())}
    className={cn(
      'h-8 w-8 p-0',
      drawState.kind === 'drawing-arrow' ? 'bg-primary/15 text-primary' : 'text-muted-foreground',
    )}
    title={t('toolbar.drawArrow')}
  >
    <MoveUpRight className="h-4 w-4" />
  </Button>
</div>
```

(Adjust the `cn`, `Button`, `t` imports to match what the file already imports.)

- [ ] **Step 5: Add i18n entries**

Open `src/i18n/locales/partials/editor.json` (or wherever the existing `toolbar.*` keys live — locate with `npx --no-install rg '"settings"' src/i18n/locales/partials/editor.json -l`). Add the two new keys for all 9 languages under `toolbar.*`:

| Locale | `toolbar.drawPolygon` | `toolbar.drawArrow` |
|---|---|---|
| en | `Draw polygon` | `Draw arrow` |
| es | `Dibujar polígono` | `Dibujar flecha` |
| fr | `Dessiner un polygone` | `Dessiner une flèche` |
| de | `Polygon zeichnen` | `Pfeil zeichnen` |
| pt-BR | `Desenhar polígono` | `Desenhar flecha` |
| tr | `Çokgen çiz` | `Ok çiz` |
| ja | `多角形を描画` | `矢印を描画` |
| ko | `다각형 그리기` | `화살표 그리기` |
| zh | `绘制多边形` | `绘制箭头` |

Keep key structure identical across files.

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Visual check**

Run: `npm run dev`. Open an editor screen. Confirm the two new icon buttons sit between the project info and the Save button. Click each → its button highlights as active; click again → returns to inactive. (Drawing doesn't yet do anything else — that's later tasks.)

---

## Task 7: ShapesStage + ShapeRouter + DeferredShapePlaceholder + deps adapters

**Files:**
- Create: `src/features/shapes-konva/deps/timeline.ts`
- Create: `src/features/shapes-konva/deps/playback.ts`
- Create: `src/features/shapes-konva/deps/selection.ts`
- Create: `src/features/shapes-konva/shapes/deferred-shape-placeholder.tsx`
- Create: `src/features/shapes-konva/components/shape-router.tsx`
- Create: `src/features/shapes-konva/components/shapes-stage.tsx`
- Create: `src/features/shapes-konva/index.ts`

The deps adapters wrap the existing stores so cross-feature imports satisfy the project's `check:boundaries` rule.

- [ ] **Step 1: Create the deps adapters**

`src/features/shapes-konva/deps/timeline.ts`:

```ts
export { useTimelineStore } from '@/features/timeline/stores/timeline-store-facade'
export type { TimelineItem, ShapeItem } from '@/types/timeline'
```

`src/features/shapes-konva/deps/playback.ts`:

```ts
export { usePlaybackStore } from '@/shared/state/playback'
```

`src/features/shapes-konva/deps/selection.ts`:

```ts
export { useSelectionStore } from '@/shared/state/selection'
```

(If any of these import paths differ in the actual codebase, locate the canonical export with `rg` and adjust the adapter — keep the path inside `@/features/shapes-konva/deps/` so cross-feature consumers go through here.)

- [ ] **Step 2: Create the deferred-shape placeholder**

`src/features/shapes-konva/shapes/deferred-shape-placeholder.tsx`:

```tsx
import { Rect } from 'react-konva'
import { useEffect, useRef } from 'react'
import { createLogger } from '@/shared/logging/logger'
import type { ShapeProps } from '../types'

const log = createLogger('shapes-konva')

/**
 * Renders a tiny translucent placeholder for deferred shape types
 * (star / heart / path). Existing project data is preserved on load;
 * the placeholder communicates that the variant ships later.
 */
export function DeferredShapePlaceholder({ item }: Pick<ShapeProps, 'item'>) {
  const warnedRef = useRef(false)
  useEffect(() => {
    if (warnedRef.current) return
    warnedRef.current = true
    log.warn('Deferred shape type rendered as placeholder', {
      shapeType: item.shapeType,
      itemId: item.id,
    })
  }, [item.shapeType, item.id])
  return (
    <Rect
      x={item.x ?? 0}
      y={item.y ?? 0}
      width={item.width ?? 80}
      height={item.height ?? 80}
      fill="rgba(255,255,255,0.06)"
      stroke="rgba(255,255,255,0.35)"
      strokeWidth={1}
      dash={[4, 4]}
      listening={false}
    />
  )
}
```

- [ ] **Step 3: Create the shape router**

`src/features/shapes-konva/components/shape-router.tsx`:

```tsx
import type { ShapeProps } from '../types'
import { DeferredShapePlaceholder } from '../shapes/deferred-shape-placeholder'

export function ShapeRouter(props: ShapeProps) {
  const { item } = props
  switch (item.shapeType) {
    // Active variants — implemented in later tasks. Until those land,
    // route to the placeholder so the build is green and existing items
    // render visibly.
    case 'rectangle':
    case 'circle':
    case 'ellipse':
    case 'triangle':
    case 'polygon':
    case 'arrow':
    case 'free-polygon':
      return <DeferredShapePlaceholder item={item} />

    // Deferred variants — render placeholder permanently in v0.
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

(Each active case is filled in by its own later task. The placeholder is a temporary stub so the build and mounting work end to end.)

- [ ] **Step 4: Create the shapes stage**

`src/features/shapes-konva/components/shapes-stage.tsx`:

```tsx
import { useMemo, useCallback } from 'react'
import { Stage, Layer } from 'react-konva'
import { useTimelineStore } from '../deps/timeline'
import { usePlaybackStore } from '../deps/playback'
import { useSelectionStore } from '../deps/selection'
import type { ShapeItem } from '../deps/timeline'
import type { ShapeCallbacks } from '../types'
import { sortShapesByTrackOrder } from '../utils/track-order'
import { useDrawToolStore } from '../stores/draw-tool-store'
import { ShapeRouter } from './shape-router'

interface ShapesStageProps {
  width: number
  height: number
}

export function ShapesStage({ width, height }: ShapesStageProps) {
  const items = useTimelineStore((s) => s.items)
  const tracks = useTimelineStore((s) => s.tracks)
  const currentFrame = usePlaybackStore((s) => s.currentFrame)
  const selectedId = useSelectionStore((s) => s.selectedItemId)
  const setSelection = useSelectionStore((s) => s.setSelection)
  const drawKind = useDrawToolStore((s) => s.state.kind)

  const trackOrderFor = useCallback(
    (trackId: string) => tracks.find((t) => t.id === trackId)?.order ?? 0,
    [tracks],
  )

  const visibleShapes = useMemo<ShapeItem[]>(() => {
    const shapeItems = items.filter(
      (it): it is ShapeItem =>
        it.type === 'shape' &&
        currentFrame >= it.from &&
        currentFrame < it.from + it.durationInFrames,
    )
    return sortShapesByTrackOrder(shapeItems, trackOrderFor)
  }, [items, currentFrame, trackOrderFor])

  const callbacks = useMemo<ShapeCallbacks>(
    () => ({
      onSelect: (id) => setSelection(id),
      onMove: (id, x, y) => useTimelineStore.getState().updateItem?.(id, { x, y }),
      onUpdateData: (id, patch) => useTimelineStore.getState().updateItem?.(id, patch),
      onUpdateVertex: (_id, _idx, _x, _y) => {
        // wired in Task 10 (update-vertex action)
      },
    }),
    [setSelection],
  )

  // Pointer events: take them only when the user is drawing or has a
  // shape selected. Otherwise pass through to layers below.
  const interactive = drawKind !== 'idle' || selectedId !== null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    >
      <Stage width={width} height={height}>
        <Layer>
          {visibleShapes.map((item) => (
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
    </div>
  )
}
```

(If `updateItem` isn't the canonical update action on the timeline store facade, locate the right one via `rg 'updateItem|updateShape' src/features/timeline/stores` and adjust the deps adapter to re-export it. Same for `tracks` shape — match what the facade exposes.)

- [ ] **Step 5: Create the public barrel**

`src/features/shapes-konva/index.ts`:

```ts
export { ShapesStage } from './components/shapes-stage'
export { useDrawToolStore } from './stores/draw-tool-store'
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build succeeds. The stage is created but not yet mounted; nothing renders in the app.

---

## Task 8: Mount `<ShapesStage />` in preview-stage.tsx

**Files:**
- Modify: `src/features/preview/components/preview-stage.tsx`

- [ ] **Step 1: Read the preview stage**

Open `src/features/preview/components/preview-stage.tsx`. Find where `scrubCanvasRef` is rendered and where `gpuEffectsCanvasRef` is rendered — the new stage goes *between* them in the JSX (so it renders above scrub canvas, below the live-effects overlay).

- [ ] **Step 2: Import the stage**

Add:

```ts
import { ShapesStage } from '@/features/shapes-konva'
```

- [ ] **Step 3: Read project dimensions**

`ShapesStage` needs `width` / `height`. Use whatever the preview stage already uses for the scrub canvas size (commonly read from a project store or composition store). Reuse exactly the same source so the stage stays sized to the preview canvas.

- [ ] **Step 4: Insert the stage**

Place this JSX between the scrub canvas and the GPU-effects canvas:

```tsx
<ShapesStage width={projectWidth} height={projectHeight} />
```

(replace `projectWidth` / `projectHeight` with the names actually used in the file).

- [ ] **Step 5: Verify the build + visual**

Run: `npm run build && npm run dev`
Expected: build passes; opening the editor shows the same preview as before with no visible shape overlay (no shape items exist yet in a fresh project, and the stage's `pointer-events` defaults to `none`).

---

## Task 9: Endpoint handle (shared) + reusable handle pattern

**Files:**
- Create: `src/features/shapes-konva/shapes/endpoint-handle.tsx`

A single small handle component used by both `ArrowShape` (2 endpoints) and `FreePolygonShape` (N vertices).

- [ ] **Step 1: Create the component**

`src/features/shapes-konva/shapes/endpoint-handle.tsx`:

```tsx
import { Circle } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'

interface EndpointHandleProps {
  x: number
  y: number
  onDrag(x: number, y: number): void
}

export function EndpointHandle({ x, y, onDrag }: EndpointHandleProps) {
  return (
    <Circle
      x={x}
      y={y}
      radius={6}
      fill="#FFFFFF"
      stroke="#1845C8"
      strokeWidth={2}
      draggable
      onDragMove={(e: KonvaEventObject<DragEvent>) => onDrag(e.target.x(), e.target.y())}
      onMouseEnter={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = 'move'
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = ''
      }}
    />
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

---

## Task 10: Create-arrow + create-free-polygon + update-vertex actions

**Files:**
- Create: `src/features/shapes-konva/stores/actions/create-arrow.ts`
- Create: `src/features/shapes-konva/stores/actions/create-free-polygon.ts`
- Create: `src/features/shapes-konva/stores/actions/update-vertex.ts`
- Test: `src/features/shapes-konva/stores/actions/create-shapes.test.ts`

These wrap the timeline-store's add-item action so undo/redo work. The user's app uses `Zundo` for undo/redo on timeline mutations; we simply call the existing add-item path through the timeline store facade.

- [ ] **Step 1: Inspect the existing add-shape pattern**

Run: `npx --no-install rg "addShape|createShape|addItem" src/features/timeline/stores -l`
Note the canonical action that creates a `shape`-type `TimelineItem`. The new actions wrap that same call with shape-specific defaults.

- [ ] **Step 2: Implement the create-arrow action**

`src/features/shapes-konva/stores/actions/create-arrow.ts`:

```ts
import { useTimelineStore } from '../../deps/timeline'
import { ARROW_DEFAULTS } from '../../utils/defaults'

interface CreateArrowInput {
  fromX: number
  fromY: number
  toX: number
  toY: number
  frame: number
  fps: number
  trackId?: string
}

export function createArrow(input: CreateArrowInput): string {
  const { fromX, fromY, toX, toY, frame, fps, trackId } = input
  // Normalize to item-local coordinates: store the tail as the item origin
  // and the head relative to it. Mirrors the legacy Polygon2D pattern.
  const x = fromX
  const y = fromY
  const arrowData = {
    fromX: 0,
    fromY: 0,
    toX: toX - fromX,
    toY: toY - fromY,
    pointerLength: ARROW_DEFAULTS.pointerLength,
    pointerWidth: ARROW_DEFAULTS.pointerWidth,
    dash: ARROW_DEFAULTS.dash,
  }
  const durationInFrames = fps * 5
  // Locate the right add-item / add-shape action on the timeline facade.
  // Fall back to a generic `addItem` if no specialized action exists.
  const id = useTimelineStore.getState().addItem({
    type: 'shape',
    shapeType: 'arrow',
    x,
    y,
    width: Math.abs(toX - fromX) + ARROW_DEFAULTS.pointerLength,
    height: Math.abs(toY - fromY) + ARROW_DEFAULTS.pointerLength,
    stroke: ARROW_DEFAULTS.stroke,
    fill: ARROW_DEFAULTS.fill,
    strokeWidth: ARROW_DEFAULTS.strokeWidth,
    from: frame,
    durationInFrames,
    trackId,
    arrowData,
  })
  return id
}
```

(If `addItem` isn't the exact action name, replace with the one located in Step 1 — keep the call shape identical and adjust the parameter object to match the timeline store's expectations.)

- [ ] **Step 3: Implement the create-free-polygon action**

`src/features/shapes-konva/stores/actions/create-free-polygon.ts`:

```ts
import { useTimelineStore } from '../../deps/timeline'
import { FREE_POLYGON_DEFAULTS } from '../../utils/defaults'

interface CreateFreePolygonInput {
  vertices: number[]   // absolute coords, flat [x0,y0,x1,y1,…]
  frame: number
  fps: number
  trackId?: string
}

export function createFreePolygon(input: CreateFreePolygonInput): string {
  const { vertices, frame, fps, trackId } = input
  if (vertices.length < 6) {
    throw new Error('Polygon requires at least 3 vertices')
  }
  // Normalize: find bounding box, anchor item at top-left, store
  // vertices relative to the origin.
  let minX = vertices[0]
  let minY = vertices[1]
  let maxX = vertices[0]
  let maxY = vertices[1]
  for (let i = 0; i < vertices.length; i += 2) {
    minX = Math.min(minX, vertices[i] ?? 0)
    minY = Math.min(minY, vertices[i + 1] ?? 0)
    maxX = Math.max(maxX, vertices[i] ?? 0)
    maxY = Math.max(maxY, vertices[i + 1] ?? 0)
  }
  const relative = vertices.map((v, i) => (i % 2 === 0 ? v - minX : v - minY))

  const id = useTimelineStore.getState().addItem({
    type: 'shape',
    shapeType: 'free-polygon',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    stroke: FREE_POLYGON_DEFAULTS.stroke,
    fill: FREE_POLYGON_DEFAULTS.fill,
    strokeWidth: FREE_POLYGON_DEFAULTS.strokeWidth,
    from: frame,
    durationInFrames: fps * 5,
    trackId,
    freePolygonData: {
      vertices: relative,
      closed: FREE_POLYGON_DEFAULTS.closed,
    },
  })
  return id
}
```

- [ ] **Step 4: Implement the update-vertex action**

`src/features/shapes-konva/stores/actions/update-vertex.ts`:

```ts
import { useTimelineStore } from '../../deps/timeline'
import type { ShapeItem } from '../../deps/timeline'

/**
 * Move one vertex of a free-polygon or one endpoint of an arrow.
 * Coordinates are in item-local space. Routes through the timeline
 * facade's updateItem so undo/redo is correct.
 */
export function updateVertex(itemId: string, index: number, x: number, y: number): void {
  const items = useTimelineStore.getState().items as ShapeItem[]
  const item = items.find((it) => it.id === itemId)
  if (!item || item.type !== 'shape') return

  if (item.shapeType === 'arrow' && item.arrowData) {
    const next = { ...item.arrowData }
    if (index === 0) {
      next.fromX = x
      next.fromY = y
    } else if (index === 1) {
      next.toX = x
      next.toY = y
    } else return
    useTimelineStore.getState().updateItem?.(itemId, { arrowData: next })
    return
  }

  if (item.shapeType === 'free-polygon' && item.freePolygonData) {
    const v = [...item.freePolygonData.vertices]
    v[index * 2] = x
    v[index * 2 + 1] = y
    useTimelineStore
      .getState()
      .updateItem?.(itemId, { freePolygonData: { ...item.freePolygonData, vertices: v } })
    return
  }
}
```

- [ ] **Step 5: Wire `onUpdateVertex` in the stage**

In `shapes-stage.tsx`, replace the placeholder callback:

```ts
onUpdateVertex: (_id, _idx, _x, _y) => {
  // wired in Task 10 (update-vertex action)
},
```

with:

```ts
onUpdateVertex: (id, idx, x, y) => updateVertex(id, idx, x, y),
```

Import: `import { updateVertex } from '../stores/actions/update-vertex'`.

- [ ] **Step 6: Write unit tests**

Create `src/features/shapes-konva/stores/actions/create-shapes.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const addItemMock = vi.fn(() => 'mock-id')
const updateItemMock = vi.fn()
let mockItems: any[] = []

vi.mock('../../deps/timeline', () => ({
  useTimelineStore: Object.assign(
    (selector: (s: any) => unknown) => selector({ items: mockItems }),
    {
      getState: () => ({ items: mockItems, addItem: addItemMock, updateItem: updateItemMock }),
    },
  ),
}))

import { createArrow } from './create-arrow'
import { createFreePolygon } from './create-free-polygon'
import { updateVertex } from './update-vertex'

describe('create-arrow', () => {
  beforeEach(() => {
    addItemMock.mockClear()
    updateItemMock.mockClear()
    mockItems = []
  })

  it('creates an arrow item with arrowData normalized to item origin', () => {
    const id = createArrow({ fromX: 100, fromY: 50, toX: 200, toY: 80, frame: 30, fps: 60 })
    expect(id).toBe('mock-id')
    expect(addItemMock).toHaveBeenCalledOnce()
    const payload = addItemMock.mock.calls[0]?.[0]
    expect(payload?.type).toBe('shape')
    expect(payload?.shapeType).toBe('arrow')
    expect(payload?.x).toBe(100)
    expect(payload?.y).toBe(50)
    expect(payload?.arrowData?.fromX).toBe(0)
    expect(payload?.arrowData?.fromY).toBe(0)
    expect(payload?.arrowData?.toX).toBe(100)
    expect(payload?.arrowData?.toY).toBe(30)
    expect(payload?.from).toBe(30)
    expect(payload?.durationInFrames).toBe(300)
  })
})

describe('create-free-polygon', () => {
  beforeEach(() => {
    addItemMock.mockClear()
  })

  it('normalizes vertices to be item-local from the top-left', () => {
    const id = createFreePolygon({
      vertices: [100, 100, 200, 100, 150, 200],
      frame: 0,
      fps: 60,
    })
    expect(id).toBe('mock-id')
    const payload = addItemMock.mock.calls[0]?.[0]
    expect(payload?.x).toBe(100)
    expect(payload?.y).toBe(100)
    expect(payload?.freePolygonData?.vertices).toEqual([0, 0, 100, 0, 50, 100])
    expect(payload?.freePolygonData?.closed).toBe(true)
  })

  it('rejects polygons with fewer than 3 vertices', () => {
    expect(() => createFreePolygon({ vertices: [0, 0, 10, 10], frame: 0, fps: 60 })).toThrow()
  })
})

describe('update-vertex', () => {
  beforeEach(() => {
    updateItemMock.mockClear()
  })

  it('updates an arrow head endpoint via index=1', () => {
    mockItems = [
      {
        id: 'a',
        type: 'shape',
        shapeType: 'arrow',
        arrowData: { fromX: 0, fromY: 0, toX: 100, toY: 0 },
      },
    ]
    updateVertex('a', 1, 200, 50)
    expect(updateItemMock).toHaveBeenCalledWith('a', {
      arrowData: { fromX: 0, fromY: 0, toX: 200, toY: 50 },
    })
  })

  it('updates a free-polygon vertex by index', () => {
    mockItems = [
      {
        id: 'p',
        type: 'shape',
        shapeType: 'free-polygon',
        freePolygonData: { vertices: [0, 0, 100, 0, 50, 100], closed: true },
      },
    ]
    updateVertex('p', 1, 120, 10)
    expect(updateItemMock).toHaveBeenCalledWith('p', {
      freePolygonData: { vertices: [0, 0, 120, 10, 50, 100], closed: true },
    })
  })
})
```

- [ ] **Step 7: Run the tests**

Run: `npm run test:run -- src/features/shapes-konva/stores/actions`
Expected: 5/5 tests pass.

---

## Task 11: ArrowShape component

**Files:**
- Create: `src/features/shapes-konva/shapes/arrow-shape.tsx`
- Modify: `src/features/shapes-konva/components/shape-router.tsx`

- [ ] **Step 1: Implement the component**

`src/features/shapes-konva/shapes/arrow-shape.tsx`:

```tsx
import { Arrow, Group } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { EndpointHandle } from './endpoint-handle'
import { ARROW_DEFAULTS, dashToArray } from '../utils/defaults'
import type { ShapeProps } from '../types'

export function ArrowShape({ item, isSelected, callbacks }: ShapeProps) {
  const a = item.arrowData
  if (!a) return null

  const stroke = item.stroke ?? ARROW_DEFAULTS.stroke
  const fill = item.fill ?? ARROW_DEFAULTS.fill
  const strokeWidth = item.strokeWidth ?? ARROW_DEFAULTS.strokeWidth
  const pointerLength = a.pointerLength ?? ARROW_DEFAULTS.pointerLength
  const pointerWidth = a.pointerWidth ?? ARROW_DEFAULTS.pointerWidth
  const dash = dashToArray(a.dash)

  return (
    <Group
      x={item.x ?? 0}
      y={item.y ?? 0}
      draggable={isSelected}
      onClick={() => callbacks.onSelect(item.id)}
      onTap={() => callbacks.onSelect(item.id)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) =>
        callbacks.onMove(item.id, e.target.x(), e.target.y())
      }
    >
      <Arrow
        points={[a.fromX, a.fromY, a.toX, a.toY]}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        pointerLength={pointerLength}
        pointerWidth={pointerWidth}
        dash={dash}
        shadowColor={ARROW_DEFAULTS.shadowColor}
        shadowBlur={ARROW_DEFAULTS.shadowBlur}
        shadowOffsetX={ARROW_DEFAULTS.shadowOffsetX}
        shadowOffsetY={ARROW_DEFAULTS.shadowOffsetY}
        shadowOpacity={ARROW_DEFAULTS.shadowOpacity}
      />
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
    </Group>
  )
}
```

- [ ] **Step 2: Register in the router**

In `shape-router.tsx`, change the `case 'arrow':` line:

```ts
case 'arrow':         return <ArrowShape {...props} />
```

Add the import: `import { ArrowShape } from '../shapes/arrow-shape'`.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds. Arrows aren't yet creatable (Task 13 ships the draw tool), but the router branch is in place.

---

## Task 12: FreePolygonShape component

**Files:**
- Create: `src/features/shapes-konva/shapes/free-polygon-shape.tsx`
- Modify: `src/features/shapes-konva/components/shape-router.tsx`

- [ ] **Step 1: Implement the component**

`src/features/shapes-konva/shapes/free-polygon-shape.tsx`:

```tsx
import { Group, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { EndpointHandle } from './endpoint-handle'
import { FREE_POLYGON_DEFAULTS } from '../utils/defaults'
import type { ShapeProps } from '../types'

export function FreePolygonShape({ item, isSelected, callbacks }: ShapeProps) {
  const data = item.freePolygonData
  if (!data) return null

  const fill = item.fill ?? FREE_POLYGON_DEFAULTS.fill
  const stroke = item.stroke ?? FREE_POLYGON_DEFAULTS.stroke
  const strokeWidth = item.strokeWidth ?? FREE_POLYGON_DEFAULTS.strokeWidth

  return (
    <Group
      x={item.x ?? 0}
      y={item.y ?? 0}
      draggable={isSelected}
      onClick={() => callbacks.onSelect(item.id)}
      onTap={() => callbacks.onSelect(item.id)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) =>
        callbacks.onMove(item.id, e.target.x(), e.target.y())
      }
    >
      <Line
        points={data.vertices}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        closed={data.closed}
      />
      {isSelected &&
        Array.from({ length: data.vertices.length / 2 }, (_, i) => {
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
    </Group>
  )
}
```

- [ ] **Step 2: Register in the router**

In `shape-router.tsx`, change the `case 'free-polygon':` line:

```ts
case 'free-polygon':  return <FreePolygonShape {...props} />
```

Add the import: `import { FreePolygonShape } from '../shapes/free-polygon-shape'`.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

---

## Task 13: Draw-arrow tool overlay (click-and-drag)

**Files:**
- Create: `src/features/shapes-konva/components/draw-arrow-tool.tsx`
- Modify: `src/features/shapes-konva/components/shapes-stage.tsx`

- [ ] **Step 1: Create the draw-arrow overlay**

`src/features/shapes-konva/components/draw-arrow-tool.tsx`:

```tsx
import { useState, useCallback } from 'react'
import { Arrow } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useDrawToolStore } from '../stores/draw-tool-store'
import { createArrow } from '../stores/actions/create-arrow'
import { usePlaybackStore } from '../deps/playback'
import { ARROW_DEFAULTS } from '../utils/defaults'

interface DrawArrowToolProps {
  fps: number
}

/**
 * Renders the rubber-band arrow preview while the user drags. Lives
 * inside the Konva Stage's Layer (so it shares coordinates with the
 * shapes layer). Listens for stage pointer events.
 */
export function DrawArrowTool({ fps }: DrawArrowToolProps) {
  const state = useDrawToolStore((s) => s.state)
  const setTail = useDrawToolStore((s) => s.setArrowTail)
  const cancel = useDrawToolStore((s) => s.cancel)
  const currentFrame = usePlaybackStore((s) => s.currentFrame)
  const [head, setHead] = useState<{ x: number; y: number } | null>(null)

  // Stage-level event handlers wired by the parent stage in step 2 below.
  // We expose them as a small interface via globalThis for the stage to
  // delegate to; alternatively, the stage component intercepts pointer
  // events itself and dispatches into this state.
  const onPointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (state.kind !== 'drawing-arrow') return
      const pos = e.target.getStage()?.getPointerPosition()
      if (!pos) return
      setTail(pos.x, pos.y)
      setHead({ x: pos.x, y: pos.y })
    },
    [state.kind, setTail],
  )

  const onPointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (state.kind !== 'drawing-arrow' || state.tail === null) return
      const pos = e.target.getStage()?.getPointerPosition()
      if (!pos) return
      setHead({ x: pos.x, y: pos.y })
    },
    [state],
  )

  const onPointerUp = useCallback(() => {
    if (state.kind !== 'drawing-arrow') return
    const tail = state.tail
    if (!tail || !head) {
      cancel()
      return
    }
    const dx = head.x - tail.x
    const dy = head.y - tail.y
    if (Math.hypot(dx, dy) < 10) {
      cancel()
      setHead(null)
      return
    }
    createArrow({ fromX: tail.x, fromY: tail.y, toX: head.x, toY: head.y, frame: currentFrame, fps })
    cancel()
    setHead(null)
  }, [state, head, cancel, currentFrame, fps])

  // Render the rubber-band preview when both tail and head are set.
  if (state.kind !== 'drawing-arrow' || state.tail === null || head === null) {
    return { onPointerDown, onPointerMove, onPointerUp, preview: null } as const
  }
  const preview = (
    <Arrow
      points={[state.tail.x, state.tail.y, head.x, head.y]}
      fill={ARROW_DEFAULTS.fill}
      stroke={ARROW_DEFAULTS.stroke}
      strokeWidth={ARROW_DEFAULTS.strokeWidth}
      pointerLength={ARROW_DEFAULTS.pointerLength}
      pointerWidth={ARROW_DEFAULTS.pointerWidth}
      opacity={0.7}
      listening={false}
    />
  )
  return { onPointerDown, onPointerMove, onPointerUp, preview } as const
}
```

- [ ] **Step 2: Wire it into the stage**

In `shapes-stage.tsx`, import the tool hook and attach its pointer handlers to the `<Stage>`. Render the preview inside the Layer:

```tsx
import { DrawArrowTool } from './draw-arrow-tool'
// …
const fps = useTimelineStore((s) => s.fps) ?? 60
const arrowTool = DrawArrowTool({ fps })
// inside the Stage element:
<Stage
  width={width}
  height={height}
  onPointerDown={arrowTool.onPointerDown}
  onPointerMove={arrowTool.onPointerMove}
  onPointerUp={arrowTool.onPointerUp}
>
  <Layer>
    {visibleShapes.map(...)}
    {arrowTool.preview}
  </Layer>
</Stage>
```

(If `fps` isn't exposed by the timeline facade, locate the project FPS reader via `rg 'fps' src/features/timeline/stores` and use it.)

- [ ] **Step 3: Verify build + manual smoke**

Run: `npm run build`
Then `npm run dev`. Click the Arrow toolbar button → cursor stays in default mode (we'll add a cross-hair cursor later if desired). Click and drag on the preview → a rubber-band arrow follows. Release → arrow committed; appears as a selected shape with two endpoint handles. Esc → handled by the next task; for now, clicking the toolbar button again toggles `idle`.

---

## Task 14: Draw-polygon tool overlay (click-to-add-vertex)

**Files:**
- Create: `src/features/shapes-konva/components/draw-polygon-tool.tsx`
- Modify: `src/features/shapes-konva/components/shapes-stage.tsx`

- [ ] **Step 1: Implement the tool**

`src/features/shapes-konva/components/draw-polygon-tool.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react'
import { Line, Circle } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useDrawToolStore } from '../stores/draw-tool-store'
import { createFreePolygon } from '../stores/actions/create-free-polygon'
import { usePlaybackStore } from '../deps/playback'
import { FREE_POLYGON_DEFAULTS } from '../utils/defaults'

const CLOSE_LOOP_RADIUS = 8

interface DrawPolygonToolProps {
  fps: number
}

export function DrawPolygonTool({ fps }: DrawPolygonToolProps) {
  const state = useDrawToolStore((s) => s.state)
  const append = useDrawToolStore((s) => s.appendPolygonVertex)
  const cancel = useDrawToolStore((s) => s.cancel)
  const currentFrame = usePlaybackStore((s) => s.currentFrame)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const finish = useCallback(
    (vertices: number[]) => {
      if (vertices.length < 6) {
        cancel()
        return
      }
      createFreePolygon({ vertices, frame: currentFrame, fps })
      cancel()
      setCursor(null)
    },
    [cancel, currentFrame, fps],
  )

  const onClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (state.kind !== 'drawing-polygon') return
      const pos = e.target.getStage()?.getPointerPosition()
      if (!pos) return
      const v = state.vertices
      // Close-loop click on first vertex
      if (v.length >= 6) {
        const fx = v[0] ?? 0
        const fy = v[1] ?? 0
        if (Math.hypot(pos.x - fx, pos.y - fy) <= CLOSE_LOOP_RADIUS) {
          finish(v)
          return
        }
      }
      append(pos.x, pos.y)
    },
    [state, append, finish],
  )

  const onPointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (state.kind !== 'drawing-polygon') return
      const pos = e.target.getStage()?.getPointerPosition()
      if (!pos) return
      setCursor(pos)
    },
    [state.kind],
  )

  const onDblClick = useCallback(() => {
    if (state.kind !== 'drawing-polygon') return
    finish(state.vertices)
  }, [state, finish])

  useEffect(() => {
    if (state.kind !== 'drawing-polygon') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') finish(state.vertices)
      else if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, finish, cancel])

  if (state.kind !== 'drawing-polygon') {
    return { onClick, onPointerMove, onDblClick, preview: null } as const
  }

  const previewPoints = cursor
    ? [...state.vertices, cursor.x, cursor.y]
    : state.vertices
  const preview = (
    <>
      <Line
        points={previewPoints}
        stroke={FREE_POLYGON_DEFAULTS.stroke}
        strokeWidth={FREE_POLYGON_DEFAULTS.strokeWidth}
        dash={[6, 4]}
        opacity={0.7}
        listening={false}
      />
      {state.vertices.length >= 2 &&
        Array.from({ length: state.vertices.length / 2 }, (_, i) => (
          <Circle
            key={i}
            x={state.vertices[i * 2] ?? 0}
            y={state.vertices[i * 2 + 1] ?? 0}
            radius={4}
            fill="#FFFFFF"
            stroke="#1845C8"
            strokeWidth={1.5}
            listening={false}
          />
        ))}
    </>
  )
  return { onClick, onPointerMove, onDblClick, preview } as const
}
```

- [ ] **Step 2: Wire it into the stage**

In `shapes-stage.tsx`, similar to the arrow tool:

```tsx
import { DrawPolygonTool } from './draw-polygon-tool'
// …
const polygonTool = DrawPolygonTool({ fps })
```

Update the Stage element to wire both tools' handlers (composed — each tool short-circuits when its mode isn't active, so both can be attached simultaneously):

```tsx
<Stage
  width={width}
  height={height}
  onPointerDown={(e) => {
    arrowTool.onPointerDown(e)
  }}
  onPointerMove={(e) => {
    arrowTool.onPointerMove(e)
    polygonTool.onPointerMove(e)
  }}
  onPointerUp={(e) => {
    arrowTool.onPointerUp(e)
  }}
  onClick={(e) => {
    polygonTool.onClick(e)
  }}
  onDblClick={() => {
    polygonTool.onDblClick()
  }}
>
  <Layer>
    {visibleShapes.map(...)}
    {arrowTool.preview}
    {polygonTool.preview}
  </Layer>
</Stage>
```

Also: when the draw tool is `idle` and nothing is selected, the stage's `pointer-events: none` is already correctly set by the existing `interactive` derived value. When a draw tool activates, `pointer-events` flips to `auto`.

- [ ] **Step 3: Verify build + manual smoke**

Run: `npm run build && npm run dev`. Open the editor. Click the Polygon toolbar button → click 4 points on the preview canvas → double-click → polygon appears, selected, with handles on every vertex. Click outside → handles hide. Drag a vertex → polygon updates. Drag the body → translates. Press Esc during draw → cancels.

---

## Task 15: Port the 5 parametric shape components

**Files:**
- Create: `src/features/shapes-konva/shapes/rectangle-shape.tsx`
- Create: `src/features/shapes-konva/shapes/circle-shape.tsx`
- Create: `src/features/shapes-konva/shapes/ellipse-shape.tsx`
- Create: `src/features/shapes-konva/shapes/triangle-shape.tsx`
- Create: `src/features/shapes-konva/shapes/regular-polygon-shape.tsx`
- Modify: `src/features/shapes-konva/components/shape-router.tsx`

Each component is small and follows the same `(item, isSelected, callbacks)` shape.

- [ ] **Step 1: Implement `rectangle-shape.tsx`**

```tsx
import { Group, Rect } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import type { ShapeProps } from '../types'

export function RectangleShape({ item, isSelected, callbacks }: ShapeProps) {
  return (
    <Group
      x={item.x ?? 0}
      y={item.y ?? 0}
      rotation={item.rotation ?? 0}
      draggable={isSelected}
      onClick={() => callbacks.onSelect(item.id)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) =>
        callbacks.onMove(item.id, e.target.x(), e.target.y())
      }
    >
      <Rect
        width={item.width ?? 100}
        height={item.height ?? 100}
        cornerRadius={item.cornerRadius ?? 0}
        fill={item.fill ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.stroke ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </Group>
  )
}
```

- [ ] **Step 2: Implement `circle-shape.tsx`**

```tsx
import { Group, Circle } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import type { ShapeProps } from '../types'

export function CircleShape({ item, isSelected, callbacks }: ShapeProps) {
  const r = Math.min(item.width ?? 100, item.height ?? 100) / 2
  return (
    <Group
      x={(item.x ?? 0) + r}
      y={(item.y ?? 0) + r}
      rotation={item.rotation ?? 0}
      draggable={isSelected}
      onClick={() => callbacks.onSelect(item.id)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) =>
        callbacks.onMove(item.id, e.target.x() - r, e.target.y() - r)
      }
    >
      <Circle
        radius={r}
        fill={item.fill ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.stroke ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </Group>
  )
}
```

- [ ] **Step 3: Implement `ellipse-shape.tsx`**

```tsx
import { Group, Ellipse } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import type { ShapeProps } from '../types'

export function EllipseShape({ item, isSelected, callbacks }: ShapeProps) {
  const rx = (item.width ?? 100) / 2
  const ry = (item.height ?? 100) / 2
  return (
    <Group
      x={(item.x ?? 0) + rx}
      y={(item.y ?? 0) + ry}
      rotation={item.rotation ?? 0}
      draggable={isSelected}
      onClick={() => callbacks.onSelect(item.id)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) =>
        callbacks.onMove(item.id, e.target.x() - rx, e.target.y() - ry)
      }
    >
      <Ellipse
        radiusX={rx}
        radiusY={ry}
        fill={item.fill ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.stroke ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </Group>
  )
}
```

- [ ] **Step 4: Implement `triangle-shape.tsx`**

```tsx
import { Group, RegularPolygon } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import type { ShapeProps } from '../types'

export function TriangleShape({ item, isSelected, callbacks }: ShapeProps) {
  const radius = Math.min(item.width ?? 100, item.height ?? 100) / 2
  return (
    <Group
      x={(item.x ?? 0) + radius}
      y={(item.y ?? 0) + radius}
      rotation={item.rotation ?? 0}
      draggable={isSelected}
      onClick={() => callbacks.onSelect(item.id)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) =>
        callbacks.onMove(item.id, e.target.x() - radius, e.target.y() - radius)
      }
    >
      <RegularPolygon
        sides={3}
        radius={radius}
        fill={item.fill ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.stroke ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </Group>
  )
}
```

- [ ] **Step 5: Implement `regular-polygon-shape.tsx`**

```tsx
import { Group, RegularPolygon } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { PARAMETRIC_SHAPE_DEFAULTS } from '../utils/defaults'
import type { ShapeProps } from '../types'

export function RegularPolygonShape({ item, isSelected, callbacks }: ShapeProps) {
  const radius = Math.min(item.width ?? 100, item.height ?? 100) / 2
  const sides = Math.max(3, item.points ?? 6)
  return (
    <Group
      x={(item.x ?? 0) + radius}
      y={(item.y ?? 0) + radius}
      rotation={item.rotation ?? 0}
      draggable={isSelected}
      onClick={() => callbacks.onSelect(item.id)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) =>
        callbacks.onMove(item.id, e.target.x() - radius, e.target.y() - radius)
      }
    >
      <RegularPolygon
        sides={sides}
        radius={radius}
        fill={item.fill ?? PARAMETRIC_SHAPE_DEFAULTS.fill}
        stroke={item.stroke ?? PARAMETRIC_SHAPE_DEFAULTS.stroke}
        strokeWidth={item.strokeWidth ?? PARAMETRIC_SHAPE_DEFAULTS.strokeWidth}
      />
    </Group>
  )
}
```

- [ ] **Step 6: Register all five in the router**

Update `shape-router.tsx` cases:

```ts
case 'rectangle':    return <RectangleShape {...props} />
case 'circle':       return <CircleShape {...props} />
case 'ellipse':      return <EllipseShape {...props} />
case 'triangle':     return <TriangleShape {...props} />
case 'polygon':      return <RegularPolygonShape {...props} />
```

Add the five imports.

- [ ] **Step 7: Verify the build**

Run: `npm run build`
Expected: build succeeds.

---

## Task 16: Gate the GPU shape branch in render-item.ts

**Files:**
- Modify: `src/features/export/utils/canvas-item-renderer/render-item.ts`

This stops the GPU SDF / Canvas-2D shape path from rendering shape items into the composite canvas. From now on, shape items render exclusively through the Konva stage.

- [ ] **Step 1: Open render-item.ts and locate the shape branch**

Open `src/features/export/utils/canvas-item-renderer/render-item.ts`. Find the `case 'shape':` (or `case ItemType.Shape:`) branch.

- [ ] **Step 2: Replace the body with the gated comment block**

Replace whatever code lives inside the `case 'shape':` branch with:

```ts
case 'shape':
  // MatchView strip-down (Konva renderer): shape items are rendered by
  // the Konva stage in the preview overlay (src/features/shapes-konva/),
  // not in this composite canvas. The original GPU-SDF / Canvas-2D path
  // is kept here as commented restoration text.
  // Original code:
  // renderShape(ctx, effectiveItem as ShapeItem, resolveItemTransform(transform), {
  //   width: rctx.canvasSettings.width,
  //   height: rctx.canvasSettings.height,
  // })
  // For export rendering, shape items are also a no-op in v0; future work
  // will rasterize the Konva stage into the export pipeline. Warn once
  // per export so users know shapes are deferred from export output:
  if (rctx.renderMode === 'export' && !rctx.warnedShapeExportMissing) {
    log.warn('Shape items are not yet rasterized in export output')
    rctx.warnedShapeExportMissing = true
  }
  break
```

(Replace the `renderShape` line text with the actual one already in the file before commenting. If the surrounding code uses different identifiers — e.g. `resolveItemTransform` vs `resolveTransform` — keep the originals in the comment body so the restoration text is accurate.)

- [ ] **Step 3: Add the `warnedShapeExportMissing` flag**

If the render context type doesn't already have a `warnedShapeExportMissing` field, add it as an optional `boolean` member of the relevant `ItemRenderContext` type (locate via `rg 'warnedShapeExportMissing|renderMode' src/features/export/utils/canvas-item-renderer -l` if needed). If touching the type is more invasive than warranted, drop the warning to a plain `log.warn` without the dedupe flag — the user accepts a per-frame warning during export in v0.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds. Existing projects load and render shapes via the Konva stage (the new active path); the old composite-canvas path no longer paints shapes.

---

## Task 17: Restore the Shapes sidebar rail tab

**Files:**
- Modify: `src/features/editor/components/media-sidebar.tsx`

The earlier strip-down hid the Shapes tab. Restore it now since we own shape rendering.

- [ ] **Step 1: Find the Shapes tab commented or removed code**

Open `media-sidebar.tsx`. Earlier work either removed or commented out the Shapes rail entry + its panel. Locate the commented block via `npx --no-install rg -i 'shape' src/features/editor/components/media-sidebar.tsx`.

- [ ] **Step 2: Restore the rail entry + panel**

Uncomment / reintroduce only the parts that drag-add the 5 supported parametric shape types: rectangle, circle, ellipse, triangle, polygon (N-gon). For each of star, heart, and pen-tool: leave the tile JSX **commented out** with a brief restoration note:

```tsx
{/*
  // MatchView v0 deferred: re-enable when the Konva component for these
  // shape types ships. See docs/superpowers/specs/2026-05-24-konva-shape-renderer-design.md
  <ShapeTile shape="star" />
  <ShapeTile shape="heart" />
  <PenToolTile />
*/}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`. The Media sidebar shows a Shapes rail tab. Open it → 5 shape tiles visible (no star/heart/pen). Drag a rectangle onto the timeline → it appears as a clip; the preview shows the rectangle through Konva.

---

## Task 18: TacticalColorPresets component

**Files:**
- Create: `src/features/shapes-konva/components/tactical-color-presets.tsx`

A small swatch strip that, when clicked, applies a fill (semi-transparent) + stroke (full opacity) to the selected shape.

- [ ] **Step 1: Implement the component**

```tsx
import { TACTICAL_PRESET_COLORS } from '../utils/defaults'
import { cn } from '@/shared/ui/cn'

interface Props {
  /** Current fill — used to highlight the active preset, if any. */
  currentFill?: string
  onPick(fill: string, stroke: string): void
  className?: string
}

/** Converts `#RRGGBB` to `rgba(...,0.18)` for tactical-zone fills. */
function toFill(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.18)`
}

export function TacticalColorPresets({ currentFill, onPick, className }: Props) {
  return (
    <div className={cn('flex items-center gap-1.5', className)} role="group" aria-label="Tactical color presets">
      {TACTICAL_PRESET_COLORS.map((c) => {
        const fill = toFill(c.hex)
        const active = currentFill === fill
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(fill, c.hex)}
            title={c.label}
            className={cn(
              'h-6 w-6 rounded border transition-transform hover:scale-110',
              active ? 'border-primary ring-2 ring-primary/40' : 'border-border',
            )}
            style={{ background: c.hex }}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

---

## Task 19: Add arrow + free-polygon branches to the properties sidebar

**Files:**
- Modify: `src/features/editor/components/properties-sidebar/clip-panel/shape-section.tsx`

- [ ] **Step 1: Read the shape section**

Open `shape-section.tsx`. It already has a switch on `shapeType` (or equivalent rendering branches per shape type). The existing 5 supported branches stay unchanged.

- [ ] **Step 2: Add the arrow + free-polygon branches**

Add two new branches that render fill / stroke / strokeWidth controls. The arrow branch also includes:
- A segmented control for `dash` (`Solid` / `Dashed` / `Dotted`) bound to `arrowData.dash`
- Number inputs for `pointerLength` and `pointerWidth` (range 4–48)

The free-polygon branch shows fill / stroke / strokeWidth + a read-only "Vertices: N" label using `freePolygonData.vertices.length / 2`.

Both branches render the `<TacticalColorPresets currentFill={item.fill} onPick={(fill, stroke) => updateShapeData(item.id, { fill, stroke })} />` row at the top, above the fill picker.

Wire the dash mutation:

```tsx
const updateArrowDash = (dash: 'solid' | 'dashed' | 'dotted') => {
  if (!item.arrowData) return
  updateShapeData(item.id, { arrowData: { ...item.arrowData, dash } })
}
```

(Where `updateShapeData` is the action the existing branches already use.)

- [ ] **Step 3: Comment out the star / heart / path branches**

The existing UI rows for `star`, `heart`, and `path` shape-specific controls get wrapped in `/* */` block comments with a one-line restoration note above them:

```tsx
{/*
  // MatchView v0 deferred — Konva components for star / heart / path
  // ship later. See spec 2026-05-24-konva-shape-renderer-design.md.
  …existing star branch JSX…
*/}
```

(Do the same for the heart and path branches if they're separate.)

- [ ] **Step 4: Verify the build + manual smoke**

Run: `npm run build && npm run dev`. Draw a polygon → properties panel shows fill / stroke / width / vertex count + color preset row. Draw an arrow → properties panel shows fill / stroke / width / pointer length / pointer width / dash control + color preset row. Toggle dash to Dashed → arrow on canvas updates. Click a tactical color preset → fill + stroke update.

---

## Task 20: Final verification

**Files:** none modified.

- [ ] **Step 1: Full check suite**

Run: `npm run build && npm run lint && npm run test:run`
Expected: build green; lint clean; all tests pass.

- [ ] **Step 2: Residual-shape-pipeline grep (sanity)**

Run: `npx --no-install rg "renderShape\(" src/features/export`
Expected: any results are inside commented blocks only (the gated `case 'shape':` body). No live calls.

- [ ] **Step 3: Manual end-to-end smoke**

Run `npm run dev`, open a project:

1. Open an existing project that has shape items (any supported type). Shapes render identically to before through Konva.
2. Open the restored Shapes sidebar tab → drag a rectangle → it appears; click it → handles ignored (parametric shapes have no vertex handles) but the transform gizmo overlay still selects it via the existing DOM overlay. Drag in the canvas → moves.
3. Click the Polygon toolbar button → click 4 points on the preview → double-click → polygon appears with broadcast-style fill, selected, with vertex handles. Drag a handle → vertex moves; Ctrl+Z reverts.
4. Click the Arrow button → click-and-drag on the preview → arrow appears with white stroke, subtle shadow, two endpoint handles. Drag the head endpoint to a new position; switch dash to Dashed via properties panel → arrow gains dashed style.
5. Click a tactical color preset (Red) on either shape → fill and stroke update to red.
6. Press Esc during a polygon draw → cancels; no item created.
7. Save the project (Ctrl+S), close, reopen → all shapes load correctly. Open a project with a deferred shape type (if available) → renders as a translucent placeholder + one console warning.
8. Export the project → completes; output video has no shape items; a console warning is logged about deferred shape export.

---

## Self-Review Notes

**Spec coverage check (against `2026-05-24-konva-shape-renderer-design.md`):**

| Spec section | Task(s) |
|---|---|
| Goals / new shape variants (`arrow` + `free-polygon`) | T2, T11, T12, T13, T14 |
| Konva Stage on top of preview | T7, T8 |
| Shape router with deferred placeholder | T7 |
| Shape component contract (`ShapeProps`, callbacks) | T5, T7 |
| Arrow data model + endpoints + dash + v1 breadcrumb | T2, T11, T19 |
| Free-polygon data model + handles | T2, T10, T12, T14 |
| Click-and-drag arrow draw | T13 |
| Click-to-add-vertex polygon draw | T14 |
| Selection alone = handles (no edit mode) | T11, T12 |
| Toolbar Draw group + icons | T6 |
| Ported parametric shape components (5) | T15 |
| GPU SDF pipeline gated | T16 |
| Shapes sidebar tab restored, star/heart/pen tile commented | T17 |
| Properties sidebar branches + dash + presets | T18, T19 |
| Star/heart/path branches commented in properties | T19 |
| Broadcast-style defaults | T4 |
| Tactical color preset row | T4, T18 |
| Schema bump + no-op migration | T3 |
| Export deferred no-op + warning | T16 |
| Manual verification suite | T20 |

**Placeholder scan:** no TBDs or vague "implement later" steps. Locations marked with "If X isn't the canonical name, locate via rg" are deliberate — the implementer should verify the canonical names in the codebase before binding.

**Type consistency:** `ShapeProps`, `ShapeCallbacks`, `ARROW_DEFAULTS`, `FREE_POLYGON_DEFAULTS`, `TACTICAL_PRESET_COLORS`, `dashToArray`, `createArrow`, `createFreePolygon`, `updateVertex`, `useDrawToolStore` — all used consistently across the tasks where they appear.
