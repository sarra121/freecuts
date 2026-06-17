# MatchView Editor Strip-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the editor screen down to the controls a match-analysis tool needs — review, tag, trim, lockable/hideable/reorderable tracks — by removing the inherited video-production UI surface.

**Architecture:** UI-surface removal only ("hide now, delete later"). Every change deletes or stops rendering a button, tab, panel, tool, dialog, or hotkey. No store, engine, render-pipeline, or data-model code is removed — existing projects with effects/transitions/keyframes still load and play, the user just has no controls to edit them. The five-zone editor layout (Toolbar · Media sidebar · Preview · Properties sidebar · Timeline) is kept; only its contents shrink.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, Zustand.

**Reference spec:** `docs/superpowers/specs/2026-05-22-editor-stripdown-design.md`

**No git commits** — per the user's standing preference, all changes stay uncommitted in the working tree on the `pitchsense` branch. Each task ends with a build/run verification instead of a commit.

---

## File Structure

| Zone | Primary file(s) |
|------|-----------------|
| Toolbar | `src/features/editor/components/toolbar.tsx` |
| Media sidebar | `src/features/editor/components/media-sidebar.tsx` |
| Preview | `src/features/editor/components/preview-area.tsx` |
| Slow-mo control | `src/features/preview/components/playback-controls.tsx` |
| Properties sidebar | `src/features/editor/components/properties-sidebar/index.tsx`, `.../clip-panel/index.tsx` |
| Timeline | `src/features/timeline/components/timeline-header.tsx`, `timeline.tsx`, track-header component |
| Audio meter + shell | `src/features/editor/components/editor.tsx` |
| Hotkeys | `src/config/hotkeys.ts` |

Each task is self-contained: it leaves the app building and runnable. Tasks are ordered so the highest-risk one (properties Clip panel) sits in the middle, after the simpler removals have proven the pattern.

---

## Task 1: Toolbar declutter

**Files:**
- Modify: `src/features/editor/components/toolbar.tsx`

- [ ] **Step 1: Read the file and locate the removal targets**

Open `src/features/editor/components/toolbar.tsx`. Identify these rendered elements:
- the local AI inference status pill (component `LocalInferenceStatusPill`, from `local-inference-status-pill.tsx`)
- the "What's New" / changelog button (Sparkles icon, opens `WhatsNewDialog`)
- the GitHub link button
- the `LanguageSwitcher` dropdown
- the Export control's "Download Project ZIP" / bundle menu item

- [ ] **Step 2: Remove the five elements**

Delete each element's JSX and its now-unused imports. For the Export control: it is a dropdown with two items (Export Video, Download Project ZIP) — remove the bundle item; if that leaves a single-item dropdown, collapse it to a plain "Export Video" button calling the existing `onExport` handler. Leave `onExportBundle` prop wiring removable in Task 7 (editor.tsx) — for now, if removing the bundle item makes the `onExportBundle` prop unused, keep the prop but stop using it (Task 7 removes it cleanly).

Keep: back button, project name + resolution/fps badge, Save, Export Video, Settings, Keyboard Shortcuts, and the DEV-only debug popover.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds, no unused-import or type errors. If the build reports an unused import, remove it.

- [ ] **Step 4: Visual check**

Run `npm run dev`, open a project's editor. The toolbar shows only: back, project name/badge, Save, Export, Settings, Shortcuts. No AI pill, no What's New, no GitHub, no language dropdown.

---

## Task 2: Media sidebar declutter

**Files:**
- Modify: `src/features/editor/components/media-sidebar.tsx`

- [ ] **Step 1: Read the file and locate the rail tabs**

Open `src/features/editor/components/media-sidebar.tsx`. It renders a vertical icon rail whose tabs are: Media, Text, Shapes, Effects, Transitions, AI — plus a Keyframe Editor toggle (LineChart icon) that expands `KeyframeGraphPanel`.

- [ ] **Step 2: Remove every tab except Media, and the keyframe toggle**

Remove the rail entries and their rendered panels for Text, Shapes, Effects, Transitions, AI (the text template picker, shape picker, effect picker, `transitions-panel.tsx`, `ai-panel.tsx`). Remove the Keyframe Editor toggle button and the `KeyframeGraphPanel` it renders. Remove the now-unused imports.

With Media the only remaining tab, simplify: if the rail would now show a single icon, render the Media library panel directly without the icon rail (or keep a rail with just the Media icon if that is structurally simpler — either is acceptable; pick whichever is the smaller, cleaner diff). Keep the collapse/expand and full-column toggle controls.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds. Remove any unused imports it flags.

- [ ] **Step 4: Visual check**

Run `npm run dev`. The left sidebar shows only the Media library. No Text/Shapes/Effects/Transitions/AI tabs, no keyframe-editor toggle.

---

## Task 3: Preview declutter

**Files:**
- Modify: `src/features/editor/components/preview-area.tsx`

- [ ] **Step 1: Read the file and locate the removal targets**

Open `src/features/editor/components/preview-area.tsx`. It renders a three-panel resizable split (Source Monitor, Program Monitor, Color Scopes Monitor) and a context-sensitive control bar below the canvas with an Alignment toolbar row, plus Pen Tool and Path Edit alternate modes.

- [ ] **Step 2: Remove the source monitor, scopes monitor, alignment toolbar, and pen/path modes**

Remove:
- the Source Monitor panel and its resizable split slot (`SourceMonitor`)
- the Color Scopes Monitor panel and its split slot (`ColorScopesMonitor`)
- the `AlignmentToolbar` row from the control bar
- the Pen Tool mode and Path Edit mode branches of the control bar (the alternate control bars shown when those modes are active)

After removal the preview is a single Program monitor with the playback-controls row + timecode + preview-zoom beneath it. Collapse the now-single-panel split if a resizable group with one child remains. Remove unused imports.

Keep: the Program monitor (`VideoPreview`), `PlaybackControls`, `TimecodeDisplay`, preview zoom controls.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds. Remove any unused imports flagged.

- [ ] **Step 4: Visual check**

Run `npm run dev`. The preview shows one Program monitor with playback controls, timecode, and zoom. No source monitor, no scopes panel, no alignment row.

---

## Task 4: Add the slow-motion speed control

**Files:**
- Modify: `src/features/preview/components/playback-controls.tsx`

The playback engine already supports a preview-only playback rate: the playback store (`@/shared/state/playback`) exposes `playbackRate: number` and `setPlaybackRate: (rate: number) => void`, and the Clock honors it. There is currently no UI for it. This task adds a minimal speed selector so slow-motion review is usable.

- [ ] **Step 1: Read playback-controls.tsx**

Open `src/features/preview/components/playback-controls.tsx`. Note the existing control style (buttons for play/pause, step, start/end) so the new control matches it.

- [ ] **Step 2: Add a speed selector**

Add a compact speed selector to the playback-controls row, reading `playbackRate` and calling `setPlaybackRate` from `usePlaybackStore` (`@/shared/state/playback`). Offer the values `0.25`, `0.5`, `1`, `2` (labelled `0.25×`, `0.5×`, `1×`, `2×`). Use the project's existing UI primitives — a `Select` (`@/components/ui/select`) or a small button-group styled like the existing controls. The current value reflects `playbackRate`; choosing a value calls `setPlaybackRate(value)`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Functional check**

Run `npm run dev`, open a project with a video clip, press play, and switch the selector to `0.5×` and `0.25×`. Playback visibly slows; `1×` restores normal speed. The selector reflects the current rate.

---

## Task 5: Properties sidebar declutter

**Files:**
- Modify: `src/features/editor/components/properties-sidebar/index.tsx`
- Modify: `src/features/editor/components/properties-sidebar/clip-panel/index.tsx`

This is the highest-risk task — the Clip panel is a large multi-tab component. Reduce it carefully.

- [ ] **Step 1: Read both files**

Open `properties-sidebar/index.tsx` (it selects between CanvasPanel / ClipPanel / TransitionPanel / MarkerPanel based on selection) and `clip-panel/index.tsx` (Video / Audio / Effects tabs with their sections).

- [ ] **Step 2: Reduce the Clip panel to clip info only**

In `clip-panel/index.tsx`, remove the three-tab structure (Video / Audio / Effects) and every section it renders: `LayoutSection`, `VideoSection`, `FillSection`, `CornerPinSection`, `ShapeSection`, `SubtitleSection`, `GifSection`, `AudioSection`, the EQ panel, the effects list/`EffectsSection`, and `TextSection` (both its tabs). In their place render a minimal read-only clip-info block: clip name / source file, in/out points, and duration (use values already available on the selected timeline item — no new data plumbing). Remove unused imports.

- [ ] **Step 3: Keep the panel switch intact**

In `properties-sidebar/index.tsx`, leave the selection-driven switch unchanged: CanvasPanel (nothing selected) and MarkerPanel (marker selected) stay as-is; ClipPanel (clip selected) now renders the reduced clip-info block; TransitionPanel stays in the file but is unreachable (transitions can no longer be selected) — do not delete it. Confirm no `import` is left dangling.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds, no type errors. Remove any unused imports flagged.

- [ ] **Step 5: Functional check**

Run `npm run dev`. With nothing selected → canvas/project info. Select a clip → only clip name/source/in-out/duration, no Video/Audio/Effects tabs. Select a marker → marker label editor still works.

---

## Task 6: Timeline declutter

**Files:**
- Modify: `src/features/timeline/components/timeline-header.tsx`
- Modify: `src/features/timeline/components/timeline.tsx`
- Modify: the track-header component (the per-track row with lock/visibility/solo/sync-lock/mute controls — locate it from `timeline.tsx`'s imports, e.g. a `track-header*.tsx` under `src/features/timeline/components/`)

- [ ] **Step 1: Remove timeline-header tools**

In `timeline-header.tsx`, remove these tool controls: the Rate-Stretch tool, the Slip and Slide tools (their dropdown flyout), the Color-Scopes toggle, and the Linked-Selection toggle. Keep: Select, Trim Edit, Razor/Cut, Undo/Redo, Set In / Set Out / Clear In-Out, Add Marker / Remove Marker / Clear Markers, Snap toggle, and the zoom controls (out / slider / in / fit).

If the tool set is a TypeScript union/enum, removing a tool's button is enough — leave the type member so timeline logic still type-checks ("hide now"). Remove unused imports/icons.

- [ ] **Step 2: Remove solo and sync-lock from track headers**

In the track-header component, remove the Solo button and the Sync-Lock button from each track row. Keep: lock, visibility (hide/show), mute, and drag-to-reorder. Remove unused imports.

- [ ] **Step 3: Keep track add/remove and the navigator**

In `timeline.tsx`, leave the Add Video Track, Add Audio Track, Remove Empty Tracks buttons and the timeline navigator/minimap unchanged.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds. Remove any unused imports flagged.

- [ ] **Step 5: Visual check**

Run `npm run dev`. Timeline header shows only Select/Trim/Razor, Undo/Redo, In-Out, Markers, Snap, Zoom. Each track row shows lock/visibility/mute and can be dragged to reorder; no Solo or Sync-Lock buttons.

---

## Task 7: Remove the audio meter panel and unused dialogs from the editor shell

**Files:**
- Modify: `src/features/editor/components/editor.tsx`

- [ ] **Step 1: Remove the AudioMeterPanel**

In `editor.tsx`, remove the `<AudioMeterPanel />` render (it sits beside `<Timeline />` in the bottom resizable panel) and its import. The timeline now spans the full width of that panel — adjust the surrounding flex container so the timeline fills the row.

- [ ] **Step 2: Remove the fluff dialogs**

Remove the render and imports of `BentoLayoutDialog`, `ReverseConformDialog`, `SilenceRemovalDialog`, and `FillerRemovalDialog`.

Remove the lazy dialog hosts for removed features: `LazyTtsGenerateDialog`, `LazyClearKeyframesDialog`, `LazyEmbeddedSubtitleTrackPickerHost`, `LazySubtitleScanProgressDialog` — and the `EditorDialogHost` entries / store subscriptions that drive them (`useTtsGenerateDialogStore`, `useClearKeyframesDialogStore`, `useEmbeddedSubtitlePickerStore`, `useSubtitleScanProgressStore`). Keep `LazyProjectMediaMatchDialog` and `LazyExportDialog` (still needed). If removing them empties `EditorDialogHost` except for the project-media-match dialog, keep the host with just that entry.

- [ ] **Step 3: Remove the export-bundle wiring**

Remove `LazyBundleExportDialog`, `bundleExportDialogOpen`/`bundleFileHandle` state, `handleExportBundle`, `preloadBundleExportDialog`, and the `onExportBundle` prop passed to `<Toolbar>` (Task 1 already stopped the toolbar from using it). Remove the now-unused imports.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds, no unused-symbol errors. Remove anything flagged.

- [ ] **Step 5: Visual check**

Run `npm run dev`. The timeline spans the full bottom panel — no audio meter column. Export Video still works.

---

## Task 8: Remove hotkeys for the removed tools

**Files:**
- Modify: `src/config/hotkeys.ts`

- [ ] **Step 1: Identify hotkeys bound to removed features**

Open `src/config/hotkeys.ts`. Find hotkey definitions that trigger now-removed features: the Rate-Stretch tool, Slip tool, Slide tool, the Keyframe Editor toggle (`Ctrl+Shift+A`), and any Silence-Removal / Filler-Removal / Bento-Layout shortcuts.

- [ ] **Step 2: Remove those hotkey entries**

Delete those entries so the shortcuts no longer fire invisible features. Leave all other hotkeys (play/pause, cut tool, save, undo/redo, markers, in/out, zoom, etc.) untouched.

- [ ] **Step 3: Verify**

Run: `npm run build && npm run test:run -- src/config/hotkeys.test.ts`
Expected: build succeeds and the hotkeys test passes. If `hotkeys.test.ts` asserts on a removed entry, update the test to match the reduced set.

---

## Task 9: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Full check suite**

Run: `npm run build && npm run test:run`
Expected: build succeeds, tests pass.

- [ ] **Step 2: End-to-end smoke test**

Run `npm run dev` and open a project's editor. Verify the kept workflow all works:
- import footage via the Media library
- scrub and play; switch playback speed to `0.5×` / `0.25×` for slow-mo
- trim a clip (drag edge), cut a clip (razor tool)
- add a track, lock a track, hide a track, drag a track to reorder, remove empty tracks
- add a marker, edit its label in the properties panel, set In/Out points
- Save and Export Video

- [ ] **Step 3: Legacy-project check**

Open a project that contains effects/transitions/keyframes (if one exists). Confirm it still loads and plays — the data is intact, just not editable. No console errors.

---

## Self-Review Notes

- **Spec coverage:** toolbar (Task 1), media sidebar (Task 2), preview + slow-mo (Tasks 3–4), properties sidebar (Task 5), timeline tools + track controls (Task 6), audio meter + shell dialogs (Task 7), hotkey cleanup (Task 8 — flagged as a risk in the spec), verification (Task 9). All spec zones map to tasks.
- **Hide-now/delete-later honored:** every task removes UI only; no engine/store/type code is deleted. The Transition panel and other unreachable components are explicitly left in place (Task 5).
- **Slow-mo:** the spec said "keep" a speed control; it does not exist as UI, so Task 4 adds one wired to the pre-existing `playbackRate`/`setPlaybackRate` engine support — fulfilling the spec's intent.
- **Risk ordering:** the large, risky Clip-panel reduction (Task 5) follows four simpler removals that establish the build-verify rhythm.
- **No placeholders:** removal targets are named explicitly per task; the one additive task (4) specifies the values, store API, and UI primitive.
