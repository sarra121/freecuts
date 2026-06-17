# Codebase docs — design

**Date:** 2026-05-26
**Status:** approved (pending user review of this spec)
**Audience:** the project owner (Sarra), learning this codebase deeply

## Goal

Produce a navigable set of prose documents under `docs/codebase/` that lets the reader
understand every corner of the FreeCut codebase — from high-level abstractions down to
file-by-file implementation detail. The docs are a reading experience, not a reference manual:
they explain *why* things are the way they are, build mental models, and surface non-obvious
behavior, gotchas, and invariants.

## Non-goals

- Not API reference documentation. Not generated from JSDoc. Not exhaustive symbol listings.
- Not onboarding docs for new contributors. The tone is "I'm helping you internalize this
  codebase," not "this is how to extend it."
- Not architecture decision records (ADRs). Past decisions are explained where they shape
  current behavior, but the docs describe the system as it is today, not its history.
- Not a substitute for `CLAUDE.md`. CLAUDE.md remains the operational rulebook; these docs
  explain the system CLAUDE.md governs.
- Not a refactor effort. Writing the docs must not change source code.

## Constraints

- **Format:** Markdown, prose only. No diagrams (Mermaid, ASCII, or otherwise).
- **Granularity:** one doc per feature/subsystem folder under `src/` (40 docs total).
- **Pacing:** streaming — one doc at a time, user reviews each before the next.
- **Accuracy:** all `file:line` references must be verified at write time. Claims about
  call sites or invariants must be grep-verified.

## Layout

All docs live under `docs/codebase/` (separate tree from `docs/superpowers/`).

```
docs/codebase/
├── README.md          ← index (flat list with one-line hooks)
├── 00-overview.md
├── 01-app-and-routes.md
├── 02-i18n.md
├── 03-config.md
├── 10-feature-editor.md
├── 11-feature-timeline.md
├── 12-feature-preview.md
├── 13-feature-export.md
├── 14-feature-effects.md
├── 15-feature-keyframes.md
├── 16-feature-media-library.md
├── 17-feature-project-bundle.md
├── 18-feature-projects.md
├── 19-feature-scene-browser.md
├── 20-feature-settings.md
├── 21-feature-workspace-gate.md
├── 22-feature-shapes-konva.md
├── 30-runtime-composition.md
├── 31-runtime-player.md
├── 40-infra-gpu-effects.md
├── 41-infra-gpu-transitions.md
├── 42-infra-gpu-compositor.md
├── 43-infra-gpu-masks.md
├── 44-infra-gpu-media.md
├── 45-infra-gpu-scopes.md
├── 46-infra-gpu-shapes.md
├── 47-infra-gpu-text.md
├── 48-infra-gpu-shared.md
├── 49-infra-analysis.md
├── 50-infra-audio.md
├── 51-infra-browser.md
├── 52-infra-storage.md
├── 53-infra-thumbnails.md
├── 60-shared-state.md
├── 61-shared-timeline.md
├── 62-shared-projects.md
├── 63-shared-logging-utils.md
├── 64-shared-ui-typography-graphics.md
├── 70-types-and-shadcn.md
└── 80-testing-tooling-build.md
```

Numeric prefixes set a sequential reading order (top-down: overview → app entry → features
→ runtime → infrastructure → shared → foundation → tooling). Gaps between number ranges
leave room to insert docs without renumbering.

### Doc inventory (40 total)

| Range | Group           | Count |
|-------|-----------------|-------|
| 00    | Orientation     | 1     |
| 01–09 | App entry       | 3     |
| 10–29 | Features        | 13    |
| 30–39 | Runtime         | 2     |
| 40–59 | Infrastructure  | 14    |
| 60–69 | Shared          | 5     |
| 70–79 | Foundation      | 1     |
| 80–89 | Tooling         | 1     |
| **Total** |             | **40** |

## Per-doc template

Every subsystem doc follows this skeleton:

```markdown
# <Subsystem name>

## TL;DR
One paragraph. The elevator pitch — what this subsystem is, what problem it solves, the
one mental model to leave with.

## Responsibilities
What this subsystem owns and what it explicitly does NOT own. Where the boundaries are.

## How it fits in
- Who calls into it (upstream consumers — name features/files)
- What it depends on (downstream — name modules/files)
- Where it sits in the layer cake

## Architecture & data flow
The mental model. Key types, key lifecycles, the 2-4 important sequences narrated in prose
("when X happens, here's the chain of calls").

## File-by-file walkthrough
For each significant file (skipping trivial barrels):
  - `path/to/file.ts` — one-line purpose
  - Key exports (functions, types, components) and what they do
  - Non-obvious behavior, invariants, why it's written this way
  - Hot lines worth knowing — e.g. `file.ts:142` is where the lock is released

Folders (components/, hooks/, utils/) are walked in a sensible reading order — usually
"main thing first, then its helpers" — not alphabetical.

## Gotchas & invariants
Load-bearing rules that aren't obvious from the code. Pulled from CLAUDE.md where
relevant, plus anything discovered while writing. Each one explains *why*.

## Cross-references
- Related docs (links to other `docs/codebase/*.md`)
- Related CLAUDE.md sections
- Key external libraries that shape the design (mediabunny, WebCodecs, etc.)
```

### Inline format conventions

- **Code excerpts**: short (3-10 lines), inline, only when prose can't carry the weight.
  Never page-long dumps.
- **`file:line` references**: used liberally — they're the price of admission for the
  granularity requested. They will go stale; that's accepted.
- **Bold for emphasis sparingly**; never to fake hierarchy.
- **Headers**: no more than 3 levels deep within a doc.

## Index design

`docs/codebase/README.md` is a flat list grouped by layer, with a one-line hook per doc
(≤80 chars). Example shape:

```markdown
## Features
- [10 — Editor shell](10-feature-editor.md) — toolbar, panels, sidebars, editor stores
- [11 — Timeline](11-feature-timeline.md) — multi-track timeline, actions, services
- [12 — Preview](12-feature-preview.md) — preview canvas, gizmo, scrub renderer
```

The index entry for a doc is added/updated **in the same turn** the doc is written, so the
index is always current.

## Sourcing protocol

For each doc:

1. **Read every `.ts`/`.tsx` file** in the subsystem folder before writing. For large
   subsystems (timeline, media-library, gpu-effects) this may be 20-50 files. No skipping.
2. **Pull CLAUDE.md gotchas** — every invariant in CLAUDE.md that applies to the subsystem
   is surfaced in the doc's "Gotchas" section, so the reader doesn't have to context-switch.
3. **Verify before claiming**. Statements like "the only caller of X is Y", "this is where
   the lock releases", or "this runs on the worker thread" must be grep- or read-verified at
   write time, not asserted from memory.
4. **Surface surprises**. Code that contradicts surrounding expectations, anything that
   looks load-bearing-but-fragile, anything where the name lies about behavior — these get
   explicit callouts.
5. **No speculation**. If reading doesn't reveal what something does, say so: "unclear:
   appears to handle X, worth a closer look" — don't invent an explanation.

## Pacing protocol

Streaming, one doc at a time:

1. Write one doc to `docs/codebase/NN-name.md`.
2. Update `docs/codebase/README.md` index entry for that doc in the same turn.
3. Brief signal-off message: "Wrote `NN-name.md`. Anything off? Otherwise say next."
4. Wait for user feedback. Push-back → revise. "Next" → move to the next doc.
5. Repeat until inventory is exhausted.

Never queue multiple docs in one turn. For exceptionally large docs (timeline likely), the
doc may be written in 2 messages within a single turn, but it's still one doc per
review cycle.

## Out of scope

- Refactoring source while writing docs. If something genuinely looks wrong, flag it in the
  doc and let the user decide; don't fix it.
- Generating diagrams (per user preference).
- Writing tests, implementation plans, or any doc outside `docs/codebase/`.
- Touching `deps/README.md` files inside `src/features/*/deps/` — those serve a different
  purpose (cross-feature boundary contracts) and stay as-is.
- Touching `src/app/README.md`, `src/infrastructure/README.md`, `src/shared/README.md`,
  `src/shared/state/README.md`, `src/i18n/locales/partials/README.md` — also stay as-is.
  The new docs will reference them where useful but not duplicate or replace them.

## Success criteria

- All 40 docs exist under `docs/codebase/`.
- `docs/codebase/README.md` lists every doc with a one-line hook.
- For any file in `src/` outside `node_modules/`, `src/test/`, and generated files
  (`routeTree.gen.ts`), the reader can find the doc that explains it via the index.
- No `file:line` reference is wrong at the moment it's written.
- No doc claims behavior that contradicts the source.
- The user, after reading sequentially, can answer "where would I look to change X?" for
  any reasonable X without needing to grep.

## Implementation plan

A separate plan in `docs/superpowers/plans/` will list the 40 docs as a checklist with
dependencies (e.g., `11-feature-timeline.md` may benefit from `60-shared-state.md` being
written first because of the timeline-store facade pattern). The plan will be generated
via the `writing-plans` skill after this spec is approved.
