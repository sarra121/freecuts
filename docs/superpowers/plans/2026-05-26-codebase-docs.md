# Codebase Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write 40 narrative prose docs under `docs/codebase/` covering every corner of the FreeCut codebase, one doc at a time, with user review between docs.

**Architecture:** Centralized doc tree under `docs/codebase/`. Top-down reading order via numeric prefixes (00–80). One doc per subsystem folder. Each doc follows the template defined in `docs/superpowers/specs/2026-05-26-codebase-docs-design.md`: TL;DR → Responsibilities → How it fits in → Architecture & data flow → File-by-file walkthrough → Gotchas → Cross-references. Prose only, no diagrams. Liberal `file:line` references, verified at write time.

**Tech Stack:** Markdown. No build, no toolchain. Reads source via Read/Grep/Glob.

---

## Operating mode

This plan is **not** TDD. Each task is "read the folder, write the doc, update the index, hand off to user for review." Specifically:

- **No tests.** Prose docs are reviewed by the user reading them, not by automated checks.
- **No commits.** User has asked not to commit during this work. The docs accumulate on disk.
- **Streaming pace.** Exactly one doc per task. After writing, ask "Wrote `NN-name.md`. Anything off? Otherwise say next." Wait for response before next task.
- **Index kept current.** Every doc-writing task updates `docs/codebase/README.md` in the same turn as the doc itself.
- **Verification.** Before writing a doc, read every `.ts`/`.tsx` file in its target folder. Verify every `file:line` reference at write time. No speculation.

If the user pushes back on a doc, revise it in place. Don't move to the next task until they say "next" (or equivalent).

---

## Task 0: Bootstrap

**Files:**
- Create: `docs/codebase/README.md`

- [ ] **Step 1: Create `docs/codebase/` directory implicitly via the first Write**

(Write creates parent dirs as needed; no separate mkdir step.)

- [ ] **Step 2: Write index skeleton to `docs/codebase/README.md`**

The skeleton lists all 40 docs grouped by layer, with empty hooks (one-liners to be filled as each doc is written). Existing entries are kept up-to-date; an entry without a written doc reads "_(not yet written)_".

```markdown
# FreeCut codebase docs

Narrative tour of the FreeCut codebase, written for someone learning it deeply.
Read in numeric order for a guided top-down tour, or jump to a section.

See `docs/superpowers/specs/2026-05-26-codebase-docs-design.md` for the design.

## Orientation
- [00 — Overview](00-overview.md) — _(not yet written)_

## App entry
- [01 — App bootstrap & routing](01-app-and-routes.md) — _(not yet written)_
- [02 — i18n](02-i18n.md) — _(not yet written)_
- [03 — Config](03-config.md) — _(not yet written)_

## Features
- [10 — Editor shell](10-feature-editor.md) — _(not yet written)_
- [11 — Timeline](11-feature-timeline.md) — _(not yet written)_
- [12 — Preview](12-feature-preview.md) — _(not yet written)_
- [13 — Export](13-feature-export.md) — _(not yet written)_
- [14 — Effects](14-feature-effects.md) — _(not yet written)_
- [15 — Keyframes](15-feature-keyframes.md) — _(not yet written)_
- [16 — Media library](16-feature-media-library.md) — _(not yet written)_
- [17 — Project bundle](17-feature-project-bundle.md) — _(not yet written)_
- [18 — Projects](18-feature-projects.md) — _(not yet written)_
- [19 — Scene browser](19-feature-scene-browser.md) — _(not yet written)_
- [20 — Settings](20-feature-settings.md) — _(not yet written)_
- [21 — Workspace gate](21-feature-workspace-gate.md) — _(not yet written)_
- [22 — Shapes (Konva)](22-feature-shapes-konva.md) — _(not yet written)_

## Runtime
- [30 — Composition runtime](30-runtime-composition.md) — _(not yet written)_
- [31 — Player](31-runtime-player.md) — _(not yet written)_

## Infrastructure
- [40 — GPU effects](40-infra-gpu-effects.md) — _(not yet written)_
- [41 — GPU transitions](41-infra-gpu-transitions.md) — _(not yet written)_
- [42 — GPU compositor](42-infra-gpu-compositor.md) — _(not yet written)_
- [43 — GPU masks](43-infra-gpu-masks.md) — _(not yet written)_
- [44 — GPU media](44-infra-gpu-media.md) — _(not yet written)_
- [45 — GPU scopes](45-infra-gpu-scopes.md) — _(not yet written)_
- [46 — GPU shapes](46-infra-gpu-shapes.md) — _(not yet written)_
- [47 — GPU text](47-infra-gpu-text.md) — _(not yet written)_
- [48 — GPU shared](48-infra-gpu-shared.md) — _(not yet written)_
- [49 — Analysis](49-infra-analysis.md) — _(not yet written)_
- [50 — Audio](50-infra-audio.md) — _(not yet written)_
- [51 — Browser adapters](51-infra-browser.md) — _(not yet written)_
- [52 — Storage](52-infra-storage.md) — _(not yet written)_
- [53 — Thumbnails](53-infra-thumbnails.md) — _(not yet written)_

## Shared
- [60 — State stores](60-shared-state.md) — _(not yet written)_
- [61 — Timeline (transitions engine)](61-shared-timeline.md) — _(not yet written)_
- [62 — Projects (migrations)](62-shared-projects.md) — _(not yet written)_
- [63 — Logging & utils](63-shared-logging-utils.md) — _(not yet written)_
- [64 — UI / typography / graphics](64-shared-ui-typography-graphics.md) — _(not yet written)_

## Foundation
- [70 — Types & shadcn components](70-types-and-shadcn.md) — _(not yet written)_

## Tooling
- [80 — Testing, tooling, build](80-testing-tooling-build.md) — _(not yet written)_
```

- [ ] **Step 3: Signal completion**

Message: "Bootstrapped `docs/codebase/`. Next task is Task 1 — overview doc. Say 'next' when ready."

---

## Per-doc task template

Every task below (Task 1 through Task 40) follows this exact shape:

- [ ] **Step 1: Read all source files in the target folder**

Use Glob to list `.ts`/`.tsx` files, then Read every one. For folders with >30 files, batch into multiple parallel Reads.

- [ ] **Step 2: Cross-reference CLAUDE.md**

Identify every gotcha/invariant in `CLAUDE.md` that mentions this subsystem. Note them for the doc's "Gotchas & invariants" section.

- [ ] **Step 3: Verify any cross-feature claims**

For any claim like "X is only called by Y" or "this is the single source of truth for Z", run Grep to confirm before writing it.

- [ ] **Step 4: Write the doc**

Write to the exact path listed in the task. Use the template from the spec (TL;DR → Responsibilities → How it fits in → Architecture & data flow → File-by-file walkthrough → Gotchas → Cross-references). Prose only.

- [ ] **Step 5: Update the index**

Edit `docs/codebase/README.md`: replace `_(not yet written)_` for this doc with a one-line hook (≤80 chars).

- [ ] **Step 6: Hand off to user**

Message: "Wrote `<path>`. Anything off? Otherwise say 'next'."

Wait for user response. Revise on push-back; advance on "next".

---

## Task 1: 00-overview.md

**Files:**
- Create: `docs/codebase/00-overview.md`
- Read: `package.json`, `vite.config.ts`, `CLAUDE.md`, `README.md`, `src/main.tsx`, `src/index.css`, `tsconfig.json`, `tsconfig.app.json`

**Doc content:**
- Tech stack (React 19, TS, Vite, Tailwind 4, Zustand+Zundo, WebGPU, WebCodecs, Mediabunny, TanStack Router, i18next)
- The layer cake: routes → features → runtime → infrastructure → shared
- Key concepts/glossary: project, composition, sub-comp, timeline item, track, transition, GPU effect, source-native FPS vs project FPS, workspace, OPFS, media library, item facade pattern
- Mental models you must hold to read the rest of the docs
- How to navigate the doc tree

---

## Task 2: 01-app-and-routes.md

**Files:**
- Create: `docs/codebase/01-app-and-routes.md`
- Read: `src/app/**`, `src/routes/**`, `src/main.tsx`, `index.html`

**Doc content:** App bootstrap (error boundary, PWA prompt, debug panel), TanStack Router setup, route tree, route files for editor/projects/index, `routeTree.gen.ts` (do-not-edit), `npm run routes` workflow.

---

## Task 3: 02-i18n.md

**Files:**
- Create: `docs/codebase/02-i18n.md`
- Read: `src/i18n/**`

**Doc content:** i18next setup, the 9 supported languages, `languages.ts`, locale JSON shape, partials and deep-merge, language detector + `freecut-language` localStorage key, `useTranslation()` vs `i18n.t()`, `<Trans>` for inline markup, intentional untyping rationale.

---

## Task 4: 03-config.md

**Files:**
- Create: `docs/codebase/03-config.md`
- Read: `src/config/**`

**Doc content:** Hotkey config, editor layout config, how panels/shortcuts wire together.

---

## Task 5: 10-feature-editor.md

**Files:**
- Create: `docs/codebase/10-feature-editor.md`
- Read: `src/features/editor/**`

**Doc content:** Editor shell layout (toolbar, sidebars, preview area, properties), `editor.tsx` orchestration, editor-specific stores, panels (audio mixer, media sidebar, properties sidebar with clip-panel), settings dialog, toolbar.

---

## Task 6: 11-feature-timeline.md

**Files:**
- Create: `docs/codebase/11-feature-timeline.md`
- Read: `src/features/timeline/**` (largest subsystem — expect 50+ files)

**Doc content:** Timeline architecture, `useTimelineStore` facade pattern (covered in detail), domain stores (items, transitions, keyframes, markers, settings, command), action modules in `stores/actions/*.ts` using `execute()` wrapper for undo/redo, timeline-content/timeline-track/timeline-header components, drop zone, track-header, clip waveform, tool shortcuts, transition repair (`applyTransitionRepairs`), `_splitItem` invariant, group tracks. This doc will likely be the longest — may take 2 messages.

---

## Task 7: 12-feature-preview.md

**Files:**
- Create: `docs/codebase/12-feature-preview.md`
- Read: `src/features/preview/**`

**Doc content:** Preview canvas, preview-stage, video-preview, scrub renderer, transform gizmo, preview stores, preview workers, the render loop concurrency rules (single-mutex `scrubRenderInFlightRef`, generation counter), DOM video transition hold (`data-transition-hold`), `captureCanvasSource` reuse pattern, GPU pipeline pre-warming.

---

## Task 8: 13-feature-export.md

**Files:**
- Create: `docs/codebase/13-feature-export.md`
- Read: `src/features/export/**`

**Doc content:** WebCodecs export pipeline, the export web worker, canvas item renderer (`render-item.ts`), source-fps fallback for A-A continuity, codec/resolution config, export components and hooks.

---

## Task 9: 14-feature-effects.md

**Files:**
- Create: `docs/codebase/14-feature-effects.md`
- Read: `src/features/effects/**`

**Doc content:** Effects UI panels and registry, the GPU-only architecture (v6 migration), generic `GpuEffectPanel` vs specialized panels (`gpu-curves`, `gpu-color-wheels`), `onParamsBatchChange` atomic update pattern, links to `40-infra-gpu-effects.md`.

---

## Task 10: 15-feature-keyframes.md

**Files:**
- Create: `docs/codebase/15-feature-keyframes.md`
- Read: `src/features/keyframes/**`

**Doc content:** Keyframe animation system, Bezier editor, easing functions, keyframes store, keyframe hooks/components/utils.

---

## Task 11: 16-feature-media-library.md

**Files:**
- Create: `docs/codebase/16-feature-media-library.md`
- Read: `src/features/media-library/**`

**Doc content:** Media import, metadata, OPFS proxies, transcription (workers, models), media library service, contracts, stores, components, the relationship to workspace-fs storage.

---

## Task 12: 17-feature-project-bundle.md

**Files:**
- Create: `docs/codebase/17-feature-project-bundle.md`
- Read: `src/features/project-bundle/**`

**Doc content:** Project ZIP export/import, schemas, services, types, the bundle format.

---

## Task 13: 18-feature-projects.md

**Files:**
- Create: `docs/codebase/18-feature-projects.md`
- Read: `src/features/projects/**`

**Doc content:** Project management, project creation/load/save, project stores, services, components.

---

## Task 14: 19-feature-scene-browser.md

**Files:**
- Create: `docs/codebase/19-feature-scene-browser.md`
- Read: `src/features/scene-browser/**`

**Doc content:** Caption and scene search UI, scene browser stores/hooks/components/utils, its consumption of `infrastructure/analysis`.

---

## Task 15: 20-feature-settings.md

**Files:**
- Create: `docs/codebase/20-feature-settings.md`
- Read: `src/features/settings/**`

**Doc content:** App settings, settings store, settings UI components/hooks.

---

## Task 16: 21-feature-workspace-gate.md

**Files:**
- Create: `docs/codebase/21-feature-workspace-gate.md`
- Read: `src/features/workspace-gate/**`

**Doc content:** Workspace picker, the gate splash, permission flow, how the gate blocks render until a workspace is granted, the relationship to `infrastructure/storage/workspace-fs/` and `handles-db.ts`.

---

## Task 17: 22-feature-shapes-konva.md

**Files:**
- Create: `docs/codebase/22-feature-shapes-konva.md`
- Read: `src/features/shapes-konva/**`

**Doc content:** Konva-based shape rendering, shape definitions, shape store, components, utilities, the relationship to `infrastructure/gpu-shapes/` and `shared/graphics/shapes/`.

---

## Task 18: 30-runtime-composition.md

**Files:**
- Create: `docs/codebase/30-runtime-composition.md`
- Read: `src/runtime/composition-runtime/**`

**Doc content:** Composition rendering, sequences, items (`item.tsx`), audio handling, transitions wiring, hooks, contexts, worklets, compositions sub-folder, 1-level pre-comp nesting rule. Heavy doc — explains how a timeline item becomes a rendered frame.

---

## Task 19: 31-runtime-player.md

**Files:**
- Create: `docs/codebase/31-runtime-player.md`
- Read: `src/runtime/player/**`

**Doc content:** Clock, video source pools, composition playback, player contracts, the playback loop, the relationship to preview rendering.

---

## Task 20: 40-infra-gpu-effects.md

**Files:**
- Create: `docs/codebase/40-infra-gpu-effects.md`
- Read: `src/infrastructure/gpu-effects/**`

**Doc content:** WebGPU effect pipeline (`EffectsPipeline`), shader definitions, individual effects under `effects/`, `requestCachedDevice` caching pattern, device-loss handler, every effect cataloged.

---

## Task 21: 41-infra-gpu-transitions.md

**Files:**
- Create: `docs/codebase/41-infra-gpu-transitions.md`
- Read: `src/infrastructure/gpu-transitions/**`

**Doc content:** WebGPU transition pipeline, the 13 transitions (fade, wipe, slide, flip, clockWipe, iris, dissolve, sparkles, glitch, lightLeak, pixelate, chromatic, radialBlur), per-transition shaders.

---

## Task 22: 42-infra-gpu-compositor.md

**Files:**
- Create: `docs/codebase/42-infra-gpu-compositor.md`
- Read: `src/infrastructure/gpu-compositor/**`

**Doc content:** WebGPU blend-mode compositor, blend-mode catalog, how it integrates with the effects pipeline.

---

## Task 23: 43-infra-gpu-masks.md

**Files:**
- Create: `docs/codebase/43-infra-gpu-masks.md`
- Read: `src/infrastructure/gpu-masks/**`

**Doc content:** Mask combine pipeline, mask texture manager.

---

## Task 24: 44-infra-gpu-media.md

**Files:**
- Create: `docs/codebase/44-infra-gpu-media.md`
- Read: `src/infrastructure/gpu-media/**`

**Doc content:** Media render/blend pipelines (the GPU side of video/image rendering).

---

## Task 25: 45-infra-gpu-scopes.md

**Files:**
- Create: `docs/codebase/45-infra-gpu-scopes.md`
- Read: `src/infrastructure/gpu-scopes/**`

**Doc content:** Waveform / vectorscope / histogram renderers.

---

## Task 26: 46-infra-gpu-shapes.md

**Files:**
- Create: `docs/codebase/46-infra-gpu-shapes.md`
- Read: `src/infrastructure/gpu-shapes/**`

**Doc content:** Shape render pipeline (GPU side; complements `22-feature-shapes-konva.md`).

---

## Task 27: 47-infra-gpu-text.md

**Files:**
- Create: `docs/codebase/47-infra-gpu-text.md`
- Read: `src/infrastructure/gpu-text/**`

**Doc content:** Glyph-atlas text pipeline.

---

## Task 28: 48-infra-gpu-shared.md

**Files:**
- Create: `docs/codebase/48-infra-gpu-shared.md`
- Read: `src/infrastructure/gpu-shared/**`

**Doc content:** WGSL fragments shared across GPU modules — utility shaders, common helpers.

---

## Task 29: 49-infra-analysis.md

**Files:**
- Create: `docs/codebase/49-infra-analysis.md`
- Read: `src/infrastructure/analysis/**`

**Doc content:** Scene detection, captioning, embeddings, verification, optical flow. ML model loading, worker offloading.

---

## Task 30: 50-infra-audio.md

**Files:**
- Create: `docs/codebase/50-infra-audio.md`
- Read: `src/infrastructure/audio/**`

**Doc content:** SoundTouch-based time-stretch, audio processing.

---

## Task 31: 51-infra-browser.md

**Files:**
- Create: `docs/codebase/51-infra-browser.md`
- Read: `src/infrastructure/browser/**`

**Doc content:** Blob URLs, OPFS, mediabunny adapter.

---

## Task 32: 52-infra-storage.md

**Files:**
- Create: `docs/codebase/52-infra-storage.md`
- Read: `src/infrastructure/storage/**`

**Doc content:** Workspace FS persistence (`workspace-fs/`), handles DB, legacy IDB reader and migration path, the storage barrel and routing.

---

## Task 33: 53-infra-thumbnails.md

**Files:**
- Create: `docs/codebase/53-infra-thumbnails.md`
- Read: `src/infrastructure/thumbnails/**`

**Doc content:** GPU thumbnail renderer, sampling strategy, progressive downscaling pattern.

---

## Task 34: 60-shared-state.md

**Files:**
- Create: `docs/codebase/60-shared-state.md`
- Read: `src/shared/state/**`, `src/shared/state/README.md`

**Doc content:** All Zustand stores under `shared/state/` (playback, selection, dialogs, editor, clipboard, source-player, preview-bridge, local-inference, tts-generate-dialog, project-media-match-dialog, clear-keyframes-dialog). Zundo undo/redo integration.

---

## Task 35: 61-shared-timeline.md

**Files:**
- Create: `docs/codebase/61-shared-timeline.md`
- Read: `src/shared/timeline/**`

**Doc content:** Transition engine, transitions registry, renderers (one per transition with `gpuTransitionId` linking shader + `renderCanvas()` Canvas 2D fallback), defaults, `calculateStyles()` (dead code note), the relationship to `41-infra-gpu-transitions.md`.

---

## Task 36: 62-shared-projects.md

**Files:**
- Create: `docs/codebase/62-shared-projects.md`
- Read: `src/shared/projects/**`

**Doc content:** Schema migrations, normalization, `CURRENT_SCHEMA_VERSION`, the per-load migration pipeline.

---

## Task 37: 63-shared-logging-utils.md

**Files:**
- Create: `docs/codebase/63-shared-logging-utils.md`
- Read: `src/shared/logging/**`, `src/shared/utils/**`

**Doc content:** `createLogger`, wide-event pattern (`startEvent` / `.success()` / `.failure()`), `createOperationId`, jitter monitor, the `function`-only rule for logger.ts. Then the catch-all `utils/` — managed workers, color/curve math, easing, async helpers, etc.

---

## Task 38: 64-shared-ui-typography-graphics.md

**Files:**
- Create: `docs/codebase/64-shared-ui-typography-graphics.md`
- Read: `src/shared/ui/**`, `src/shared/typography/**`, `src/shared/graphics/**`, `src/shared/marquee/**`

**Doc content:** `cn` helper, property controls, font loading, text style presets, shape generators and path helpers, marquee-selection hook + overlay.

---

## Task 39: 70-types-and-shadcn.md

**Files:**
- Create: `docs/codebase/70-types-and-shadcn.md`
- Read: `src/types/**`, `src/components/**`

**Doc content:** Shared TypeScript types (`timeline.ts` etc.), the `TimelineItem` discriminated union, shadcn/ui components, brand assets.

---

## Task 40: 80-testing-tooling-build.md

**Files:**
- Create: `docs/codebase/80-testing-tooling-build.md`
- Read: `src/test/**`, `vite.config.ts`, `vitest.config.ts` (if separate), `oxlint.config.json` (or `.oxlintrc.json`), `tsconfig*.json`, `package.json` (scripts section), `eslint.config.*` if any, hooks under `.husky` if any

**Doc content:** Vitest + jsdom, `src/test/setup.ts` mocks (ImageData, WebGPU, GPU constants), feature boundary check (`check:boundaries`), legacy lib import tripwire, Oxlint + Oxfmt, build manual chunk splitting, `optimizeDeps`, `VITE_SHOW_DEBUG_PANEL`, `npm run routes` workflow recap.

---

## Self-review notes

After this plan was drafted, I checked it against the spec:

- **Spec coverage:** every `src/` subdirectory listed in the source-tree inventory maps to exactly one task. Task 0 produces the index. Tasks 1–40 produce the 40 docs.
- **Doc count:** 40, matching the spec.
- **Placeholders:** none — every task names exact files to read and exact files to write.
- **Out-of-scope items honored:** no plans to touch `deps/README.md` files; no plans to refactor source; no commit steps.
- **Ordering:** matches the spec's "top-down" reading order.
