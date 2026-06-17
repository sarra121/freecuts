# Field Ring shape — design

**Date:** 2026-06-04
**Status:** approved (pending spec review)
**Author:** in collaboration with the project owner

## Goal

Add a new sports-specific shape type, **`field-ring`** — a squashed,
field-level ring that sits under a player (think TV broadcast player
highlights) and optionally spins. Rendered as a dashed ellipse band with
configurable squash, band thickness, radius, segments, gap, rounded ends,
extrusion height, spin (on/off + speed), color, and a contact shadow.

Business context: football (soccer) sequence editing in MatchView. The ring
is laid over a `<video>` clip in the preview.

This is a **MatchView shape**, following the exact precedent of `arrow` and
`free-polygon`.

## The look (locked during brainstorm)

- Thick **band** (a stroked ellipse), solid color — **no shading/gradient
  toggle**.
- **Chopped** into curved segments by default; **continuous** is always
  available as a toggle.
- Segments are arcs of the ellipse (a dashed stroke), so they curve along
  the ring on both edges — not straight rectangles.
- Optional **extrusion** (stacked, darker, offset-down copies) gives subtle
  3D height on the pitch. `extrusionHeight = 0` → flat 2D.
- Optional **contact shadow** (soft dark ellipse beneath) grounds it.
- Segment ends: **rounded** or **square** (the dashed `lineCap`). There is
  no continuous "roundedness" slider — that only existed in the rejected
  rectangle-segment approach.

Reference prototype:
`.superpowers/brainstorm/403-1780567754/content/konva-proto-v3.html`.

## Scope (v1)

**In scope:** editor + live-preview rendering via Konva, full property
panel, creation flow.

**Out of scope for v1** (see "Follow-ups"):

- **Export rendering.** The ring will NOT appear in exported video until the
  Canvas-2D mirror renderer lands. This is an accepted, known gap.
- **Player occlusion** ("video sandwich"). Needs a person-segmentation
  matte that the project does not have. v1 is a plain overlay; the ring may
  slightly cover the player's feet.
- **Ring-specific keyframing** beyond what the generic shape-keyframes
  system already provides for transform/color.

## Architecture context (how shapes render in this project)

Two independent rendering paths exist:

1. **Editor + live preview** — `shapes-konva/` owns all shape drawing via a
   Konva `ShapesStage` mounted in `preview-stage.tsx`. The legacy DOM
   `ShapeContent` renderer in `runtime/composition-runtime/` is gated OFF
   for shapes (see the comment in `composition-runtime/components/item.tsx`).
2. **Export** — `features/export/utils/canvas-shapes.ts` has dedicated
   Canvas-2D renderers that **mirror** the Konva look. `arrow` and
   `free-polygon` already have `renderArrowToCanvas` /
   `renderFreePolygonToCanvas`; parametric shapes use a transform-based
   canvas path.

`field-ring` follows path 1 in v1; path 2 (`renderFieldRingToCanvas`) is the
deferred follow-up.

## Data model

Add to `src/types/timeline.ts`:

```ts
export type ShapeType =
  | 'rectangle' | 'circle' | 'triangle' | 'ellipse' | 'star'
  | 'polygon' | 'heart' | 'path'
  | 'arrow' | 'free-polygon'
  | 'field-ring'                       // NEW

/** Field-level ring under a player. Used when shapeType === 'field-ring'.
 *  The ellipse bounding box comes from ShapeItem.transform (radiusX =
 *  transform.width / 2). `squash` derives radiusY. Band color = fillColor. */
export interface FieldRingData {
  squash: number          // 0.12–1   radiusY / radiusX (low = flat field ring)
  bandThickness: number   // px       band/stroke weight
  segments: number        // chopped segment count (default 6)
  continuous: boolean     // true = unbroken band (segments/gap ignored)
  gapRatio: number        // 0–0.8    gap fraction between segments
  roundedEnds: boolean    // round vs square (butt) segment caps
  extrusionHeight: number // px       0 = flat 2D
  spin: boolean
  spinSpeed: number       // revolutions/sec, signed (sign = direction)
  contactShadow: boolean
}
```

Add `fieldRingData?: FieldRingData` to `ShapeItem` (alongside `arrowData`,
`freePolygonData`).

**Defaults** (used by the create action and by normalization when missing):

```ts
{ squash: 0.34, bandThickness: 14, segments: 6, continuous: false,
  gapRatio: 0.42, roundedEnds: true, extrusionHeight: 6, spin: true,
  spinSpeed: 0.25, contactShadow: true }
```

Color/size mapping:

- **Band color** = `ShapeItem.fillColor` (already required; no new required
  field).
- **Radius** = `transform.width / 2` (so the existing transformer's resize
  handles control ring size).
- **radiusY** = `radiusX × squash`.

No new required fields are added to `ShapeItem`, and `fieldRingData` is
optional, so **no schema migration is required**. Increment of
`CURRENT_SCHEMA_VERSION` is NOT needed. Normalization
(`shared/projects/migrations/`) should fill `fieldRingData` defaults if a
`field-ring` item is missing it (defensive only).

## Spin is frame-locked (critical correctness rule)

Spin MUST be a pure function of the timeline frame, not wall-clock time:

```
elapsedSec   = (currentFrame − item.from) / fps
revolutions  = spinSpeed × elapsedSec
dashOffset   = (revolutions mod 1) × circumference   // signed
```

Where `circumference` is the ellipse perimeter (Ramanujan approximation of
`radiusX`, `radiusY`).

Rationale:

- **Scrubbing/pausing** shows the correct phase at every frame.
- **Preview ↔ export agree.** Export renders frame-by-frame offline with no
  wall clock; a wall-clock animation would desync. Frame-locking is what
  makes the eventual export mirror match the preview exactly.

The Konva renderer therefore drives `dashOffset` from the playback store's
current frame, NOT from `Konva.Animation`'s `frame.time`. (A `Konva.Animation`
may still be used as the *tick source* to request redraws during playback,
but the offset value itself is computed from the playhead frame.)

## Konva renderer

New `src/features/shapes-konva/shapes/field-ring-shape.tsx`. Renders inside
the parametric `ParametricShapeBody` wrapper (so move/drag/selection/Konva
`id` come for free), bottom-to-top:

1. **Contact shadow** (when `contactShadow`): soft dark `Ellipse` offset
   down, low opacity, `shadowBlur`.
2. **Extruded wall** (when `extrusionHeight > 0`): `extrusionHeight` stacked
   dashed `Ellipse`s offset downward by 1px each, stroked in progressively
   darker shades of `fillColor`.
3. **Top band**: one dashed `Ellipse` —
   - `radiusX = transform.width / 2`, `radiusY = radiusX × squash`
   - `stroke = fillColor`, `strokeWidth = bandThickness`
   - `lineCap = roundedEnds ? 'round' : 'butt'`
   - `dash`: from `segments` + `gapRatio` distributed over the circumference
     (`spacing = circumference / segments`,
     `dash = [spacing × (1 − gapRatio), spacing × gapRatio]`)
   - `continuous === true` → no `dash`.
   - `dashOffset` from the frame-locked spin formula above.

A small helper module computes circumference and the dash/offset values so
the (future) export mirror can reuse the identical math.

Spin redraw: a `useFieldRingSpin` hook subscribes to the playback frame and
updates `dashOffset` on the band + wall ellipses. Only active while `spin`
is true and the relevant frame changes.

### Wiring

- `shape-router.tsx`: add `case 'field-ring': return <FieldRingShape … />`.
- Selection/transform: reuse `ShapeTransformer` → `ParametricTransformer`
  (resize changes `transform.width`). Squash is a property slider, not a
  drag handle, to keep behavior predictable.

## Creation flow

- `src/features/shapes-konva/stores/actions/create-field-ring.ts` — mirrors
  `create-parametric-shape.ts`: spawn at the current playhead, default 5s
  duration, default `fieldRingData` (above), `fillColor` default tuned for
  grass (e.g. a bright blue `#2f97ff`).
- Extend the click-to-place tool (`use-place-parametric-tool.tsx` /
  `draw-tool-store.ts`) so `field-ring` can be placed at a clicked point
  (same UX as the parametric shapes).
- Add a **"Field ring"** entry to the shape picker in
  `features/editor/components/media-sidebar.tsx`.

## Properties panel

In `features/editor/components/properties-sidebar/clip-panel/shape-section.tsx`,
branch on `shapeType === 'field-ring'` to render a dedicated control set and
hide the generic controls that don't apply (corner radius, points, star
inner radius, triangle direction). Reuse `PropertySection`, `SliderInput`,
`NumberInput`, `ColorPicker`, and the existing live-preview pattern
(`setPropertiesPreviewNew` / `clearPreview`).

Controls, in order:

1. **Color** (`fillColor`)
2. **Radius** (`transform.width`)
3. **Squash** (slider 0.12–1)
4. **Band thickness** (slider, px)
5. **Extrusion height** (slider 0–14 px)
6. **Continuous** (toggle)
   - when OFF: **Segments** (number, default 6), **Gap** (slider 0–0.8),
     **Rounded ends** (toggle)
7. **Spin** (toggle)
   - when ON: **Spin speed** (slider, revolutions/sec, allow negative for
     direction)
8. **Contact shadow** (toggle)

Live preview: the field-ring props route through the same preview merge that
`shape-router.tsx` already applies (it shallow-merges `arrowData` /
`freePolygonData` previews — extend `mergePreview` to shallow-merge
`fieldRingData` so a partial preview like `{ squash: 0.5 }` doesn't wipe the
rest of the blob).

## i18n

Add new keys (shape type label + each property label/toggle) across all 9
languages (`en, es, fr, de, pt-BR, tr, ja, ko, zh`), via the shapes/editor
locale partials, keeping identical key structure. No bare ASCII `"` inside
JSON string values.

## Files touched

New:

- `src/features/shapes-konva/shapes/field-ring-shape.tsx`
- `src/features/shapes-konva/stores/actions/create-field-ring.ts`
- `src/features/shapes-konva/utils/field-ring-geometry.ts` (circumference +
  dash/offset math, shared with the future export mirror)
- `src/features/shapes-konva/hooks/use-field-ring-spin.ts`

Modified:

- `src/types/timeline.ts` — `ShapeType` union, `FieldRingData`,
  `ShapeItem.fieldRingData`
- `src/features/shapes-konva/components/shape-router.tsx` — route + extend
  `mergePreview`
- `src/features/shapes-konva/utils/defaults.ts` — `FIELD_RING_DEFAULTS`
- `src/features/shapes-konva/stores/draw-tool-store.ts` /
  `hooks/use-place-parametric-tool.tsx` — placement support
- `src/features/editor/components/media-sidebar.tsx` — picker entry
- `src/features/editor/components/properties-sidebar/clip-panel/shape-section.tsx`
  — field-ring control branch
- i18n locale partials (9 languages)
- `src/shared/projects/migrations/` normalization — defensive defaults

## Verification

- `npm run check`, `npm run test:run`, `npm run check:boundaries`,
  `npm run check:deps-contracts` pass.
- Manual matrix in the editor:
  - Add a field-ring from the picker → ring appears at the playhead.
  - Each property (color, radius, squash, thickness, extrusion, segments,
    gap, rounded ends, spin, spin speed, contact shadow) updates live.
  - Continuous toggle hides segment controls and draws an unbroken band.
  - Press play → segments march; **pause/scrub → phase matches the frame**
    (frame-locked check).
  - Drag to move; resize handle changes radius; undo/redo works.

## Follow-ups (post-v1)

1. **Export mirror** — `renderFieldRingToCanvas` in `canvas-shapes.ts`,
   reusing `field-ring-geometry.ts` and the frame-locked spin formula so
   exported video matches the preview. **Until this ships, exports omit the
   ring.**
2. **Player occlusion (video sandwich)** — `[video] → [ring] → [video
   masked to player]`, requiring a new person-segmentation matte
   (MediaPipe / WebGPU). Lets the player paint over the ring while the ring
   shows through around them.
3. **Ring-specific keyframing** if users want squash/segments/spin to
   animate independently.
