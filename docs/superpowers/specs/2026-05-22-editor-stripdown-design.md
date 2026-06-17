# MatchView Editor Strip-Down — Design

**Date:** 2026-05-22
**Status:** Approved
**Topic:** Strip the FreeCut editor screen down to what a match-analysis tool needs.

## Summary

The editor screen inherits FreeCut's full video-production surface — GPU effects,
transitions, keyframe animation, masks, AI voice/music generation, color scopes,
audio EQ/mixing, text & shape templates, compositions, and more. MatchView's
workflow is narrower: **review footage, tag key moments, trim, and work with
lockable/hideable/reorderable tracks.** This spec removes the irrelevant UI so the
editor matches that workflow.

## Goals

- The editor screen exposes only controls relevant to review / tag / trim.
- The five-zone layout (Toolbar · Media sidebar · Preview · Properties sidebar ·
  Timeline) is kept; only its contents are decluttered.
- Slow-motion review is preserved.
- Nothing in the render/timeline engine breaks.

## Non-Goals (YAGNI)

- **No code deletion.** This is a UI-surface removal only ("hide now, delete
  later"). The effects pipeline, transition engine, keyframe system, mask
  system, audio mixer, etc. stay in the codebase, untouched and unreachable.
  Code deletion is a separate future pass.
- **No screenshot feature.** Deferred — the user intends a different approach to
  frame capture; it is out of scope here.
- No layout re-architecture (Approach A was chosen over a reshaped layout).
- No new analysis features (telestration, event database, highlight compiler).

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Core workflow | Review, tag, trim; lockable/hideable/reorderable tracks |
| Removal depth | Hide from UI now; code deletion deferred |
| Layout | Approach A — keep the five-zone shell, declutter contents |
| Slow-motion | Keep a playback-speed control |
| Screenshot | Deferred — not in this spec |

## Architecture

**Method:** every removal is a UI change — deleting/conditionally-not-rendering
a button, tab, panel, tool, or dialog trigger. No store, engine, or data-model
code is removed. Underlying timeline item types and the render pipeline are
unchanged, so an existing project with effects/transitions/keyframes still loads
and renders; the user simply has no controls to add or edit them.

Where a removal leaves a now-unreachable component (e.g. the Transition
properties panel, composition breadcrumbs), that component is left in place,
dead but harmless — consistent with "hide now, delete later."

## Strip-down inventory

### Toolbar — `src/features/editor/components/toolbar.tsx`

- **Keep:** back button, project name + resolution/fps badge, Save, Export Video,
  Settings, Keyboard Shortcuts. The DEV-only debug popover stays (not shipped).
- **Remove:** local AI inference status pill, What's New / changelog button,
  GitHub link, language switcher (language is still changeable in
  Settings → General), and the "Download Project ZIP" item from the Export
  control — Export collapses to a single "Export Video" action.

### Media sidebar — `src/features/editor/components/media-sidebar.tsx`

- **Keep:** the Media library panel (import & browse footage), and the
  collapse / full-column toggles.
- **Remove:** the icon-rail tabs Text, Shapes, Effects, Transitions, AI (and
  their panels: text template picker, shape picker, effect picker,
  `transitions-panel.tsx`, `ai-panel.tsx`), and the Keyframe Editor rail toggle
  + `KeyframeGraphPanel`. With Media the only remaining panel, the rail collapses
  to that single panel.

### Preview — `src/features/editor/components/preview-area.tsx`

- **Keep:** the Program monitor (video canvas), playback controls (play/pause,
  step, go-to-start/end), timecode display, preview zoom, and a
  **playback-speed control for slow-motion review**.
- **Remove:** the Source Monitor panel, the Color Scopes monitor panel, the
  Alignment toolbar, and the Pen Tool / Path Edit modes.

### Properties sidebar — `src/features/editor/components/properties-sidebar/`

- **Keep:** the Marker panel (edit a tag's label) and a minimal canvas/project
  info panel.
- **Remove:** the Clip panel's Video / Audio / Effects tabs and all their
  sections — transform (position/size/rotation/anchor/flip), crop, fill/opacity/
  blend mode, corner pin, text styling & animation, shape, subtitle, GIF,
  audio gain/fade/pitch/EQ, and the effects list. When a clip is selected the
  panel shows only basic clip info (name, source, in/out, duration).
- Slow-motion lives in the Preview zone as a playback-speed control, not here —
  it affects review playback, not a per-clip edit.
- The Transition properties panel is left in place but unreachable (transitions
  can no longer be selected).

### Timeline — `src/features/timeline/components/timeline-header.tsx`, `timeline.tsx`

- **Keep tools:** Select, Trim Edit, Razor/Cut, Snap toggle, Zoom
  (out/slider/in/fit), Markers (add/remove/clear), In/Out points
  (set in, set out, clear). Add Video Track, Add Audio Track, Remove Empty
  Tracks. The timeline navigator/minimap.
- **Remove tools:** Rate-Stretch tool, Slip/Slide tools, Color-Scopes toggle,
  Linked-Selection toggle.
- **Track header controls — keep:** lock, visibility (hide), mute,
  drag-to-reorder. **Remove:** solo, sync-lock.
- **Remove dialog triggers:** Bento-Layout, Reverse-Conform, Silence-Removal,
  Filler-Removal (the dialog components and any hotkeys that open them).

### Audio meter panel — `src/features/editor/components/audio-meter-panel.tsx`

- **Remove entirely** — the VU meter / mixer / EQ column beside the timeline.
  `editor.tsx` no longer renders `AudioMeterPanel`; the timeline spans the full
  width.

### editor.tsx — `src/features/editor/components/editor.tsx`

- Stops rendering `AudioMeterPanel`, `BentoLayoutDialog`, `ReverseConformDialog`,
  `SilenceRemovalDialog`, `FillerRemovalDialog`, and the lazy dialog hosts that
  belong to removed features (TTS generate, embedded-subtitle picker, subtitle
  scan, clear-keyframes). Export-bundle wiring is removed alongside the toolbar's
  bundle item.

## Components / units of work

| Unit | Responsibility |
|------|----------------|
| Toolbar declutter | Remove the 5 toolbar items; collapse Export to one action |
| Media sidebar declutter | Drop 5 rail tabs + keyframe toggle; Media-only panel |
| Preview declutter | Remove source/scopes monitors, alignment bar, pen/path modes |
| Properties declutter | Reduce Clip panel to clip-info + speed; keep Marker/canvas |
| Timeline declutter | Remove 4 tools + 2 track controls; remove 4 dialog triggers |
| Audio meter removal | Remove `AudioMeterPanel` from `editor.tsx` |

## Risks

- **Shared dependencies.** Some removed tools may share state, hotkeys, or
  layout assumptions with kept ones (e.g. the timeline tool enum, the properties
  panel's selection switch). Each removal must check it doesn't break a kept
  path. Mitigation: implement zone-by-zone; run `npm run build` + the app after
  each zone.
- **Hotkeys.** Hotkeys bound to removed tools (rate-stretch, slip/slide,
  keyframe editor toggle, silence/filler removal) should be removed from the
  hotkey config so they don't trigger invisible features.
- **Dead unreachable components** (Transition panel, composition breadcrumbs,
  Clip panel sections kept in the tree) are acceptable per "hide now" — but the
  implementer must confirm they are genuinely unreachable, not just unstyled.
- **Properties Clip panel** is the riskiest edit — it is a large multi-tab
  component; reducing it to clip-info + speed must not break the
  selection-driven panel switch.

## Verification

- `npm run build` succeeds; `npm run test:run` passes.
- `npm run dev`: the editor shows only the kept controls; importing footage,
  scrubbing, trimming, cutting, adding/removing/locking/hiding/reordering tracks,
  adding markers, setting in/out points, and slow-mo playback all still work.
- Opening a pre-existing project that contains effects/transitions/keyframes
  still loads and plays — the data is intact, just not editable.
