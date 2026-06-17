# Shape Keyframes On The Clip — Implementation Plan (Phase 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shape register its changes on its own timeline clip (persisted in project JSON, undoable, replayed on the playhead) via ONE generic mechanism, replacing the in-memory side store.

**Architecture:** A keyframe is `{ frame, patch: Partial<ShapeItem> }` stored on `ShapeItem.keyframes` (clip-relative frames). A pure, generic deep-merge resolver folds every patch with `frame ≤ playhead` onto the base item (plain objects merge recursively; arrays + primitives replace) — step/abrupt, no interpolation, no per-field enumeration. All edit paths (panel, body-drag, transformer, vertex) funnel through one `commitShapeUpdate(itemId, patch)` helper that updates the base AND appends/merges the keyframe in a single undo entry, with a frame-0 auto-baseline on first change. The separate `useShapeKeyframesStore` is deleted.

**Tech Stack:** React 19, TypeScript (strict), Zustand + Zundo (undo), Vitest. (Export — worker resolve + Canvas-2D mirrors — is **Phase 2**, a separate plan that depends on the resolver landed here.)

**Architecture source:** the `Plan` architect pass on 2026-06-10. No schema migration needed (`timelineItemSchema` is `.passthrough()`; undo snapshots store items by reference).

---

## File structure

New:
- `src/features/shapes-konva/utils/shape-keyframes.ts` — pure: `deepMergePatch`, `resolveShapeAtFrame`, `mergeKeyframe` (the whole engine, Konva/React-free, worker-portable for Phase 2).
- `src/features/shapes-konva/utils/shape-keyframes.test.ts` — unit tests for the engine.
- `src/features/shapes-konva/stores/actions/commit-shape-update.ts` — the single record path: update base + append keyframe in one undo entry.

Modified:
- `src/types/timeline.ts` — add `ShapeKeyframe` + `ShapeItem.keyframes?`.
- `src/features/shapes-konva/hooks/use-shape-callbacks.ts` — `onUpdateData`/`onUpdateVertex` route through `commitShapeUpdate`; delete `recordIfShape`/`patchToKeyframePatch`.
- `src/features/editor/components/properties-sidebar/clip-panel/shape-properties.tsx` — `updateAll` + every `update*Data`/`updateSpotlightTransform`/closed-toggle route through `commitShapeUpdate`; delete `KEYFRAMEABLE_PROPS`/`pickKeyframeableProps`.
- `src/features/shapes-konva/components/parametric-transformer.tsx` — `onTransformEnd` records (today it bypasses recording).
- `src/features/shapes-konva/components/text-transformer.tsx` — already routes via `callbacks.onUpdateData`; no change beyond the callback rewrite.
- `src/features/shapes-konva/components/shape-router.tsx` — resolve via `item.keyframes`; drop side-store subscription.
- `src/features/shapes-konva/components/shapes-stage.tsx` — resolve selected shapes via `item.keyframes`; drop side-store subscription.
- `src/features/timeline/components/timeline-item/clip-shape-keyframes.tsx` — read `item.keyframes` for the clip change-marks.
- Deps adapters that re-export the store/resolver: `src/features/timeline/deps/shapes-konva.ts`, `src/features/editor/deps/shapes-konva.ts` (and any other `deps/*` exporting `useShapeKeyframesStore`/`resolveShapeAtFrame`).

Deleted (last task):
- `src/features/shapes-konva/stores/shape-keyframes-store.ts` and `src/features/shapes-konva/stores/actions/update-vertex.ts` (its geometry folds into `onUpdateVertex` + `commitShapeUpdate`).

---

## Task 1: Type — `ShapeItem.keyframes`

**Files:**
- Modify: `src/types/timeline.ts` (the `ShapeItem` type)

- [ ] **Step 1: Add the keyframe type + field**

Above `export type ShapeItem` add:

```ts
/** One recorded change for a shape clip: at clip-relative `frame`, apply
 *  `patch` (any subset of the shape's fields). Step playback — no interpolation. */
export interface ShapeKeyframe {
  frame: number
  patch: Partial<ShapeItem>
}
```

Inside `ShapeItem`, after `timerData?: TimerData`, add:

```ts
  // Change registry for this clip (frame-relative). Resolved on top of the
  // base item by resolveShapeAtFrame. Optional → old projects have none.
  keyframes?: ShapeKeyframe[]
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: PASS (the old store/resolver still exist and are untouched).

- [ ] **Step 3: Commit**

```bash
git add src/types/timeline.ts
git commit -m "feat(shapes): add ShapeItem.keyframes for on-clip change registry"
```

---

## Task 2: The keyframe engine (pure, TDD)

**Files:**
- Create: `src/features/shapes-konva/utils/shape-keyframes.ts`
- Test: `src/features/shapes-konva/utils/shape-keyframes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/shapes-konva/utils/shape-keyframes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deepMergePatch, resolveShapeAtFrame, mergeKeyframe } from './shape-keyframes'
import type { ShapeItem } from '@/types/timeline'

function baseItem(extra: Partial<ShapeItem> = {}): ShapeItem {
  return {
    id: 's1',
    type: 'shape',
    trackId: 't1',
    from: 0,
    durationInFrames: 100,
    label: 'Spotlight',
    shapeType: 'spotlight',
    fillColor: '#ffffff',
    transform: { x: 0, y: 0, width: 100, height: 200 },
    spotlightData: { intensity: 1, pool: true, bloom: true, cutout: true, cutoutWidth: 50, cutoutHeight: 180 },
    ...extra,
  } as ShapeItem
}

describe('deepMergePatch', () => {
  it('recurses into plain objects but replaces arrays + primitives', () => {
    const target = { transform: { x: 1, y: 2 }, freePolygonData: { vertices: [0, 0, 1, 1], closed: false }, fillColor: '#000' }
    const out = deepMergePatch(target, {
      transform: { x: 9 }, // merges → keeps y
      freePolygonData: { vertices: [5, 5] }, // array → replaces wholesale
      fillColor: '#fff', // primitive → replaces
    })
    expect(out.transform).toEqual({ x: 9, y: 2 })
    expect(out.freePolygonData).toEqual({ vertices: [5, 5] })
    expect(out.fillColor).toBe('#fff')
  })
})

describe('resolveShapeAtFrame', () => {
  it('returns the SAME reference when there are no keyframes (memo fast-path)', () => {
    const item = baseItem()
    expect(resolveShapeAtFrame(item, 50)).toBe(item)
  })

  it('applies only patches with frame <= playhead, in order', () => {
    const item = baseItem({
      keyframes: [
        { frame: 0, patch: { fillColor: '#111' } },
        { frame: 30, patch: { fillColor: '#222' } },
        { frame: 60, patch: { fillColor: '#333' } },
      ],
    })
    expect(resolveShapeAtFrame(item, 15).fillColor).toBe('#111')
    expect(resolveShapeAtFrame(item, 45).fillColor).toBe('#222')
    expect(resolveShapeAtFrame(item, 999).fillColor).toBe('#333')
  })

  it('keyframes the new shape-specific blobs (spotlightData) field-by-field', () => {
    const item = baseItem({
      keyframes: [{ frame: 0, patch: { spotlightData: { intensity: 0.3 } as ShapeItem['spotlightData'] } }],
    })
    const r = resolveShapeAtFrame(item, 10)
    expect(r.spotlightData?.intensity).toBe(0.3)
    expect(r.spotlightData?.pool).toBe(true) // untouched field survives the merge
  })
})

describe('mergeKeyframe', () => {
  it('inserts a keyframe and auto-baselines frame 0 on the first change past 0', () => {
    const item = baseItem()
    const next = mergeKeyframe(item.keyframes, 30, { fillColor: '#222' }, item)
    expect(next.map((k) => k.frame)).toEqual([0, 30])
    expect(next[0]!.patch.fillColor).toBe('#ffffff') // baseline captured pre-change
    expect(next[1]!.patch.fillColor).toBe('#222')
  })

  it('merges into an existing entry at the same frame (one mark per frame)', () => {
    const item = baseItem({ keyframes: [{ frame: 30, patch: { fillColor: '#222' } }] })
    const next = mergeKeyframe(item.keyframes, 30, { strokeWidth: 4 }, item)
    expect(next).toHaveLength(1)
    expect(next[0]!.patch).toEqual({ fillColor: '#222', strokeWidth: 4 })
  })

  it('no auto-baseline when the first change is at frame 0', () => {
    const item = baseItem()
    const next = mergeKeyframe(item.keyframes, 0, { fillColor: '#222' }, item)
    expect(next).toHaveLength(1)
    expect(next[0]!.frame).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/features/shapes-konva/utils/shape-keyframes.test.ts`
Expected: FAIL — cannot resolve `./shape-keyframes`.

- [ ] **Step 3: Implement the engine**

Create `src/features/shapes-konva/utils/shape-keyframes.ts`:

```ts
import type { ShapeItem, ShapeKeyframe } from '@/types/timeline'

/** True for a mergeable plain object (not null, not an array). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Deep-merge `patch` onto `target`, returning a new object. Plain objects
 * recurse (so `{transform:{x}}` keeps the other transform fields); arrays and
 * primitives REPLACE wholesale (so `freePolygonData.vertices` swaps atomically).
 */
export function deepMergePatch<T extends Record<string, unknown>>(
  target: T,
  patch: Partial<T>,
): T {
  const out: Record<string, unknown> = { ...target }
  for (const key of Object.keys(patch)) {
    const pv = (patch as Record<string, unknown>)[key]
    const tv = out[key]
    out[key] = isPlainObject(pv) && isPlainObject(tv) ? deepMergePatch(tv, pv) : pv
  }
  return out as T
}

/**
 * Effective shape at a clip-relative frame: fold every keyframe with
 * `frame <= frame` onto the base item. Step playback. Returns the SAME
 * reference when nothing applies, so memoised consumers don't re-render.
 */
export function resolveShapeAtFrame(item: ShapeItem, frame: number): ShapeItem {
  const kfs = item.keyframes
  if (!kfs || kfs.length === 0) return item
  let merged: ShapeItem | null = null
  for (const kf of kfs) {
    if (kf.frame > frame) break // kept sorted by mergeKeyframe
    merged = deepMergePatch(merged ?? item, kf.patch) as ShapeItem
  }
  return merged ?? item
}

/**
 * Append/merge a keyframe at `frame`, returning a new sorted array.
 *  - First change at frame > 0 → also record a frame-0 baseline capturing the
 *    pre-change values of exactly the keys in `patch` (so scrubbing before the
 *    first keyframe shows the original, not the just-edited, value).
 *  - A keyframe already at `frame` → deep-merge the patch into it (so multiple
 *    edits at one playhead collapse to one mark).
 */
export function mergeKeyframe(
  existing: ShapeKeyframe[] | undefined,
  frame: number,
  patch: Partial<ShapeItem>,
  baseline: ShapeItem,
): ShapeKeyframe[] {
  const list = existing ? existing.map((k) => ({ frame: k.frame, patch: { ...k.patch } })) : []

  if (list.length === 0 && frame > 0) {
    const basePatch: Partial<ShapeItem> = {}
    for (const key of Object.keys(patch) as (keyof ShapeItem)[]) {
      // Snapshot the whole pre-change value for this key (objects included).
      ;(basePatch as Record<string, unknown>)[key as string] = baseline[key]
    }
    list.push({ frame: 0, patch: basePatch })
  }

  const at = list.find((k) => k.frame === frame)
  if (at) {
    at.patch = deepMergePatch(at.patch as Record<string, unknown>, patch as Record<string, unknown>) as Partial<ShapeItem>
  } else {
    list.push({ frame, patch: { ...patch } })
  }
  list.sort((a, b) => a.frame - b.frame)
  return list
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/features/shapes-konva/utils/shape-keyframes.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/features/shapes-konva/utils/shape-keyframes.ts src/features/shapes-konva/utils/shape-keyframes.test.ts
git commit -m "feat(shapes): generic keyframe engine (deep-merge resolver + recorder)"
```

---

## Task 3: The single record path — `commitShapeUpdate`

**Files:**
- Create: `src/features/shapes-konva/stores/actions/commit-shape-update.ts`

- [ ] **Step 1: Implement**

Create `src/features/shapes-konva/stores/actions/commit-shape-update.ts`:

```ts
import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { mergeKeyframe } from '../../utils/shape-keyframes'

/**
 * The single write path for shape edits. Updates the base item AND records a
 * keyframe of `patch` at the current clip-relative frame — in ONE updateItem
 * call, so it's a single undo entry. Used by every edit surface (panel, body
 * drag, transformer, vertex). `patch` is any subset of ShapeItem fields.
 */
export function commitShapeUpdate(itemId: string, patch: Partial<ShapeItem>): void {
  const state = useTimelineStore.getState()
  const item = state.items.find((it) => it.id === itemId) as ShapeItem | undefined
  if (!item || item.type !== 'shape') return

  const frame = usePlaybackStore.getState().currentFrame
  const rel = Math.max(0, Math.min(item.durationInFrames - 1, frame - item.from))
  const keyframes = mergeKeyframe(item.keyframes, rel, patch, item)

  state.updateItem(itemId, { ...patch, keyframes })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/shapes-konva/stores/actions/commit-shape-update.ts
git commit -m "feat(shapes): commitShapeUpdate — single update+record path (one undo entry)"
```

---

## Task 4: Route preview resolution to `item.keyframes`

**Files:**
- Modify: `src/features/shapes-konva/components/shape-router.tsx`
- Modify: `src/features/shapes-konva/components/shapes-stage.tsx`

- [ ] **Step 1: shape-router uses the new resolver**

In `shape-router.tsx`: replace the import of `resolveShapeAtFrame` (and `useShapeKeyframesStore`) from `../stores/shape-keyframes-store` with:

```ts
import { resolveShapeAtFrame } from '../utils/shape-keyframes'
```

Remove the `useShapeKeyframesStore` subscription line (the `const changes = useShapeKeyframesStore(...)`). Replace the resolve call:

```ts
const itemAfterKeyframes = resolveShapeAtFrame(props.item, props.frame - props.item.from)
```

(`mergePreview` and the rest stay as-is.)

- [ ] **Step 2: shapes-stage uses the new resolver**

In `shapes-stage.tsx`: remove the `useShapeKeyframesStore` import + the `keyframesByItemId` subscription. Change the `selectedShapes` memo to:

```ts
const selectedShapes = useMemo(
  () =>
    visibleShapes
      .filter((s) => selectedSet.has(s.id))
      .map((s) => resolveShapeAtFrame(s, currentFrame - s.from)),
  [visibleShapes, selectedSet, currentFrame],
)
```

with `import { resolveShapeAtFrame } from '../utils/shape-keyframes'`.

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: PASS. (The old store still exists; we just stopped reading it here.)

- [ ] **Step 4: Commit**

```bash
git add src/features/shapes-konva/components/shape-router.tsx src/features/shapes-konva/components/shapes-stage.tsx
git commit -m "refactor(shapes): resolve preview from item.keyframes"
```

---

## Task 5: Cut over ALL record paths to `commitShapeUpdate` (atomic)

This is the one set that must change together so no edit writes to the dead store.

**Files:**
- Modify: `src/features/shapes-konva/hooks/use-shape-callbacks.ts`
- Modify: `src/features/shapes-konva/components/parametric-transformer.tsx`
- Modify: `src/features/editor/components/properties-sidebar/clip-panel/shape-properties.tsx`

- [ ] **Step 1: Rewrite `use-shape-callbacks.ts`**

Replace the whole `recordIfShape`/`patchToKeyframePatch` machinery and the callback bodies with `commitShapeUpdate`. `onUpdateData` becomes a direct passthrough; `onUpdateVertex` builds the geometry patch (reusing `moveArrowEndpoint`) and commits it. Full new file body:

```tsx
import { useMemo } from 'react'
import { useSelectionStore } from '../deps/selection'
import { useTimelineStore } from '../deps/timeline'
import { commitShapeUpdate } from '../stores/actions/commit-shape-update'
import { moveArrowEndpoint } from '../utils/arrow-curve'
import type { ShapeCallbacks } from '../types'
import type { ShapeItem } from '@/types/timeline'

export function useShapeCallbacks(): ShapeCallbacks {
  const selectItems = useSelectionStore((s) => s.selectItems)

  return useMemo<ShapeCallbacks>(
    () => ({
      onSelect: (id, event) => {
        const evt = event?.evt as MouseEvent | TouchEvent | undefined
        const isMulti =
          !!evt && 'ctrlKey' in evt && (evt.ctrlKey || ('metaKey' in evt && evt.metaKey))
        if (isMulti) {
          const current = useSelectionStore.getState().selectedItemIds
          selectItems(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
        } else {
          selectItems([id])
        }
      },
      onMove: () => {},
      onUpdateData: (id, patch) => commitShapeUpdate(id, patch),
      onUpdateVertex: (id, idx, x, y) => {
        const item = useTimelineStore.getState().items.find((it) => it.id === id) as
          | ShapeItem
          | undefined
        if (!item || item.type !== 'shape') return
        if (item.shapeType === 'arrow' && item.arrowData) {
          const next =
            idx === 0 || idx === 1
              ? moveArrowEndpoint(item.arrowData, idx, x, y)
              : { ...item.arrowData, controlX: x, controlY: y }
          commitShapeUpdate(id, { arrowData: next })
          return
        }
        if (
          (item.shapeType === 'free-polygon' || item.shapeType === 'connected-rings') &&
          item.freePolygonData
        ) {
          const v = [...item.freePolygonData.vertices]
          v[idx * 2] = x
          v[idx * 2 + 1] = y
          commitShapeUpdate(id, { freePolygonData: { ...item.freePolygonData, vertices: v } })
        }
      },
    }),
    [selectItems],
  )
}
```

- [ ] **Step 2: parametric-transformer records on transformEnd**

In `parametric-transformer.tsx`, replace the two `updateItem(...)` calls in `onTransformEnd` with `commitShapeUpdate(id, ...)` (same payloads). Add `import { commitShapeUpdate } from '../stores/actions/commit-shape-update'` and remove the now-unused `useTimelineStore`/`updateItem` if nothing else uses them.

For the timer branch:
```ts
commitShapeUpdate(id, {
  transform: nextTransform,
  timerData: { ...currentItem.timerData!, fontSize: Math.max(1, Math.round(currentItem.timerData!.fontSize * scaleX)) },
})
continue
```
For the default branch:
```ts
commitShapeUpdate(id, { transform: nextTransform })
```

- [ ] **Step 3: properties panel — every setter records**

In `shape-properties.tsx`:
- Delete `KEYFRAMEABLE_PROPS`, `pickKeyframeableProps`, `recordChange`, and the `useShapeKeyframesStore` import.
- Replace `updateAll` body with a version that records:

```ts
const updateAll = useCallback(
  (updates: Partial<ShapeItem>) => {
    for (const item of shapeItems) commitShapeUpdate(item.id, updates)
  },
  [shapeItems],
)
```
- Change every nested setter (`updateFieldRingData`, `updateConnectedData`, `updateConnectedRing`, `updateConnectedClosed`, `updateTextData`, `updateTimerData`, `updateSpotlightData`, `updateSpotlightTransform`) to build the same patch they build today but call `commitShapeUpdate(item.id, patch)` instead of `updateItem(item.id, patch)`. Example (`updateSpotlightData`):

```ts
const updateSpotlightData = useCallback(
  (patch: Partial<NonNullable<ShapeItem['spotlightData']>>) => {
    const item = shapeItems.find((it) => it.shapeType === 'spotlight')
    if (!item) return
    commitShapeUpdate(item.id, { spotlightData: { ...item.spotlightData!, ...patch } })
  },
  [shapeItems],
)
```
Apply the identical transform to the others (merge with the existing nested object, then `commitShapeUpdate`). `updateSpotlightTransform` becomes `commitShapeUpdate(item.id, { transform: { ...item.transform, ...patch } })`.

Add `import { commitShapeUpdate } from '@/features/editor/deps/shapes-konva'` (export it from that deps adapter — see Task 7).

- [ ] **Step 4: Verify**

Run: `npm run check` then `npm run test:run -- src/features/shapes-konva`
Expected: PASS.

- [ ] **Step 5: Manual smoke**

`npm run dev`: drag a spotlight, then edit its intensity + width at two playhead positions → both register marks and the panel stays live (no freeze). Drag a rectangle and a connected-rings node → marks register.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(shapes): all edits record via commitShapeUpdate (keyframes on clip)"
```

---

## Task 6: Clip change-mark UI reads `item.keyframes`

**Files:**
- Modify: `src/features/timeline/components/timeline-item/clip-shape-keyframes.tsx`

- [ ] **Step 1: Read frames from the item**

Replace the `useShapeKeyframesStore` subscription with the item's own keyframes. The component already receives (or can select) the `ShapeItem`; derive the marks:

```ts
const frames = (item.type === 'shape' ? item.keyframes : undefined)?.map((k) => k.frame) ?? []
```

Remove the `deps/shapes-konva` store import. Keep the existing rendering of one tick per frame (the recorder already collapses same-frame edits).

- [ ] **Step 2: Verify**

Run: `npm run check`
Expected: PASS. Manual: the clip bar shows a tick at each recorded frame, matching Task 5's edits.

- [ ] **Step 3: Commit**

```bash
git add src/features/timeline/components/timeline-item/clip-shape-keyframes.tsx
git commit -m "refactor(timeline): clip change-marks from item.keyframes"
```

---

## Task 7: Delete the side store + fix deps adapters

**Files:**
- Delete: `src/features/shapes-konva/stores/shape-keyframes-store.ts`
- Delete: `src/features/shapes-konva/stores/actions/update-vertex.ts` (logic folded into Task 5)
- Modify: deps adapters re-exporting them.

- [ ] **Step 1: Find remaining references**

Run: `grep -rn "useShapeKeyframesStore\|shape-keyframes-store\|update-vertex\|resolveShapeAtFrame" src --include=*.ts --include=*.tsx`
Every hit must be either updated to the new util or removed. Update `src/features/editor/deps/shapes-konva.ts` to export `commitShapeUpdate` (used by the panel) and drop the store/`ShapeKeyframeProperty`/`PropertiesPreview`-via-store exports that no longer exist. Update `src/features/timeline/deps/shapes-konva.ts` similarly.

- [ ] **Step 2: Delete the files**

```bash
git rm src/features/shapes-konva/stores/shape-keyframes-store.ts src/features/shapes-konva/stores/actions/update-vertex.ts
```

- [ ] **Step 3: Verify everything**

Run: `npm run check`, `npm run test:run`, `npm run check:boundaries`, `npm run check:deps-contracts`
Expected: PASS. If `check` flags a missing import, point it at `../utils/shape-keyframes` (resolver) or the deps `commitShapeUpdate`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(shapes): delete in-memory keyframe side store (now on the clip)"
```

---

## Task 8: Persistence + undo verification

**Files:** none (verification task).

- [ ] **Step 1: Persistence round-trip**

`npm run dev`: add a spotlight, record a couple of edits at different frames, save the project, reload it. The keyframes survive (scrub → values change at the recorded frames). This proves `item.keyframes` is in the project JSON (the `.passthrough()` schema carries it; no migration).

- [ ] **Step 2: Undo/redo**

Make an edit (records a keyframe) → Ctrl+Z → the keyframe and the base change both revert in one step (single undo entry from `commitShapeUpdate`). Redo restores.

- [ ] **Step 3: Known carry-over (document, do not fix here)**

Splitting/trimming a keyframed shape copies the full keyframe list to both halves with unchanged clip-relative frames (same limitation the old store had). Note it in the PR description; out of scope for this plan.

---

## Self-review notes (already applied)

- **Spec coverage:** registry-on-item (T1), generic deep-merge resolver + step (T2), one record path + auto-baseline + same-frame collapse (T2/T3/T5), persistence + undo free (T8), side store deleted (T7), clip-mark UI migrated (T6). Export is Phase 2 (separate plan).
- **Type consistency:** `ShapeKeyframe`, `deepMergePatch`, `resolveShapeAtFrame(item, frame)`, `mergeKeyframe(existing, frame, patch, baseline)`, `commitShapeUpdate(itemId, patch)` are used identically across tasks.
- **No interpolation** anywhere (step only), matching the decision.

## Phase 2 (separate plan, after this lands)

Export: `render-item.ts` resolves `item.keyframes` via this same `resolveShapeAtFrame` (worker-safe) then draws; add Canvas-2D mirror renderers in `canvas-shapes.ts` for `field-ring`, `connected-rings`, `text`, `timer` (reusing `timer-format`/`field-ring-geometry`), and the **spotlight exact-parity** temp-OffscreenCanvas sub-pipeline (destination-out + blur isolated like the cached Konva group); wire the resolver through `src/features/export/deps/*`; confirm worker font availability for text/timer.
