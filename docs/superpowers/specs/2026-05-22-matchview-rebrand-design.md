# MatchView Rebrand — Design

**Date:** 2026-05-22
**Status:** Approved
**Topic:** Rebrand FreeCut → MatchView: new logo, full name change, and a light/dark theme system.

## Summary

Rebrand the forked FreeCut video editor as **MatchView**, a sports-analysis-oriented
video tool. Three coordinated changes:

1. **Rename** FreeCut → MatchView across user-facing text *and* internals.
2. **New logo** — a royal-blue hexagon badge, replacing the scissors mark.
3. **Theme system** — convert the always-dark app into a real light/dark pair with a
   user toggle, and retune the accent color from orange to brand blue.

## Goals

- The app presents itself consistently as "MatchView" everywhere a user can see.
- Users can switch between a dark and a light theme; the choice persists.
- The brand accent color is `#1845C8` (royal blue) in both themes.
- Internals (component names, package metadata, persistence keys) also reflect the
  new name, so the codebase is clean for future work.

## Non-Goals (YAGNI)

- No second/secondary accent color (event-tag color system was considered, dropped).
- No team-color theming.
- No OS system-preference auto-detection — dark is the default.
- No landing/marketing page redesign — those pages receive the text rename only.
- The legacy `video-editor-db` IndexedDB name is **not** renamed (it must keep its
  name to read pre-existing data during the one-time migration path).

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Theme directions | Clean neutral light + clean neutral dark, one blue accent |
| Light + dark | Both, as toggleable modes of one system |
| Rename depth | User-facing **and** internals (incl. `package.json`, code identifiers) |
| Wordmark | Hexagon icon + "MatchView" (one word, camelCase) |
| Default theme | Dark (matches today); toggle in Settings; no system detection |
| Video preview area | Stays neutral-dark in both themes (standard for footage) |
| Persistence keys | Renamed (fresh fork — no saved data to orphan) |

## Architecture

### Theme system

**Strategy:** `:root` in `src/index.css` continues to hold the **dark** theme values,
so dark remains the zero-change default. A new `html.light { ... }` block overrides
every `--*` custom property with light-theme values.

*Alternative rejected:* inverting to the shadcn-standard `:root` = light / `.dark` = dark.
That would force a class onto `<html>` before first paint just to preserve today's
dark default and would invert every existing "base = dark" assumption — a larger,
riskier diff for no benefit.

**Theme store:** a small Zustand store, persisted to `localStorage` under
`matchview-theme` (values `'dark' | 'light'`). On change it toggles the `light`
class on `document.documentElement`. Lives alongside other shared stores
(`src/shared/state/`).

**FOUC guard:** a short inline script in `index.html` `<head>` reads
`localStorage['matchview-theme']` and adds the `light` class before React mounts,
so a light-theme user never sees a dark flash.

**Token coverage:**

- *Flips automatically* — every component using semantic Tailwind tokens
  (`bg-background`, `text-foreground`, `bg-primary`, `border-border`, sidebar
  tokens, etc.). This is the bulk of the UI chrome.
- *Needs explicit light variants* — currently-hardcoded dark values:
  - `src/index.css`: `::-webkit-scrollbar-track` / `-thumb` / `-corner` colors.
  - `src/features/timeline/theme.css`: `.bg-waveform-gradient`,
    `.bg-image-gradient`, `.bg-audio-gradient`, `.bg-text-gradient`,
    `.bg-shape-gradient`, `.bg-group-stripes`, and `--color-video-preview-background`.
  These get `html.light` overrides (or token-based values).
- *Stays dark in both themes* — the video-preview letterbox backdrop. Footage is
  judged against a neutral-dark surround regardless of UI theme.

### Color retune

The accent moves from orange to brand blue `#1845C8` everywhere it appears:

- `src/index.css`: `--primary`, `--primary-foreground`, `--ring`,
  `--sidebar-primary`, `--sidebar-ring`, and the `.glow-primary*` utilities.
- `src/features/timeline/theme.css`: `--color-timeline-playhead`,
  `--color-timeline-snap`, `--color-timeline-join` (all currently orange).

Each theme gets its own tuned neutral ramp (backgrounds, panels, borders, muted
text); the blue accent is the shared constant. Exact OKLCH values are an
implementation detail — the brand hex `#1845C8` and "vivid, legible on both
backgrounds" are the constraints.

### Logo & brand assets

- **New component** `MatchViewLogo` in `src/components/brand/matchview-logo.tsx`,
  replacing `FreeCutLogo` / `freecut-logo.tsx`. Same props API
  (`variant: 'full' | 'icon'`, `size`, `className`). `variant="full"` renders the
  hexagon icon next to the "MatchView" wordmark. All importers updated
  (`workspace-gate-splash.tsx`, and any others).
- **Hexagon SVG** — the approved artwork (royal-blue hexagon with a stylized
  clip-list inside):

  ```
  <svg width="220" height="220" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
    <polygon points="110,4 204,56 204,160 110,212 16,160 16,56" fill="#1845C8"/>
    <rect x="48" y="62" width="28" height="20" rx="3" fill="white" opacity="0.3"/>
    <rect x="84" y="62" width="76" height="20" rx="3" fill="white" opacity="0.3"/>
    <rect x="48" y="95" width="28" height="20" rx="3" fill="white" opacity="0.85"/>
    <polygon points="56,101 56,109 65,105" fill="#1845C8"/>
    <rect x="84" y="95" width="54" height="20" rx="3" fill="white" opacity="0.85"/>
    <rect x="48" y="128" width="28" height="20" rx="3" fill="white" opacity="0.3"/>
    <rect x="84" y="128" width="38" height="20" rx="3" fill="white" opacity="0.3"/>
  </svg>
  ```

  The solid hexagon reads well on both light and dark backgrounds, so one mark
  serves both themes.
- **Static assets** — `public/favicon.svg` and `public/icons/freecut-icon.svg`
  (renamed to `matchview-icon.svg`) replaced with the new hexagon.
- **PWA PNG icons** — `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
  regenerated from the new SVG. Approach: a one-off Node script using `sharp`
  (added as a `devDependency`) that rasterizes the SVG at the three sizes; the
  maskable variant adds safe-area padding. Script kept in the repo for future
  regeneration.
- **`manifest.webmanifest`** — `name` / `short_name` → "MatchView"; screenshot
  `label` updated; `theme_color` / `background_color` updated to the new brand
  dark background.
- **`index.html`** — `<title>`, `application-name`, `apple-mobile-web-app-title`
  → "MatchView"; `theme-color` meta updated.

### Rename inventory (FreeCut → MatchView)

Depth: **user-facing + internals.**

**Display text**
- `index.html` — title and meta tags.
- `public/manifest.webmanifest` — name, short_name, screenshot label.
- The logo wordmark (via `MatchViewLogo`).
- i18n strings across **all 9 languages** — at least:
  `src/i18n/locales/partials/projects.json` (`faqSubheading`,
  `seeItInActionSubheading`, `demoPreviewAlt`), `partials/editor.json`
  (`projectBundle`), `partials/remaining-ui.json` (`defaultTtsPrompt` —
  "Welcome to freecut"). A full grep for `freecut`/`FreeCut` in the i18n tree
  drives the complete list.

**Code / internals**
- `FreeCutLogo` → `MatchViewLogo`; `FreeCutLogoProps` → `MatchViewLogoProps`;
  file `freecut-logo.tsx` → `matchview-logo.tsx`; all imports updated.
- `package.json` — `name` field `freecut` → `matchview`.
- Docs — `README.md`, `CHANGELOG.md`, `CLAUDE.md` references.

**Persistence keys** (renamed — fresh fork, no saved data to orphan)
- `localStorage`: `freecut-language` → `matchview-language`
  (`I18N_STORAGE_KEY` in `src/i18n/index.ts`); `freecut-hotkeys` →
  `matchview-hotkeys` (`HOTKEY_EXPORT_SCHEMA` in `src/config/hotkeys.ts`);
  `freecut-pwa-install-dismissed-until` → `matchview-pwa-install-dismissed-until`
  (`src/app/pwa-install-prompt.tsx`).
- IndexedDB: `freecut-handles-db` → `matchview-handles-db`
  (`src/infrastructure/storage/handles-db.ts`).
- Workspace filesystem markers: `.freecut-workspace.json` →
  `.matchview-workspace.json` (`MARKER_FILENAME`); `.freecut-trashed.json` →
  `.matchview-trashed.json` (`PROJECT_TRASHED_MARKER_FILENAME`) — both in
  `src/infrastructure/storage/workspace-fs/paths.ts`; plus the README template
  and the `.gitignore` entry (`/.freecut-workspace.json`).
- Toast/notification id `freecut-workspace` in `workspace-gate.tsx` /
  `workspace-indicator.tsx` → `matchview-workspace`.

**Not renamed**
- Legacy `video-editor-db` IndexedDB name — must stay for the legacy migration
  reader to find pre-existing data.

### Settings UI — theme toggle

Add a Light/Dark control to the editor **Settings dialog → General tab**, next to
the existing language selector. It reads/writes the theme store. A segmented
two-option control (Dark / Light) keeps it simple. New i18n keys for the control
label and option names, translated across all 9 languages.

## Components / units of work

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| Theme store | Hold `'dark' \| 'light'`, persist, toggle `<html>` class | — |
| `index.css` light block | Light values for all `--*` tokens + scrollbar | — |
| `timeline/theme.css` light block | Light variants for gradient/preview classes | — |
| Color retune | Orange → blue across both CSS files | — |
| `MatchViewLogo` | New logo component + asset wiring | hexagon SVG |
| Brand assets | favicon, PWA SVG + PNGs, manifest, index.html | hexagon SVG |
| FOUC inline script | Pre-paint theme class in `index.html` | theme store key |
| Settings theme toggle | UI control bound to theme store | theme store |
| Rename pass | All FreeCut → MatchView text + identifiers + keys | — |

## Testing

- **Theme store** — unit test: persistence round-trip, class toggling.
- **Visual / manual** — run `npm run dev`, verify both themes across editor shell,
  timeline, dialogs, media library, projects pages; verify toggle persists across
  reload; verify no dark flash on light-theme reload.
- **Build & lint** — `npm run build`, `npm run lint`, `npm run test:run` all pass.
- **Rename verification** — a final case-insensitive grep for `freecut` returns
  only the intentional legacy `video-editor-db`-adjacent references.

## Risks

- **Hardcoded colors beyond the known list** — components may hardcode dark
  `oklch(...)` / hex values outside the audited files. Mitigation: grep for raw
  color literals in `src/` during implementation; fix any that break light mode.
- **Re-grant workspace** — renaming persistence keys means anyone who already
  opened the old app in the same browser must re-pick their workspace once.
  Accepted: this is a fresh fork.
- **PWA icon rasterization** — `sharp` install / SVG rendering fidelity. Mitigation:
  visually check the generated PNGs; the maskable variant needs safe-area padding.
