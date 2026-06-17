# Field Ring Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `field-ring` shape — a squashed, optionally-spinning ring that sits under a player — rendered in the Konva editor/preview layer with a full property panel and a placement tool.

**Architecture:** `field-ring` is a MatchView shape following the `arrow`/`free-polygon` precedent. It renders only in the `shapes-konva/` Konva layer for v1 (export mirror is a deferred follow-up). The band is a dashed `Konva.Ellipse`; spin is driven by the timeline frame (not wall-clock) so scrubbing stays correct and a future export mirror can match exactly. Pure geometry/spin math lives in a unit-tested helper; the visual component and UI are verified manually.

**Tech Stack:** React 19, TypeScript (strict), Zustand, react-konva / Konva 9, Vitest + jsdom, i18next.

**Spec:** `docs/superpowers/specs/2026-06-04-field-ring-shape-design.md`

---

## File structure

New files:
- `src/features/shapes-konva/utils/field-ring-geometry.ts` — pure math (perimeter, dash, spin offset)
- `src/features/shapes-konva/utils/field-ring-geometry.test.ts`
- `src/features/shapes-konva/hooks/use-field-ring-spin.ts` — frame → dashOffset
- `src/features/shapes-konva/shapes/field-ring-shape.tsx` — Konva renderer
- `src/features/shapes-konva/stores/actions/create-field-ring.ts` — create action
- `src/features/shapes-konva/stores/actions/create-field-ring.test.ts`

Modified files:
- `src/types/timeline.ts` — `ShapeType` union, `FieldRingData`, `ShapeItem.fieldRingData`
- `src/features/shapes-konva/utils/defaults.ts` — `FIELD_RING_DEFAULTS`
- `src/features/shapes-konva/types.ts` — `DrawState` gains `placing-field-ring`
- `src/features/shapes-konva/stores/draw-tool-store.ts` — `startFieldRing()`
- `src/features/shapes-konva/stores/draw-tool-store.test.ts` — coverage
- `src/features/shapes-konva/hooks/use-place-parametric-tool.tsx` — place field-ring
- `src/features/shapes-konva/components/shape-router.tsx` — route + `mergePreview`
- `src/features/editor/components/media-sidebar.tsx` — picker button
- `src/features/editor/components/properties-sidebar/clip-panel/shape-section.tsx` — control branch
- `src/i18n/locales/partials/*.json` (or the shapes/editor partial) — 9 languages

---

## Task 1: Type definitions

**Files:**
- Modify: `src/types/timeline.ts:226-237` (ShapeType union) and `:266-289` (ShapeItem)

- [ ] **Step 1: Add `field-ring` to the `ShapeType` union**

In `src/types/timeline.ts`, change the union (currently ending at `'free-polygon'`):

```ts
export type ShapeType =
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'ellipse'
  | 'star'
  | 'polygon'
  | 'heart'
  | 'path'
  // MatchView additions — see docs/superpowers/specs/2026-05-24-konva-shape-renderer-design.md
  | 'arrow'
  | 'free-polygon'
  // Field-level player ring — see docs/superpowers/specs/2026-06-04-field-ring-shape-design.md
  | 'field-ring'
```

- [ ] **Step 2: Add the `FieldRingData` interface**

Directly after the `FreePolygonData` interface (around line 264):

```ts
/** Field-level ring under a player. Used when shapeType === 'field-ring'.
 *  The ellipse bounding box comes from ShapeItem.transform: radiusX =
 *  transform.width / 2, radiusY = radiusX * squash. Band color = fillColor. */
export interface FieldRingData {
  squash: number // 0.12–1   radiusY / radiusX (low = flat field ring)
  bandThickness: number // px band/stroke weight
  segments: number // chopped segment count (default 6)
  continuous: boolean // true = unbroken band (segments/gap ignored)
  gapRatio: number // 0–0.8   gap fraction between segments
  roundedEnds: boolean // round vs square (butt) segment caps
  extrusionHeight: number // px  0 = flat 2D
  spin: boolean
  spinSpeed: number // revolutions/sec, signed (sign = direction)
  contactShadow: boolean
}
```

- [ ] **Step 3: Add the optional field to `ShapeItem`**

In the `ShapeItem` type, after `freePolygonData?: FreePolygonData` (line 283):

```ts
  // Field-ring config — used when shapeType === 'field-ring'.
  fieldRingData?: FieldRingData
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run check`
Expected: PASS (no type errors). The `shape-router.tsx` exhaustive `switch` will now report `field-ring` as unhandled — that is fixed in Task 6. If `npm run check` fails ONLY due to that switch, continue; otherwise fix the reported error.

- [ ] **Step 5: Commit**

```bash
git add src/types/timeline.ts
git commit -m "feat(shapes): add field-ring shape type and FieldRingData"
```

---

## Task 2: Defaults

**Files:**
- Modify: `src/features/shapes-konva/utils/defaults.ts`

- [ ] **Step 1: Add `FIELD_RING_DEFAULTS`**

Append to `src/features/shapes-konva/utils/defaults.ts`:

```ts
/**
 * Default field-ring config. `fill` is the band colour; the rest map to
 * FieldRingData. Tuned to read on grass. See
 * docs/superpowers/specs/2026-06-04-field-ring-shape-design.md.
 */
export const FIELD_RING_DEFAULTS = {
  fill: '#2f97ff',
  squash: 0.34,
  bandThickness: 14,
  segments: 6,
  continuous: false,
  gapRatio: 0.42,
  roundedEnds: true,
  extrusionHeight: 6,
  spin: true,
  spinSpeed: 0.25,
  contactShadow: true,
} as const
```

- [ ] **Step 2: Verify**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/shapes-konva/utils/defaults.ts
git commit -m "feat(shapes): add FIELD_RING_DEFAULTS"
```

---

## Task 3: Geometry + spin math (TDD)

**Files:**
- Create: `src/features/shapes-konva/utils/field-ring-geometry.ts`
- Test: `src/features/shapes-konva/utils/field-ring-geometry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/shapes-konva/utils/field-ring-geometry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  ellipsePerimeter,
  computeDash,
  computeSpinDashOffset,
} from './field-ring-geometry'

describe('ellipsePerimeter', () => {
  it('matches the circle circumference when rx === ry', () => {
    const r = 50
    expect(ellipsePerimeter(r, r)).toBeCloseTo(2 * Math.PI * r, 5)
  })

  it('is between the bounds for a squashed ellipse', () => {
    const p = ellipsePerimeter(100, 34)
    // Loose sanity bounds for a real ellipse perimeter.
    expect(p).toBeGreaterThan(2 * Math.PI * 34)
    expect(p).toBeLessThan(2 * Math.PI * 100)
  })
})

describe('computeDash', () => {
  it('returns undefined when continuous', () => {
    expect(computeDash(300, 6, 0.4, true)).toBeUndefined()
  })

  it('returns undefined when segments <= 0', () => {
    expect(computeDash(300, 0, 0.4, false)).toBeUndefined()
  })

  it('splits the perimeter into segment + gap by gapRatio', () => {
    const dash = computeDash(300, 6, 0.4, false)
    expect(dash).toBeDefined()
    const [seg, gap] = dash as number[]
    expect(seg).toBeCloseTo(50 * 0.6, 5) // spacing = 300/6 = 50
    expect(gap).toBeCloseTo(50 * 0.4, 5)
  })
})

describe('computeSpinDashOffset', () => {
  it('is zero at the item start frame', () => {
    expect(computeSpinDashOffset(10, 10, 30, 0.25, 300)).toBe(0)
  })

  it('advances one full perimeter per revolution', () => {
    // 0.25 rev/sec * 4 sec = 1 revolution -> wraps to 0 offset.
    const fps = 30
    const frame = 10 + 4 * fps
    expect(computeSpinDashOffset(frame, 10, fps, 0.25, 300)).toBeCloseTo(0, 5)
  })

  it('is a fraction of perimeter mid-revolution', () => {
    const fps = 30
    // 0.25 rev/sec * 2 sec = 0.5 rev -> half the perimeter.
    const frame = 10 + 2 * fps
    expect(computeSpinDashOffset(frame, 10, fps, 0.25, 300)).toBeCloseTo(-150, 5)
  })

  it('returns 0 for non-positive fps', () => {
    expect(computeSpinDashOffset(100, 0, 0, 0.25, 300)).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/features/shapes-konva/utils/field-ring-geometry.test.ts`
Expected: FAIL — "Failed to resolve import ./field-ring-geometry" / functions not defined.

- [ ] **Step 3: Write the implementation**

Create `src/features/shapes-konva/utils/field-ring-geometry.ts`:

```ts
/**
 * Pure geometry + spin math for the field-ring shape. Kept dependency-free
 * so the Konva renderer and a future Canvas-2D export mirror can share the
 * exact same numbers (so preview and export match).
 */

/** Ramanujan's approximation of an ellipse perimeter. */
export function ellipsePerimeter(rx: number, ry: number): number {
  if (rx <= 0 && ry <= 0) return 0
  const h = Math.pow(rx - ry, 2) / Math.pow(rx + ry, 2)
  return Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
}

/**
 * Dash array [segmentLength, gapLength] for the band, distributed evenly
 * over the perimeter. Returns undefined for a continuous (unbroken) band.
 */
export function computeDash(
  perimeter: number,
  segments: number,
  gapRatio: number,
  continuous: boolean,
): number[] | undefined {
  if (continuous || segments <= 0 || perimeter <= 0) return undefined
  const spacing = perimeter / segments
  const gap = Math.min(Math.max(gapRatio, 0), 0.9)
  return [Math.max(spacing * (1 - gap), 0.5), Math.max(spacing * gap, 0.5)]
}

/**
 * Frame-locked dash offset for spin. Pure function of the timeline frame so
 * scrubbing shows the correct phase and a future export renderer matches.
 * spinSpeed is revolutions/sec (signed). Result is negative so segments
 * appear to march "forward" around the ring.
 */
export function computeSpinDashOffset(
  frame: number,
  fromFrame: number,
  fps: number,
  spinSpeed: number,
  perimeter: number,
): number {
  if (fps <= 0 || perimeter <= 0) return 0
  const elapsedSec = (frame - fromFrame) / fps
  const revolutions = spinSpeed * elapsedSec
  const frac = revolutions - Math.floor(revolutions) // 0..1, handles negatives
  return -frac * perimeter
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/features/shapes-konva/utils/field-ring-geometry.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add src/features/shapes-konva/utils/field-ring-geometry.ts src/features/shapes-konva/utils/field-ring-geometry.test.ts
git commit -m "feat(shapes): add field-ring geometry and spin math"
```

---

## Task 4: Create action (TDD)

**Files:**
- Create: `src/features/shapes-konva/stores/actions/create-field-ring.ts`
- Test: `src/features/shapes-konva/stores/actions/create-field-ring.test.ts`

Reference pattern: `create-parametric-shape.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/features/shapes-konva/stores/actions/create-field-ring.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createFieldRing } from './create-field-ring'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { FIELD_RING_DEFAULTS } from '../../utils/defaults'
import type { ShapeItem } from '@/types/timeline'

describe('createFieldRing', () => {
  beforeEach(() => {
    usePlaybackStore.setState({ currentFrame: 0 })
  })

  it('adds a field-ring shape item with default config and returns its id', () => {
    const added: ShapeItem[] = []
    // Stub the addItem action so the test does not depend on full store wiring.
    const original = useTimelineStore.getState()
    useTimelineStore.setState({
      ...original,
      fps: 30,
      addItem: ((item: ShapeItem) => {
        added.push(item)
      }) as typeof original.addItem,
    })

    const id = createFieldRing({ fps: 30, canvasWidth: 1920, canvasHeight: 1080 })

    expect(typeof id).toBe('string')
    expect(added).toHaveLength(1)
    const item = added[0]!
    expect(item.type).toBe('shape')
    expect(item.shapeType).toBe('field-ring')
    expect(item.fillColor).toBe(FIELD_RING_DEFAULTS.fill)
    expect(item.fieldRingData?.segments).toBe(6)
    expect(item.fieldRingData?.squash).toBe(FIELD_RING_DEFAULTS.squash)
    expect(item.id).toBe(id)
  })
})
```

> Note: if `ensureShapeTrackForRange` requires real store state in this test environment, replace the `addItem` stub approach with seeding a track first; check how `draw-tool-store.test.ts` sets up the timeline store and mirror it. The key assertions are the returned id and the field-ring item shape.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/features/shapes-konva/stores/actions/create-field-ring.test.ts`
Expected: FAIL — cannot resolve `./create-field-ring`.

- [ ] **Step 3: Write the implementation**

Create `src/features/shapes-konva/stores/actions/create-field-ring.ts`:

```ts
import type { ShapeItem } from '@/types/timeline'
import { i18n } from '@/i18n'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { FIELD_RING_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

interface CreateFieldRingInput {
  fps: number
  /** Drop position in canvas-pixel coords. When omitted, spawns at centre. */
  position?: { x: number; y: number }
  canvasWidth?: number
  canvasHeight?: number
}

/**
 * Create a field-ring shape at the current playhead. Mirrors
 * createParametricShape: 5s duration, centred (or placed at `position`),
 * default FieldRingData. Returns the new item id.
 */
export function createFieldRing(input: CreateFieldRingInput): string {
  const { fps, position, canvasWidth, canvasHeight } = input
  const frame = usePlaybackStore.getState().currentFrame
  const durationInFrames = fps * 5
  const trackId = ensureShapeTrackForRange(frame, durationInFrames)
  const state = useTimelineStore.getState()

  const defaultSize =
    canvasWidth != null && canvasHeight != null
      ? Math.min(canvasWidth, canvasHeight) * 0.25
      : 200

  const positionOffset =
    position && canvasWidth != null && canvasHeight != null
      ? { x: position.x - canvasWidth / 2, y: position.y - canvasHeight / 2 }
      : { x: 0, y: 0 }

  const id = crypto.randomUUID()
  const item: ShapeItem = {
    id,
    type: 'shape',
    trackId,
    from: frame,
    durationInFrames,
    label: i18n.t('editor.shapeSection.typeFieldRing'),
    shapeType: 'field-ring',
    fillColor: FIELD_RING_DEFAULTS.fill,
    transform: {
      x: positionOffset.x,
      y: positionOffset.y,
      width: defaultSize,
      height: defaultSize,
    },
    fieldRingData: {
      squash: FIELD_RING_DEFAULTS.squash,
      bandThickness: FIELD_RING_DEFAULTS.bandThickness,
      segments: FIELD_RING_DEFAULTS.segments,
      continuous: FIELD_RING_DEFAULTS.continuous,
      gapRatio: FIELD_RING_DEFAULTS.gapRatio,
      roundedEnds: FIELD_RING_DEFAULTS.roundedEnds,
      extrusionHeight: FIELD_RING_DEFAULTS.extrusionHeight,
      spin: FIELD_RING_DEFAULTS.spin,
      spinSpeed: FIELD_RING_DEFAULTS.spinSpeed,
      contactShadow: FIELD_RING_DEFAULTS.contactShadow,
    },
  }
  state.addItem(item)
  return id
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/features/shapes-konva/stores/actions/create-field-ring.test.ts`
Expected: PASS. If `i18n.t` returns the key string (no translations loaded in test), that is fine — the test does not assert `label`.

- [ ] **Step 5: Commit**

```bash
git add src/features/shapes-konva/stores/actions/create-field-ring.ts src/features/shapes-konva/stores/actions/create-field-ring.test.ts
git commit -m "feat(shapes): add createFieldRing action"
```

---

## Task 5: Draw-tool placement state (TDD)

**Files:**
- Modify: `src/features/shapes-konva/types.ts:53-57` (DrawState)
- Modify: `src/features/shapes-konva/stores/draw-tool-store.ts`
- Test: `src/features/shapes-konva/stores/draw-tool-store.test.ts`

- [ ] **Step 1: Add the `placing-field-ring` variant to `DrawState`**

In `src/features/shapes-konva/types.ts`, extend the `DrawState` union:

```ts
export type DrawState =
  | { kind: 'idle' }
  | { kind: 'drawing-arrow'; tail: { x: number; y: number } | null }
  | { kind: 'drawing-polygon'; vertices: number[] }
  | { kind: 'placing-parametric'; shapeType: ParametricShapeKind }
  | { kind: 'placing-field-ring' }
```

- [ ] **Step 2: Write the failing test**

Add to `src/features/shapes-konva/stores/draw-tool-store.test.ts` (inside the existing describe block):

```ts
  it('startFieldRing sets placing-field-ring state', () => {
    useDrawToolStore.getState().startFieldRing()
    expect(useDrawToolStore.getState().state).toEqual({ kind: 'placing-field-ring' })
  })
```

Ensure `useDrawToolStore` is imported at the top of the test (it already is if other tests use it).

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:run -- src/features/shapes-konva/stores/draw-tool-store.test.ts`
Expected: FAIL — `startFieldRing is not a function`.

- [ ] **Step 4: Implement `startFieldRing`**

In `src/features/shapes-konva/stores/draw-tool-store.ts`, add to the interface:

```ts
  startFieldRing(): void
```

And to the store body (after `startParametric`):

```ts
  startFieldRing: () => set({ state: { kind: 'placing-field-ring' } }),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- src/features/shapes-konva/stores/draw-tool-store.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/shapes-konva/types.ts src/features/shapes-konva/stores/draw-tool-store.ts src/features/shapes-konva/stores/draw-tool-store.test.ts
git commit -m "feat(shapes): add placing-field-ring draw-tool state"
```

---

## Task 6: Konva renderer + spin hook + router wiring

**Files:**
- Create: `src/features/shapes-konva/hooks/use-field-ring-spin.ts`
- Create: `src/features/shapes-konva/shapes/field-ring-shape.tsx`
- Modify: `src/features/shapes-konva/components/shape-router.tsx`

This task is verified manually (visual Konva output is not unit-testable here).

- [ ] **Step 1: Create the spin hook**

Create `src/features/shapes-konva/hooks/use-field-ring-spin.ts`:

```ts
import { usePlaybackStore } from '../deps/playback'
import { computeSpinDashOffset } from '../utils/field-ring-geometry'

/**
 * Returns the frame-locked dash offset for a spinning field ring. Subscribes
 * to the current playback frame so the value updates as the playhead moves
 * (playback AND scrubbing). Returns 0 when spin is off.
 */
export function useFieldRingSpin(
  enabled: boolean,
  fromFrame: number,
  fps: number,
  spinSpeed: number,
  perimeter: number,
): number {
  const frame = usePlaybackStore((s) => s.currentFrame)
  if (!enabled) return 0
  return computeSpinDashOffset(frame, fromFrame, fps, spinSpeed, perimeter)
}
```

> Verify the playback dep exposes `currentFrame`: open `src/features/shapes-konva/deps/playback.ts`. If the field is named differently (e.g. `frame`), use that name here.

- [ ] **Step 2: Create the renderer**

Create `src/features/shapes-konva/shapes/field-ring-shape.tsx`:

```tsx
import { Ellipse } from 'react-konva'
import type { ShapeProps } from '../types'
import { FIELD_RING_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import { useFieldRingSpin } from '../hooks/use-field-ring-spin'
import { ellipsePerimeter, computeDash } from '../utils/field-ring-geometry'
import { useTimelineStore } from '../deps/timeline'

/**
 * Field-level player ring. A dashed Konva ellipse band with optional
 * extrusion (stacked darker copies), contact shadow, and frame-locked spin.
 * Squash, segments, gap, thickness, etc. come from item.fieldRingData.
 */
export function FieldRingShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const d = item.fieldRingData
  const fps = useTimelineStore((s) => s.fps)

  const { width } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  const fill = item.fillColor ?? FIELD_RING_DEFAULTS.fill

  const squash = d?.squash ?? FIELD_RING_DEFAULTS.squash
  const bandThickness = d?.bandThickness ?? FIELD_RING_DEFAULTS.bandThickness
  const segments = d?.segments ?? FIELD_RING_DEFAULTS.segments
  const continuous = d?.continuous ?? FIELD_RING_DEFAULTS.continuous
  const gapRatio = d?.gapRatio ?? FIELD_RING_DEFAULTS.gapRatio
  const roundedEnds = d?.roundedEnds ?? FIELD_RING_DEFAULTS.roundedEnds
  const extrusionHeight = d?.extrusionHeight ?? FIELD_RING_DEFAULTS.extrusionHeight
  const spin = d?.spin ?? FIELD_RING_DEFAULTS.spin
  const spinSpeed = d?.spinSpeed ?? FIELD_RING_DEFAULTS.spinSpeed
  const contactShadow = d?.contactShadow ?? FIELD_RING_DEFAULTS.contactShadow

  const radiusX = width / 2
  const radiusY = radiusX * squash
  const perimeter = ellipsePerimeter(radiusX, radiusY)
  const dash = continuous ? undefined : computeDash(perimeter, segments, gapRatio, false)
  const lineCap = roundedEnds ? 'round' : 'butt'

  const dashOffset = useFieldRingSpin(spin, item.from, fps, spinSpeed, perimeter)

  // Darken a hex colour by a factor (0..1). Falls back to the input if the
  // colour is not a 6-digit hex (e.g. an rgba string) — extrusion just uses
  // the same colour then.
  const darken = (hex: string, f: number): string => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex)
    if (!m) return hex
    const n = parseInt(m[1]!, 16)
    const r = ((n >> 16) & 255) * f
    const g = ((n >> 8) & 255) * f
    const b = (n & 255) * f
    return `rgb(${r | 0}, ${g | 0}, ${b | 0})`
  }

  const wall = []
  for (let k = extrusionHeight; k >= 1; k--) {
    const f = 0.34 + 0.26 * (1 - k / Math.max(extrusionHeight, 1))
    wall.push(
      <Ellipse
        key={`wall-${k}`}
        y={k}
        radiusX={radiusX}
        radiusY={radiusY}
        stroke={darken(fill, f)}
        strokeWidth={Math.max(bandThickness - 1, 1)}
        dash={dash}
        dashOffset={dashOffset}
        lineCap={lineCap}
        listening={false}
      />,
    )
  }

  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      {contactShadow ? (
        <Ellipse
          y={extrusionHeight + 3}
          radiusX={radiusX}
          radiusY={Math.max(radiusY, 6)}
          fill="rgba(0,0,0,0.30)"
          shadowColor="#000"
          shadowBlur={12}
          shadowOpacity={0.5}
          listening={false}
        />
      ) : null}
      {wall}
      <Ellipse
        radiusX={radiusX}
        radiusY={radiusY}
        stroke={fill}
        strokeWidth={bandThickness}
        dash={dash}
        dashOffset={dashOffset}
        lineCap={lineCap}
      />
    </ParametricShapeBody>
  )
}
```

> Note on coordinates: `ParametricShapeBody` renders a `<Group>` positioned at the shape centre with `centerOrigin={false}` (matching Circle/Ellipse, which draw from their own centre). The child ellipses are therefore drawn at local `(0, 0)`; `y={k}` / `y={extrusionHeight + 3}` offset downward in local space for the wall and shadow. This mirrors `ellipse-shape.tsx`.

- [ ] **Step 3: Wire into the router**

In `src/features/shapes-konva/components/shape-router.tsx`:

Add the import near the other shape imports:

```ts
import { FieldRingShape } from '../shapes/field-ring-shape'
```

Extend `mergePreview` so a partial `fieldRingData` preview shallow-merges (place after the `freePolygonData` block, before `return merged`):

```ts
  if (preview.fieldRingData && item.fieldRingData) {
    merged.fieldRingData = { ...item.fieldRingData, ...preview.fieldRingData }
  }
```

Add the case to the `switch (item.shapeType)` (before the `star`/`heart`/`path` group):

```ts
    case 'field-ring':
      return <FieldRingShape {...mergedProps} />
```

- [ ] **Step 4: Verify it compiles and the exhaustive switch is satisfied**

Run: `npm run check`
Expected: PASS — the `_exhaustive: never` default no longer errors because `field-ring` is now handled.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open a project, and temporarily trigger creation (you can wire the button in Task 8 first, or call `createFieldRing({ fps: 30, canvasWidth, canvasHeight })` from the console via an existing debug path). Confirm:
- A blue dashed ring renders, squashed (flat), 6 segments, rounded ends.
- Pressing play makes the segments march; pausing/scrubbing shows a stable, frame-correct phase.

- [ ] **Step 6: Commit**

```bash
git add src/features/shapes-konva/hooks/use-field-ring-spin.ts src/features/shapes-konva/shapes/field-ring-shape.tsx src/features/shapes-konva/components/shape-router.tsx
git commit -m "feat(shapes): render field-ring in the Konva layer with frame-locked spin"
```

---

## Task 7: Placement tool wiring

**Files:**
- Modify: `src/features/shapes-konva/hooks/use-place-parametric-tool.tsx`

- [ ] **Step 1: Handle the field-ring placement state**

In `use-place-parametric-tool.tsx`, add the import:

```ts
import { createFieldRing } from '../stores/actions/create-field-ring'
```

Replace the early guard and creation logic in `onClick` so it handles BOTH placement states. The current guard is:

```ts
      if (state.kind !== 'placing-parametric') return
```

Change it to:

```ts
      if (state.kind !== 'placing-parametric' && state.kind !== 'placing-field-ring') return
```

Then, where it currently calls `createParametricShape({ ... })` and assigns `id`, branch by state kind:

```ts
      const id =
        state.kind === 'placing-field-ring'
          ? createFieldRing({ fps, position: { x: px, y: py }, canvasWidth, canvasHeight })
          : createParametricShape({
              shapeType: state.shapeType,
              fps,
              position: { x: px, y: py },
              canvasWidth,
              canvasHeight,
            })
```

(Keep the existing `selectItems([id])` line after.)

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: PASS. (TypeScript narrows `state.shapeType` correctly inside the `else` branch because `placing-field-ring` has no `shapeType`.)

- [ ] **Step 3: Commit**

```bash
git add src/features/shapes-konva/hooks/use-place-parametric-tool.tsx
git commit -m "feat(shapes): place field-ring via the click-to-place tool"
```

---

## Task 8: Shape picker button

**Files:**
- Modify: `src/features/editor/components/media-sidebar.tsx`

- [ ] **Step 1: Subscribe to `startFieldRing` and derive active state**

Near the existing `startArrow` / `startParametric` selectors (around line 52-59), add:

```ts
  const startFieldRing = useDrawToolStore((s) => s.startFieldRing)
  const placingFieldRing = drawState.kind === 'placing-field-ring'
```

- [ ] **Step 2: Add the rail button**

In the shapes rail (near the polygon/arrow buttons around line 244-260), add a new button. Use the `Disc` icon from lucide-react (import it alongside the other lucide imports in this file):

```tsx
          <button
            onClick={() => (placingFieldRing ? cancelDraw() : startFieldRing())}
            aria-pressed={placingFieldRing}
            aria-label="Place field ring"
            className={/* copy the className expression from the adjacent arrow/polygon button */ ''}
          >
            <Disc className="w-4 h-4" />
          </button>
```

> Match the exact `className` / wrapper markup of the neighbouring arrow and polygon buttons in this file so styling and active-state visuals are consistent. Add `Disc` to the existing `lucide-react` import statement.

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Click the new field-ring button in the shapes rail, then click on the preview canvas — a field ring is placed and auto-selected. Clicking the button again cancels the tool.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/components/media-sidebar.tsx
git commit -m "feat(shapes): add field-ring button to the shape picker"
```

---

## Task 9: Properties panel

**Files:**
- Modify: `src/features/editor/components/properties-sidebar/clip-panel/shape-section.tsx`

This task adds a dedicated control set for `field-ring` and hides the generic controls that don't apply. Verified manually.

- [ ] **Step 1: Add field-ring to the shape-type dropdown options**

In `SHAPE_TYPE_OPTIONS` (line 27-35), add:

```ts
  { value: 'field-ring', labelKey: 'editor.shapeSection.typeFieldRing' },
```

- [ ] **Step 2: Compute an `isFieldRing` flag and field-ring shared values**

After `sharedValues` is built (after line 118), derive the field-ring sub-values. Add inside the `sharedValues` object a `fieldRingData` passthrough for the single-selection case (field-ring config is only edited one item at a time for v1):

```ts
  const singleFieldRing =
    shapeItems.length === 1 && shapeItems[0]?.shapeType === 'field-ring'
      ? shapeItems[0]
      : null
  const fr = singleFieldRing?.fieldRingData
```

- [ ] **Step 3: Gate the generic controls off for field-ring**

The field-ring uses its own controls, so suppress the generic corner-radius / direction / points / inner-radius rows and the default fill/stroke rows when a field ring is selected. Update the `show*` flags (line 121-126) to also require `!singleFieldRing`:

```ts
  const showCornerRadius =
    !singleFieldRing &&
    sharedValues?.shapeType &&
    ['rectangle', 'triangle', 'star', 'polygon'].includes(sharedValues.shapeType)
  const showDirection = !singleFieldRing && sharedValues?.shapeType === 'triangle'
  const showPoints =
    !singleFieldRing &&
    sharedValues?.shapeType &&
    ['star', 'polygon'].includes(sharedValues.shapeType)
  const showInnerRadius = !singleFieldRing && sharedValues?.shapeType === 'star'
```

- [ ] **Step 4: Add an updater for field-ring data**

After `updateShapeItems` (line 140), add a helper that patches `fieldRingData` on the single selected field ring:

```ts
  const updateFieldRing = useCallback(
    (patch: Partial<NonNullable<ShapeItem['fieldRingData']>>) => {
      if (!singleFieldRing) return
      updateItem(singleFieldRing.id, {
        fieldRingData: { ...singleFieldRing.fieldRingData!, ...patch },
      })
    },
    [singleFieldRing, updateItem],
  )
```

- [ ] **Step 5: Render the field-ring control block**

Inside the returned `<PropertySection>`, right after the Shape Type `<PropertyRow>` (after line 380), add a block rendered only for a single field ring. It reuses `ColorPicker`, `SliderInput`, `NumberInput`, and `Button` toggles already imported in this file:

```tsx
      {singleFieldRing && fr && (
        <>
          <ColorPicker
            label={t('editor.shapeSection.fill')}
            color={singleFieldRing.fillColor ?? '#2f97ff'}
            onChange={(v) => {
              updateShapeItems({ fillColor: v })
              queueMicrotask(() => clearPreview())
            }}
            onLiveChange={(v) => setPropertiesPreviewNew({ [singleFieldRing.id]: { fillColor: v } })}
            onReset={() => updateShapeItems({ fillColor: '#2f97ff' })}
            defaultColor="#2f97ff"
          />

          <PropertyRow label={t('editor.shapeSection.squash')}>
            <SliderInput
              value={fr.squash}
              onChange={(v) => updateFieldRing({ squash: v })}
              onLiveChange={(v) => updateFieldRing({ squash: v })}
              min={0.12}
              max={1}
              step={0.01}
              className="flex-1 min-w-0"
            />
          </PropertyRow>

          <PropertyRow label={t('editor.shapeSection.bandThickness')}>
            <SliderInput
              value={fr.bandThickness}
              onChange={(v) => updateFieldRing({ bandThickness: v })}
              onLiveChange={(v) => updateFieldRing({ bandThickness: v })}
              min={2}
              max={60}
              step={1}
              unit="px"
              className="flex-1 min-w-0"
            />
          </PropertyRow>

          <PropertyRow label={t('editor.shapeSection.extrusionHeight')}>
            <SliderInput
              value={fr.extrusionHeight}
              onChange={(v) => updateFieldRing({ extrusionHeight: v })}
              onLiveChange={(v) => updateFieldRing({ extrusionHeight: v })}
              min={0}
              max={30}
              step={1}
              unit="px"
              className="flex-1 min-w-0"
            />
          </PropertyRow>

          <PropertyRow label={t('editor.shapeSection.continuous')}>
            <Button
              variant={fr.continuous ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs flex-1 min-w-0"
              onClick={() => updateFieldRing({ continuous: !fr.continuous })}
            >
              {fr.continuous ? t('editor.shapeSection.on') : t('editor.shapeSection.off')}
            </Button>
          </PropertyRow>

          {!fr.continuous && (
            <>
              <PropertyRow label={t('editor.shapeSection.segments')}>
                <NumberInput
                  value={fr.segments}
                  onChange={(v) => updateFieldRing({ segments: v })}
                  onLiveChange={(v) => updateFieldRing({ segments: v })}
                  min={2}
                  max={48}
                  step={1}
                  className="flex-1 min-w-0"
                />
              </PropertyRow>

              <PropertyRow label={t('editor.shapeSection.gap')}>
                <SliderInput
                  value={fr.gapRatio}
                  onChange={(v) => updateFieldRing({ gapRatio: v })}
                  onLiveChange={(v) => updateFieldRing({ gapRatio: v })}
                  min={0}
                  max={0.8}
                  step={0.01}
                  className="flex-1 min-w-0"
                />
              </PropertyRow>

              <PropertyRow label={t('editor.shapeSection.roundedEnds')}>
                <Button
                  variant={fr.roundedEnds ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs flex-1 min-w-0"
                  onClick={() => updateFieldRing({ roundedEnds: !fr.roundedEnds })}
                >
                  {fr.roundedEnds ? t('editor.shapeSection.on') : t('editor.shapeSection.off')}
                </Button>
              </PropertyRow>
            </>
          )}

          <PropertyRow label={t('editor.shapeSection.spin')}>
            <Button
              variant={fr.spin ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs flex-1 min-w-0"
              onClick={() => updateFieldRing({ spin: !fr.spin })}
            >
              {fr.spin ? t('editor.shapeSection.on') : t('editor.shapeSection.off')}
            </Button>
          </PropertyRow>

          {fr.spin && (
            <PropertyRow label={t('editor.shapeSection.spinSpeed')}>
              <SliderInput
                value={fr.spinSpeed}
                onChange={(v) => updateFieldRing({ spinSpeed: v })}
                onLiveChange={(v) => updateFieldRing({ spinSpeed: v })}
                min={-2}
                max={2}
                step={0.05}
                className="flex-1 min-w-0"
              />
            </PropertyRow>
          )}

          <PropertyRow label={t('editor.shapeSection.contactShadow')}>
            <Button
              variant={fr.contactShadow ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs flex-1 min-w-0"
              onClick={() => updateFieldRing({ contactShadow: !fr.contactShadow })}
            >
              {fr.contactShadow ? t('editor.shapeSection.on') : t('editor.shapeSection.off')}
            </Button>
          </PropertyRow>
        </>
      )}
```

> The generic Fill / Stroke rows below still render for non-field-ring shapes. For field-ring, the dedicated Fill above is shown; the generic stroke rows are harmless but to keep the panel clean you may wrap the existing generic Fill `<ColorPicker>` (line 408-415) and stroke rows in `{!singleFieldRing && ( … )}`. Do so.

- [ ] **Step 6: Verify it compiles**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`. Select a field ring; confirm every control updates the ring live (squash flattens it, segments/gap reshape it, spin toggle + speed animate it, continuous hides the segment controls, contact shadow toggles the shadow). Confirm undo/redo works on a committed change.

- [ ] **Step 8: Commit**

```bash
git add src/features/editor/components/properties-sidebar/clip-panel/shape-section.tsx
git commit -m "feat(shapes): field-ring property controls"
```

---

## Task 10: i18n strings (9 languages)

**Files:**
- Modify: the shapes/editor i18n partial under `src/i18n/locales/partials/` that contains the `editor.shapeSection.*` keys (grep for `"typeRectangle"` to find it). If those keys live in the base `src/i18n/locales/<lang>.json`, edit those instead.

- [ ] **Step 1: Locate the file holding `editor.shapeSection`**

Run: `grep -rl "typeRectangle" src/i18n/locales`
Use the returned file(s). The structure is per-language (either one file per language, or a partial keyed by language).

- [ ] **Step 2: Add the English keys**

Add under `editor.shapeSection` for `en`:

```json
"typeFieldRing": "Field ring",
"squash": "Squash",
"bandThickness": "Band thickness",
"extrusionHeight": "Extrusion height",
"continuous": "Continuous",
"segments": "Segments",
"gap": "Gap",
"roundedEnds": "Rounded ends",
"spin": "Spin",
"spinSpeed": "Spin speed",
"contactShadow": "Contact shadow"
```

- [ ] **Step 3: Add the same keys translated for the other 8 languages**

Add the equivalent keys for `es, fr, de, pt-BR, tr, ja, ko, zh`, keeping the identical key names and JSON structure. Translations:

| key | es | fr | de | pt-BR | tr | ja | ko | zh |
|---|---|---|---|---|---|---|---|---|
| typeFieldRing | Anillo de campo | Anneau de terrain | Feldring | Anel de campo | Saha halkası | フィールドリング | 필드 링 | 场地光环 |
| squash | Achatar | Aplatir | Stauchen | Achatar | Bas | スカッシュ | 납작하게 | 压扁 |
| bandThickness | Grosor de banda | Épaisseur | Bandstärke | Espessura | Bant kalınlığı | 帯の太さ | 띠 두께 | 带宽 |
| extrusionHeight | Altura de extrusión | Hauteur d'extrusion | Extrusionshöhe | Altura de extrusão | Yükseklik | 押し出しの高さ | 돌출 높이 | 凸起高度 |
| continuous | Continuo | Continu | Durchgehend | Contínuo | Sürekli | 連続 | 연속 | 连续 |
| segments | Segmentos | Segments | Segmente | Segmentos | Parçalar | セグメント | 세그먼트 | 段数 |
| gap | Espacio | Espacement | Abstand | Espaço | Boşluk | 間隔 | 간격 | 间隔 |
| roundedEnds | Extremos redondeados | Extrémités arrondies | Runde Enden | Pontas arredondadas | Yuvarlak uçlar | 丸い端 | 둥근 끝 | 圆角端 |
| spin | Giro | Rotation | Drehung | Giro | Dönüş | 回転 | 회전 | 旋转 |
| spinSpeed | Velocidad de giro | Vitesse de rotation | Drehgeschwindigkeit | Velocidade de giro | Dönüş hızı | 回転速度 | 회전 속도 | 旋转速度 |
| contactShadow | Sombra de contacto | Ombre de contact | Kontaktschatten | Sombra de contato | Temas gölgesi | 接地影 | 접지 그림자 | 接触阴影 |

> Do NOT put a bare ASCII `"` inside any JSON string value. Keep the exact same key set in every language.

- [ ] **Step 4: Verify**

Run: `npm run check` and `npm run test:run`
Expected: PASS. Load `npm run dev` and confirm the field-ring labels render (and switch a language in Settings to spot-check one other locale).

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "i18n(shapes): field-ring property labels in 9 languages"
```

---

## Task 11: Defensive normalization

**Files:**
- Modify: the project normalization in `src/shared/projects/migrations/` (grep for where shape items are normalized, e.g. `shapeType` handling).

- [ ] **Step 1: Find the shape normalization site**

Run: `grep -rln "shapeType" src/shared/projects`
Open the normalization file. If shapes are normalized item-by-item, add a defensive default; if there is no per-shape normalization, SKIP this task (the renderer already falls back to `FIELD_RING_DEFAULTS` for every field), and note the skip.

- [ ] **Step 2: Add a defensive default (only if a normalization site exists)**

Where shape items are normalized, ensure a `field-ring` without `fieldRingData` gets defaults:

```ts
if (item.type === 'shape' && item.shapeType === 'field-ring' && !item.fieldRingData) {
  item.fieldRingData = {
    squash: 0.34, bandThickness: 14, segments: 6, continuous: false,
    gapRatio: 0.42, roundedEnds: true, extrusionHeight: 6, spin: true,
    spinSpeed: 0.25, contactShadow: true,
  }
}
```

> The renderer already defaults every field individually, so this is belt-and-suspenders. Do not bump `CURRENT_SCHEMA_VERSION` — no migration is required.

- [ ] **Step 3: Verify**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/projects
git commit -m "chore(shapes): defensive field-ring defaults on load"
```

---

## Task 12: Full verification pass

- [ ] **Step 1: Run the full check suite**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 2: Run all tests**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 3: Boundary + deps contracts**

Run: `npm run check:boundaries` then `npm run check:deps-contracts`
Expected: PASS (all new cross-feature imports go through existing `deps/` adapters; no new `@/features/*` imports were added outside `deps/`).

- [ ] **Step 4: Manual end-to-end matrix**

Run: `npm run dev`. Verify:
- Field-ring button in the shapes rail → click → click canvas → ring placed, auto-selected.
- Default look: blue, flat (squash 0.34), 6 segments, rounded ends, subtle extrusion + shadow, spinning.
- Every property updates live (color, radius via transformer, squash, band thickness, extrusion, continuous, segments, gap, rounded ends, spin, spin speed, contact shadow).
- Play → segments march; pause/scrub to several frames → phase is stable and correct at each frame (frame-locked spin).
- Continuous toggle hides segment controls and draws an unbroken band.
- Move (drag) and resize (handle) work; undo/redo works.
- Switch UI language in Settings → field-ring labels localize.

- [ ] **Step 5: Final commit (if any uncommitted changes remain)**

```bash
git add -A
git commit -m "test(shapes): verify field-ring end-to-end"
```

---

## Notes for the implementer

- **Deferred (NOT in this plan):** export rendering (`renderFieldRingToCanvas` in `features/export/utils/canvas-shapes.ts`) and player occlusion (the "video sandwich" needing a person-segmentation matte). Until the export mirror lands, **the ring will not appear in exported video** — this is the accepted v1 limitation.
- **Spin correctness is the highest-risk item.** It MUST be frame-locked (Task 3 + Task 6). If you ever see spin tied to `Date.now()` or `Konva.Animation`'s `frame.time`, that is a bug — scrubbing and the future export would desync.
- **Dep field names:** verify `usePlaybackStore` exposes `currentFrame` and `useTimelineStore` exposes `fps` and `addItem` via the `shapes-konva/deps/*` adapters before relying on them (Tasks 4 and 6 reference them).
```
