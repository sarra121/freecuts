# MatchView Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the forked FreeCut video editor as **MatchView** — new hexagon logo, full name change across UI and internals, and a real light/dark theme system with a blue brand accent.

**Architecture:** `:root` in `src/index.css` keeps the dark theme values (dark stays the zero-change default); a new `html.light { ... }` block overrides every CSS variable for light mode. A small Zustand store toggles a `light` class on `<html>` and persists the choice to `localStorage` as a raw string, so a tiny inline script in `index.html` can apply it before first paint. The orange accent is retuned to brand blue `#1845C8`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Vitest, `sharp` (new devDependency, for PWA icon rasterization).

**Reference spec:** `docs/superpowers/specs/2026-05-22-matchview-rebrand-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/shared/state/theme-store.ts` | Theme state + persistence + `<html>` class | Create |
| `src/shared/state/theme-store.test.ts` | Theme store unit tests | Create |
| `src/index.css` | Retune accent to blue; add `html.light` variable block + light scrollbar | Modify |
| `src/features/timeline/theme.css` | Retune playhead/snap/join to blue; add `html.light` gradient overrides | Modify |
| `index.html` | FOUC inline script; title/meta rebrand | Modify |
| `src/components/brand/matchview-logo.tsx` | New `MatchViewLogo` component | Create |
| `src/components/brand/freecut-logo.tsx` | Old logo component | Delete |
| `src/features/workspace-gate/workspace-gate-splash.tsx` | Logo importer | Modify |
| `public/favicon.svg`, `public/icons/matchview-icon.svg` | Brand SVG assets | Replace / rename |
| `public/manifest.webmanifest` | PWA name/colors/icons metadata | Modify |
| `scripts/generate-pwa-icons.mjs` | One-off PNG icon rasterizer | Create |
| `public/icons/icon-192.png` etc. | PWA PNG icons | Regenerate |
| `src/features/editor/components/settings-dialog.tsx` | Theme toggle UI in General tab | Modify |
| Persistence-key files (see Task 9) | Rename `freecut-*` keys → `matchview-*` | Modify |
| i18n locale JSON files | Rename display strings FreeCut → MatchView | Modify |

---

## Task 1: Theme store

**Files:**
- Create: `src/shared/state/theme-store.ts`
- Test: `src/shared/state/theme-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/shared/state/theme-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore, THEME_STORAGE_KEY } from './theme-store'

describe('theme-store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light')
    useThemeStore.setState({ theme: 'dark' })
  })

  it('setTheme("light") persists the value and adds the light class', () => {
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().theme).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('setTheme("dark") removes the light class', () => {
    useThemeStore.getState().setTheme('light')
    useThemeStore.getState().setTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('toggleTheme flips between dark and light', () => {
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('light')
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/shared/state/theme-store.test.ts`
Expected: FAIL — `theme-store` module does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/shared/state/theme-store.ts`:

```ts
import { create } from 'zustand'

export type Theme = 'dark' | 'light'

/** localStorage key. Stored as a raw `'dark' | 'light'` string (not JSON-wrapped)
 *  so the FOUC guard script in index.html can read it directly. */
export const THEME_STORAGE_KEY = 'matchview-theme'

function readStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark'
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('light', theme === 'light')
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/shared/state/theme-store.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/shared/state/theme-store.ts src/shared/state/theme-store.test.ts
git commit -m "feat(theme): add theme store with light/dark persistence"
```

---

## Task 2: Light theme CSS + blue accent retune in index.css

**Files:**
- Modify: `src/index.css`

No automated test — verified visually in Task 11.

- [ ] **Step 1: Retune the dark `:root` accent from orange to blue**

In `src/index.css`, inside the `:root` block, replace these four lines (currently orange) with the blue brand values:

```css
    /* Primary - MatchView blue accent (playback, active states) */
    --primary: oklch(0.5 0.2 264); /* #1845C8 - brand blue */
    --primary-foreground: oklch(0.98 0 0); /* White text on primary */
```

```css
    --ring: oklch(0.5 0.2 264); /* Blue focus ring */
```

```css
    --sidebar-primary: oklch(0.5 0.2 264);
    --sidebar-primary-foreground: oklch(0.98 0 0);
```

```css
    --sidebar-ring: oklch(0.5 0.2 264);
```

Leave every neutral (`--background`, `--card`, `--secondary`, `--muted`, `--accent`, `--border`, panel/timeline vars) unchanged.

- [ ] **Step 2: Make `color-scheme` theme-aware**

Replace the existing rule:

```css
  /* Force dark mode always */
  html {
    color-scheme: dark;
  }
```

with:

```css
  /* Dark is the default; the `light` class is toggled by the theme store. */
  html {
    color-scheme: dark;
  }

  html.light {
    color-scheme: light;
  }
```

- [ ] **Step 3: Add the `html.light` variable block**

In `src/index.css`, immediately after the closing `}` of the `:root { ... }` block (still inside the first `@layer base`), add:

```css
  /* Light theme — overrides every token from :root. */
  html.light {
    --background: oklch(0.98 0 0);
    --foreground: oklch(0.22 0 0);

    --card: oklch(1 0 0);
    --card-foreground: oklch(0.22 0 0);

    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.22 0 0);

    --primary: oklch(0.5 0.2 264);
    --primary-foreground: oklch(0.98 0 0);

    --secondary: oklch(0.95 0 0);
    --secondary-foreground: oklch(0.28 0 0);

    --muted: oklch(0.96 0 0);
    --muted-foreground: oklch(0.48 0 0);

    --accent: oklch(0.94 0 0);
    --accent-foreground: oklch(0.22 0 0);

    --destructive: oklch(0.58 0.22 25);
    --destructive-foreground: oklch(0.98 0 0);

    --border: oklch(0.9 0 0);
    --input: oklch(0.9 0 0);
    --ring: oklch(0.5 0.2 264);

    --panel-bg: oklch(1 0 0);
    --panel-header: oklch(0.96 0 0);
    --timeline-bg: oklch(0.93 0 0);

    --sidebar: oklch(1 0 0);
    --sidebar-foreground: oklch(0.22 0 0);
    --sidebar-primary: oklch(0.5 0.2 264);
    --sidebar-primary-foreground: oklch(0.98 0 0);
    --sidebar-accent: oklch(0.94 0 0);
    --sidebar-accent-foreground: oklch(0.22 0 0);
    --sidebar-border: oklch(0.9 0 0);
    --sidebar-ring: oklch(0.5 0.2 264);
  }
```

- [ ] **Step 4: Add light-mode scrollbar colors**

In `src/index.css`, after the existing `::-webkit-scrollbar-corner` rule (end of the scrollbar block in the second `@layer base`), add:

```css
  html.light ::-webkit-scrollbar-track {
    background: oklch(0.94 0 0);
  }

  html.light ::-webkit-scrollbar-thumb {
    background: oklch(0.8 0 0);
    border: 2px solid oklch(0.94 0 0);
  }

  html.light ::-webkit-scrollbar-thumb:hover {
    background: oklch(0.72 0 0);
  }

  html.light ::-webkit-scrollbar-corner {
    background: oklch(0.94 0 0);
  }
```

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no CSS errors.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "feat(theme): add light theme variables and blue accent"
```

---

## Task 3: Timeline theme.css — blue retune + light gradients

**Files:**
- Modify: `src/features/timeline/theme.css`

- [ ] **Step 1: Retune playhead / snap / join to blue**

In the `@theme { ... }` block of `src/features/timeline/theme.css`, replace these three lines:

```css
  /* Playhead color */
  --color-timeline-playhead: oklch(0.5 0.2 264); /* MatchView blue */
```

```css
  /* Snap/Join indicator colors */
  --color-timeline-snap: #1845c8; /* brand blue - snap indicator */
  --color-timeline-join: #4f74de; /* lighter blue - join indicator */
```

Leave the timeline item-type colors (`--color-timeline-video`, `-audio`, `-image`, `-text`, `-shape`, `-baseclip`), the in/out marker colors, and `--color-video-preview-background` unchanged — they are a categorical palette and the preview backdrop stays dark in both themes.

- [ ] **Step 2: Add light-mode clip gradient overrides**

At the end of `src/features/timeline/theme.css`, append:

```css
/* Light-theme clip gradient backgrounds — lighter than the dark defaults. */
html.light .bg-waveform-gradient {
  background: linear-gradient(
    to bottom,
    oklch(0.9 0 0) 0%,
    oklch(0.95 0 0) 50%,
    oklch(0.9 0 0) 100%
  );
}

html.light .bg-image-gradient {
  background: linear-gradient(
    to bottom,
    oklch(0.9 0.02 250) 0%,
    oklch(0.95 0.02 250) 50%,
    oklch(0.9 0.02 250) 100%
  );
}

html.light .bg-audio-gradient {
  background: linear-gradient(
    to bottom,
    oklch(0.9 0.02 302) 0%,
    oklch(0.95 0.02 302) 50%,
    oklch(0.9 0.02 302) 100%
  );
}

html.light .bg-text-gradient {
  background: linear-gradient(
    to bottom,
    oklch(0.9 0.02 290) 0%,
    oklch(0.95 0.02 290) 50%,
    oklch(0.9 0.02 290) 100%
  );
}

html.light .bg-shape-gradient {
  background: linear-gradient(
    to bottom,
    oklch(0.9 0.02 45) 0%,
    oklch(0.95 0.02 45) 50%,
    oklch(0.9 0.02 45) 100%
  );
}
```

(`.bg-group-stripes` uses a 12%-opacity mid-gray and reads correctly on both themes — leave it.)

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/features/timeline/theme.css
git commit -m "feat(theme): retune timeline accent to blue, add light gradients"
```

---

## Task 4: index.html — FOUC guard + branding

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the FOUC guard script**

In `index.html`, inside `<head>`, immediately before the `<title>` line, add:

```html
    <script>
      // Apply the saved theme before first paint to avoid a flash.
      (function () {
        try {
          if (localStorage.getItem('matchview-theme') === 'light') {
            document.documentElement.classList.add('light')
          }
        } catch (e) {}
      })()
    </script>
```

- [ ] **Step 2: Rebrand the title and meta tags**

In `index.html`, apply these exact replacements:

- `<meta name="theme-color" content="#111827" />` → `<meta name="theme-color" content="#1e1e1e" />`
- `<meta name="application-name" content="FreeCut" />` → `<meta name="application-name" content="MatchView" />`
- `<meta name="apple-mobile-web-app-title" content="FreeCut" />` → `<meta name="apple-mobile-web-app-title" content="MatchView" />`
- `<title>FreeCut</title>` → `<title>MatchView</title>`

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds. Open `dist/index.html` and confirm the title is `MatchView` and the inline script is present.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(theme): add FOUC guard and rebrand index.html to MatchView"
```

---

## Task 5: New MatchView logo component

**Files:**
- Create: `src/components/brand/matchview-logo.tsx`
- Delete: `src/components/brand/freecut-logo.tsx`
- Modify: `src/features/workspace-gate/workspace-gate-splash.tsx`

- [ ] **Step 1: Create the new logo component**

Create `src/components/brand/matchview-logo.tsx`:

```tsx
import { cn } from '@/shared/ui/cn'

interface MatchViewLogoProps {
  variant?: 'full' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeConfig = {
  sm: { icon: 'w-5 h-5', text: 'text-base', gap: 'gap-1.5' },
  md: { icon: 'w-7 h-7', text: 'text-xl', gap: 'gap-2' },
  lg: { icon: 'w-10 h-10', text: 'text-3xl', gap: 'gap-3' },
}

function HexIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" className={className}>
      <polygon points="110,4 204,56 204,160 110,212 16,160 16,56" fill="#1845C8" />
      <rect x="48" y="62" width="28" height="20" rx="3" fill="white" opacity="0.3" />
      <rect x="84" y="62" width="76" height="20" rx="3" fill="white" opacity="0.3" />
      <rect x="48" y="95" width="28" height="20" rx="3" fill="white" opacity="0.85" />
      <polygon points="56,101 56,109 65,105" fill="#1845C8" />
      <rect x="84" y="95" width="54" height="20" rx="3" fill="white" opacity="0.85" />
      <rect x="48" y="128" width="28" height="20" rx="3" fill="white" opacity="0.3" />
      <rect x="84" y="128" width="38" height="20" rx="3" fill="white" opacity="0.3" />
    </svg>
  )
}

export function MatchViewLogo({ variant = 'full', size = 'md', className }: MatchViewLogoProps) {
  const config = sizeConfig[size]

  if (variant === 'icon') {
    return <HexIcon className={cn(config.icon, className)} />
  }

  return (
    <div className={cn('flex items-center', config.gap, className)}>
      <HexIcon className={config.icon} />
      <span className={cn(config.text, 'font-semibold tracking-tight text-foreground')}>
        MatchView
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Update the importer**

In `src/features/workspace-gate/workspace-gate-splash.tsx`:

- Replace the import line `import { FreeCutLogo } from '@/components/brand/freecut-logo'`
  with `import { MatchViewLogo } from '@/components/brand/matchview-logo'`.
- Replace the usage `<FreeCutLogo variant="full" size="lg" className="justify-center mb-8" />`
  with `<MatchViewLogo variant="full" size="lg" className="justify-center mb-8" />`.

- [ ] **Step 3: Confirm no other importers, then delete the old component**

Run: `npx rg "freecut-logo|FreeCutLogo" src`
Expected: no matches (only the deleted-in-this-step references). If any other file matches, update it the same way as Step 2 before continuing.

Then delete the old file: `git rm src/components/brand/freecut-logo.tsx`

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no missing-import errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/brand/matchview-logo.tsx src/features/workspace-gate/workspace-gate-splash.tsx
git commit -m "feat(brand): replace FreeCutLogo with MatchViewLogo"
```

---

## Task 6: Brand static assets — favicon + icon SVG + manifest

**Files:**
- Modify: `public/favicon.svg`
- Rename + replace: `public/icons/freecut-icon.svg` → `public/icons/matchview-icon.svg`
- Modify: `public/manifest.webmanifest`

- [ ] **Step 1: Replace favicon.svg**

Overwrite `public/favicon.svg` with:

```svg
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

- [ ] **Step 2: Rename and replace the icon SVG**

Run: `npx rg "freecut-icon" src public` — note any references.
Then: `git mv public/icons/freecut-icon.svg public/icons/matchview-icon.svg` and overwrite `public/icons/matchview-icon.svg` with the same SVG content as Step 1. If Step 2's `rg` found references, update each to `matchview-icon.svg`.

- [ ] **Step 3: Rebrand the manifest**

In `public/manifest.webmanifest`, apply these exact replacements:

- `"name": "FreeCut",` → `"name": "MatchView",`
- `"short_name": "FreeCut",` → `"short_name": "MatchView",`
- `"description": "A browser-based video editor.",` → `"description": "A browser-based sports analysis video editor.",`
- `"background_color": "#111827",` → `"background_color": "#1e1e1e",`
- `"theme_color": "#111827",` → `"theme_color": "#1e1e1e",`
- `"label": "FreeCut video editor timeline"` → `"label": "MatchView video editor timeline"`

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add public/favicon.svg public/icons/matchview-icon.svg public/manifest.webmanifest
git rm public/icons/freecut-icon.svg
git commit -m "feat(brand): replace favicon, icon SVG and manifest branding"
```

---

## Task 7: Regenerate PWA PNG icons

**Files:**
- Create: `scripts/generate-pwa-icons.mjs`
- Modify: `package.json` (add `sharp` devDependency)
- Regenerate: `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`

- [ ] **Step 1: Install sharp as a devDependency**

Run: `npm install -D sharp`
Expected: `sharp` is added under `devDependencies` in `package.json`.

- [ ] **Step 2: Create the generation script**

Create `scripts/generate-pwa-icons.mjs`:

```js
// Rasterizes public/favicon.svg into the PWA PNG icons.
// Run with: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/favicon.svg')

await sharp(svg, { density: 512 }).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(svg, { density: 512 }).resize(512, 512).png().toFile('public/icons/icon-512.png')

// Maskable: hexagon scaled to the ~80% safe area on a solid blue background.
await sharp(svg, { density: 512 })
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#1845C8' })
  .png()
  .toFile('public/icons/icon-maskable-512.png')

console.log('PWA icons generated.')
```

- [ ] **Step 3: Run the script**

Run: `node scripts/generate-pwa-icons.mjs`
Expected: prints `PWA icons generated.`; the three PNG files in `public/icons/` are updated.

- [ ] **Step 4: Verify the icons visually**

Open `public/icons/icon-512.png` and `public/icons/icon-maskable-512.png` in an image viewer.
Expected: blue hexagon with the clip-list motif; the maskable variant is full-bleed blue with the hexagon centered inside the safe area.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-pwa-icons.mjs package.json package-lock.json public/icons/icon-192.png public/icons/icon-512.png public/icons/icon-maskable-512.png
git commit -m "feat(brand): regenerate PWA icons from MatchView logo"
```

---

## Task 8: Theme toggle in Settings → General

**Files:**
- Modify: `src/features/editor/components/settings-dialog.tsx`
- Modify: the i18n partial holding `settings.general.*` keys (located in Step 1)

- [ ] **Step 1: Locate the settings i18n keys**

Run: `npx rg -l "\"autoSave\"" src/i18n`
Expected: identifies the JSON file (a partial under `src/i18n/locales/partials/`) that holds the `settings.general` subtree. Call this file `<settings-locale-file>`.

- [ ] **Step 2: Add the theme i18n keys for all 9 languages**

In `<settings-locale-file>`, inside each language's `settings.general` object, add three keys. Use the English values below for `en`; translate them for `es`, `fr`, `de`, `pt-BR`, `tr`, `ja`, `ko`, `zh` keeping the exact same key names:

```json
"theme": "Theme",
"themeDark": "Dark",
"themeLight": "Light"
```

Translations:
- es: `"Tema"`, `"Oscuro"`, `"Claro"`
- fr: `"Thème"`, `"Sombre"`, `"Clair"`
- de: `"Design"`, `"Dunkel"`, `"Hell"`
- pt-BR: `"Tema"`, `"Escuro"`, `"Claro"`
- tr: `"Tema"`, `"Koyu"`, `"Açık"`
- ja: `"テーマ"`, `"ダーク"`, `"ライト"`
- ko: `"테마"`, `"다크"`, `"라이트"`
- zh: `"主题"`, `"深色"`, `"浅色"`

- [ ] **Step 3: Import the theme store in the settings dialog**

In `src/features/editor/components/settings-dialog.tsx`, add this import alongside the other `@/shared` imports (e.g. after the `cn` import):

```ts
import { useThemeStore } from '@/shared/state/theme-store'
```

- [ ] **Step 4: Read theme state inside the component**

In the `SettingsDialog` component body, after the line `const setSetting = useSettingsStore((s) => s.setSetting)`, add:

```ts
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
```

- [ ] **Step 5: Add the theme control to the General section**

In the `activeSection === 'general'` block, after the `undoHistoryDepth` row's closing `</div>` (the last child before the section's closing `</div>`), add this segmented control:

```tsx
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t('settings.general.theme')}</Label>
                    <div className="flex items-center rounded-md border border-border bg-secondary p-0.5">
                      {(['dark', 'light'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setTheme(mode)}
                          className={cn(
                            'rounded px-2.5 py-1 text-xs transition-colors',
                            theme === mode
                              ? 'bg-primary/15 text-primary'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {mode === 'dark'
                            ? t('settings.general.themeDark')
                            : t('settings.general.themeLight')}
                        </button>
                      ))}
                    </div>
                  </div>
```

- [ ] **Step 6: Verify the build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/features/editor/components/settings-dialog.tsx src/i18n/locales/partials
git commit -m "feat(theme): add light/dark toggle to Settings General tab"
```

---

## Task 9: Rename internals — code identifiers & persistence keys

**Files:** as listed per step. This renames `freecut-*` identifiers to `matchview-*`. The legacy IndexedDB name `video-editor-db` is **NOT** renamed.

- [ ] **Step 1: Rename localStorage / schema string keys**

Apply these exact string replacements:

- `src/i18n/index.ts` — `export const I18N_STORAGE_KEY = 'freecut-language'` → `'matchview-language'`
- `src/config/hotkeys.ts` — `export const HOTKEY_EXPORT_SCHEMA = 'freecut-hotkeys'` → `'matchview-hotkeys'`
- `src/app/pwa-install-prompt.tsx` — `const INSTALL_DISMISSED_UNTIL_KEY = 'freecut-pwa-install-dismissed-until'` → `'matchview-pwa-install-dismissed-until'`
- `src/main.tsx` — `const ACCEPTED_APP_UPDATE_SIGNATURE_KEY = 'freecut-accepted-app-update-signature'` → `'matchview-accepted-app-update-signature'`

- [ ] **Step 2: Rename the update-check query params in main.tsx**

In `src/main.tsx`, replace `__freecut_update_check` with `__matchview_update_check` and `__freecut_updated` with `__matchview_updated` (one occurrence each).

- [ ] **Step 3: Rename the IndexedDB handles database**

In `src/infrastructure/storage/handles-db.ts`:
`export const HANDLES_DB_NAME = 'freecut-handles-db'` → `'matchview-handles-db'`.

- [ ] **Step 4: Rename the workspace filesystem markers**

In `src/infrastructure/storage/workspace-fs/paths.ts`:
- `export const MARKER_FILENAME = '.freecut-workspace.json'` → `'.matchview-workspace.json'`
- `export const PROJECT_TRASHED_MARKER_FILENAME = '.freecut-trashed.json'` → `'.matchview-trashed.json'`
- Update the doc-comment references in the same file (`.freecut-workspace.json`, `.freecut-trashed.json`) to the new names.

- [ ] **Step 5: Update files that hardcode the marker names**

- `src/infrastructure/storage/workspace-fs/trash.ts` — update the `.freecut-trashed.json` references in its doc comment to `.matchview-trashed.json`.
- `src/infrastructure/storage/workspace-fs/trash.test.ts` — replace every `.freecut-trashed.json` literal with `.matchview-trashed.json`.
- `src/infrastructure/storage/workspace-fs/README.template.md` — replace `.freecut-workspace.json` with `.matchview-workspace.json`.
- `.gitignore` — replace the line `/.freecut-workspace.json` with `/.matchview-workspace.json`.

- [ ] **Step 6: Rename the workspace toast id**

In both `src/features/workspace-gate/workspace-gate.tsx` and `src/features/workspace-gate/workspace-indicator.tsx`, replace `id: 'freecut-workspace'` with `id: 'matchview-workspace'`.

- [ ] **Step 7: Rename the package**

In `package.json`, replace `"name": "freecut",` with `"name": "matchview",`.

- [ ] **Step 8: Verify no internal `freecut` identifiers remain**

Run: `npx rg -i "freecut" src package.json .gitignore`
Expected: no matches. (`video-editor-db` is a different string and is intentionally untouched — confirm it is still present in `src/infrastructure/storage/legacy-idb/`.)

- [ ] **Step 9: Run tests and build**

Run: `npm run test:run && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(rebrand): rename freecut-* identifiers and keys to matchview-*"
```

---

## Task 10: Rename display strings — i18n + docs

**Files:** i18n locale JSON files; `README.md`, `CHANGELOG.md`, `CLAUDE.md`.

- [ ] **Step 1: Find all display-string occurrences**

Run: `npx rg -i "freecut" src/i18n`
Expected: a list of matches across `src/i18n/locales/*.json` and `src/i18n/locales/partials/*.json` — including `projects.json` (`faqSubheading`, `seeItInActionSubheading`, `demoPreviewAlt`), `editor.json` (`projectBundle`), and `remaining-ui.json` (`defaultTtsPrompt`).

- [ ] **Step 2: Replace the brand name in every i18n string**

In each matched JSON file, replace the brand name inside string values:
- `FreeCut` → `MatchView`
- `Freecut` → `MatchView`
- `freecut` → `MatchView` (e.g. the TTS prompt "Welcome to freecut" becomes "Welcome to MatchView" — the proper noun is capitalized even though the original was lowercase)
- Compound forms keep their suffix: `FreeCut-Projektpaket` → `MatchView-Projektpaket`.

Do **not** alter the string `video-editor-db` where it appears (it is the legacy database name shown to users in the storage-migration dialog).

- [ ] **Step 3: Verify i18n is clean**

Run: `npx rg -i "freecut" src/i18n`
Expected: no matches.

- [ ] **Step 4: Update documentation**

- `README.md` — replace `FreeCut` with `MatchView` in prose. Leave the `freecut.net` URL and the `github.com/walterlow/freecut.git` clone URL as-is (these point at the upstream project, not the fork).
- `CHANGELOG.md` — replace `FreeCut` with `MatchView` in the heading line.
- `CLAUDE.md` — replace the `# FreeCut Web` heading with `# MatchView Web`.

- [ ] **Step 5: Verify and build**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(rebrand): rename FreeCut display strings to MatchView"
```

---

## Task 11: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Full check suite**

Run: `npm run test:run && npm run build && npm run lint`
Expected: all tests pass, build succeeds, lint is clean.

- [ ] **Step 2: Residual-name grep**

Run: `npx rg -i "freecut" src public index.html package.json`
Expected: no matches.

- [ ] **Step 3: Manual smoke test — dark theme**

Run `npm run dev`, open the app. Verify: the MatchView hexagon logo appears on the workspace-gate splash; the browser tab title is "MatchView"; accent color (buttons, focus rings, timeline playhead) is blue, not orange.

- [ ] **Step 4: Manual smoke test — light theme**

Open Settings → General, switch Theme to **Light**. Verify: editor shell, timeline, media library, dialogs, and the projects pages are readable in light mode (no dark-on-dark or invisible text). Reload the page — it stays in light mode with no dark flash. Switch back to Dark and reload — it stays dark.

- [ ] **Step 5: Note any light-mode polish gaps**

While in light mode, watch for elements using white-alpha overlays (`bg-white/5`, `border-white/6`, etc.) that disappear on light backgrounds. Record any noticeable spots — these are a known follow-up from the spec's Risks section and are out of scope for this plan unless they make the UI unusable.

- [ ] **Step 6: Final commit (if any verification fix was needed)**

```bash
git add -A
git commit -m "chore(rebrand): final verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:** theme system (Tasks 1–4, 8), color retune (Tasks 2–3), logo & assets (Tasks 5–7), rename user-facing + internals (Tasks 9–10), settings toggle (Task 8). All spec sections map to tasks.
- **Out-of-scope items** from the spec (no second accent, no team theming, no system detection, no landing redesign, `video-editor-db` untouched) are respected — Task 9 Step 8 and Task 10 Step 2 explicitly preserve `video-editor-db`.
- **Type consistency:** `Theme`, `THEME_STORAGE_KEY`, `useThemeStore`, `setTheme`, `toggleTheme` are defined in Task 1 and used consistently in Tasks 4 (key string only) and 8.
- **Known risk** (white-alpha overlays in light mode) is surfaced as Task 11 Step 5 rather than hidden.
