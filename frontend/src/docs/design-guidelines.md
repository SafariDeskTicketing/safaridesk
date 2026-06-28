# SafariDesk Design Guidelines

> **Last updated:** April 2026 — Updated to reflect visual revamp direction.  
> See `typography-system.md` for the full type scale reference.  
> See `visual-revamp-master-plan.md` for the phased execution plan.

---

## Foundations

- App canvas: light neutral surface in light mode, dark-aware in dark mode
- Shell surfaces derive from sidebar and card surface tokens
- Large panel padding: `24px`
- Standard page inset: managed by `PageContainer` via `var(--shell-page-padding)` — do not add local `px-*` to page roots
- Standard inner card padding: `16–24px` (`p-4` to `p-6`)
- Standard radius: `8px` via `var(--shell-radius)`
- Standard border: `1px solid var(--border-color)` — always use the token, not hardcoded hex

---

## Spacing

Spacing system follows a 4pt base grid.

| Spacing | px | Tailwind |
|---|---|---|
| Micro (icon/badge gap) | 4px | `gap-1` |
| Tight | 8px | `gap-2` / `p-2` |
| Icon label gap | 12px | `gap-3` |
| Card inner (compact) | 16px | `p-4` |
| Card inner (standard) | 20px | `p-5` |
| Card inner (roomy) | 24px | `p-6` |
| Section gap | 20px | `space-y-5` / `gap-5` |
| Page section gap | 24px | `space-y-6` / `gap-6` |
| Major section gap | 32px | `gap-8` |
| Hero section gap | 48px | `gap-12` |

**Page root spacing** is owned entirely by `PageContainer` in `Layout.tsx`. Never add `px-*`, `py-*`, or `mx-auto max-w-*` to a page component root.

---

## Typography

The complete type scale is defined in `src/docs/typography-system.md`.

**Quick reference:**

| Role | Size | Token | Tailwind class |
|---|---|---|---|
| Page title | 22px / 600 | `--font-page-title` | `text-[length:var(--font-page-title)]` |
| Section title | 16px / 600 | `--font-section-title` | `text-[length:var(--font-section-title)]` |
| Body | 15px / 400 | `--font-body` | `text-[length:var(--font-body)]` |
| Label | 14px / 500 | `--font-label` | `text-[length:var(--font-label)]` |
| Meta / helper | 13px / 400 | `--font-meta` | `text-[length:var(--font-meta)]` |
| Stat / KPI | 24px / 700 | — | Use only on dashboard |

> **`length:` prefix is mandatory.** Writing `text-[var(--font-body)]` without `length:` will not emit a `font-size` rule — Tailwind requires the prefix to know the property type.

**Always use:** `PageHeader` for page-level h1, `PageCardHeader` for section h2.  
**Never use:** `text-xl`, `text-2xl`, `text-[13px]`, `text-[15px]`, `text-sm`, `text-xs` in functional app UI.

Font family: **DM Sans** (set globally, no per-component override needed).

---

## Card / Surface System

Every card-like surface must use one of these patterns, in priority order:

1. **`<PageCard>`** — full section with optional `<PageCardHeader>`
2. **`.surface-card`** utility class — same visual as PageCard on a plain div
3. **`<Card>`** from `ui/Card.tsx` — lower-level, acceptable in sub-components
4. **`sd-config-card`** — legacy acceptable only in config pages if switching to `surface-card` requires large refactor

**Card anatomy:**
```css
background:    var(--card-bg)
border:        1px solid var(--border-color)
border-radius: var(--shell-radius)   /* 8px */
box-shadow:    var(--shell-shadow-sm)
padding:       p-4 to p-6
```

**Do not create new card surfaces with:**
- `bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700`
- `bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle`
- Custom `rounded-[12px]`, `rounded-xl` radius values

---

## Icons

- Canonical icon family: Tabler via `src/components/icons/AppIcons.ts`
- Sidebar and top-bar icons: `16px`
- Field and dropdown icons: `14px`
- Table action icons: `14px`
- Dashboard analytics icons: `18px` (acceptable in lightweight card layout)

**Icon migration:** Use feature-by-feature migration. Add missing exports to `AppIcons.ts` before switching imports. Keep `lucide-react` installed until all usages are cleared.

---

## Shell Layout

| Element | Value |
|---|---|
| Content max-width | `var(--shell-content-max-width)` = **1440px** |
| Desktop max-width | `var(--shell-desktop-max-width)` = **1440px** |
| 1920px+ screens | Responsive override in `index.css` — expands to 1600px |
| Sidebar width (open) | 240px |
| Sidebar width (collapsed) | 64px |
| Top bar height | 55.5px |
| Content horizontal gutter | `var(--shell-page-padding)` — 16px base, 26px panel |
| Sidebar position | Fixed left edge — `fixed inset-y-0 left-0 lg:relative` |
| AI panel position | Fixed right edge |
| Content scroll area | Between sidebar and AI panel |

The `PageContainer` component in `Layout.tsx` wraps `<Outlet />` globally — every authenticated route inherits max-width + gutters automatically. Never add `px-*`, `mx-auto`, or `max-w-*` to a page root.

---

## Navigation (Sidebar)

- Active nav: soft accent fill + accent text (`--shell-nav-active-bg`, `--shell-nav-active-text`)
- Hover nav: lighter than active, no fill — just subtle highlight
- Nav item text: `14px / 500` — `var(--font-label)`
- Nav sub-item text: `12px / 400` — `var(--font-meta)`
- Nav icon: `16px`
- Sidebar footer: compact boxed panel, tighter padding than main nav
- No divider below workspace header
- Accent color used on active and hover states only — not decorative

---

## Buttons

| Size | Height | Padding | Font |
|---|---|---|---|
| sm | 34px | px-3 | 14px / 500 |
| md | 38px | px-4 | 14px / 500 |
| lg | 42px | px-5 | 14px / 500 |

Always use `src/components/ui/Button.tsx`. Do not create local button elements.

---

## Inputs and Forms

- Input height: 44px (defined in `ui/Input.tsx`)
- Border radius: `var(--shell-radius)` = 8px
- Default border: `var(--border-color)` — subtle neutral
- Focus: accent border + ring
- Error: soft red border + helper text below (not heavy fill)
- Field label: `14px / 500` — `var(--font-label)`
- Helper text: `12px / 400` — `var(--font-meta)`
- Always use: `ui/Input.tsx`, `ui/Select.tsx`, `ui/Textarea.tsx`

---

## Dropdowns

- White / `--card-bg` surface
- `8px` radius
- Neutral border
- Quiet hover state
- Accent-colored selected state
- Label text: `12px / 500`
- Value text: `14px / 400`
- Menu items: `14px / 400`

---

## Color Usage

- Accent: primary green — buttons, active states, focus rings, active nav
- Accent must NOT tint the main page canvas
- Status labels use background / text / stroke token triads (see token system)

Text hierarchy:
- Primary: `var(--text-primary)` — `#263A33`
- Secondary: `var(--text-secondary)` — `#5F6A5D`
- Muted: `var(--text-muted)` — `#A4ADA5`

---

## Config and Settings Pages

- Use `PageHeader` for every config page title
- Use `PageCard` or `surface-card` for every settings section
- Typography follows the main scale — no local size exceptions
- Persistent visible save affordance when changes are pending
- Do not use `sd-config-shell` forced 13/15px overrides — use token classes

---

## Dashboard

- Dashboard cards use `8px` radius and `var(--border-color)` border
- Analytics metrics: lightweight inline items, not heavy KPI tiles
- Stat icons: `18px` in lightweight card
- Right-rail: compact stacked queue cards with minimal metadata
- All dashboard controls use shared UI primitives (Button, Select, Input)

---

## Magnification

- Controlled by `appScale` in `uiStore.ts`
- Allowed values: `90`, `100`, `110`
- CSS root variable `--app-scale` in `src/index.css`
- Do not change responsive breakpoints for magnification

---

## Dark Mode

- Always validate pages in dark mode after any visual change
- **Never use `dark:` Tailwind class modifiers in functional UI.** All CSS variables auto-swap inside the `.dark {}` block in `index.css`. Adding `dark:` is redundant and will diverge from the token system.
- `var(--card-bg)`, `var(--border-color)`, `var(--text-primary)` etc. are all dark-aware by default.

```tsx
// ❌ Wrong — redundant dark: modifier, breaks token system
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">

// ✅ Right — tokens auto-swap in dark mode
<div className="bg-[var(--card-bg)] text-[var(--text-primary)]">
```

---

## Status Colors

Status colors always come in triads: `bg`, `text`, and `border`. Use `var(--status-{variant}-{property})`.

| Variant | When to use |
|---|---|
| `info` | Informational messages, in-progress, pending |
| `success` | Connected, active, completed, enabled |
| `warning` | Degraded, attention needed, near threshold |
| `danger` | Error, failed, destructive action confirmation |
| `neutral` | Inactive, archived, "coming soon", secondary labels |

**Usage pattern:**
- Background and border → inline `style={{ backgroundColor: 'var(--status-info-bg)', borderColor: 'var(--status-info-border)' }}`
- Text color → `className="text-[var(--status-info-text)]"` or inline `style={{ color: 'var(--status-info-text)' }}`

```tsx
// ✅ Status info banner
<div
  className="rounded-[var(--shell-radius)] border px-4 py-3 text-[length:var(--font-body)]"
  style={{ backgroundColor: 'var(--status-info-bg)', borderColor: 'var(--status-info-border)', color: 'var(--status-info-text)' }}
>
  This is an informational message.
</div>

// ✅ Status badge
<span
  className="px-2 py-0.5 rounded-full text-[length:var(--font-meta)] font-medium"
  style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
>
  Active
</span>
```

**Never use:** `bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300` — these break in dark mode.

---

## Loading States

Use `sd-shimmer` for skeleton loading — not spinners, not `animate-pulse` on gray divs.

```tsx
// ✅ List row shimmer
<div className="px-4 py-3 flex items-center gap-3">
  <div className="sd-shimmer h-8 w-8 rounded-full shrink-0" />
  <div className="flex-1 space-y-1.5">
    <div className="sd-shimmer h-3.5 w-1/3" />
    <div className="sd-shimmer h-3 w-1/2" />
  </div>
  <div className="sd-shimmer h-3 w-20" />
</div>

// ✅ Article/document row shimmer
<div className="px-4 py-3 flex items-center gap-3">
  <div className="sd-shimmer h-4 w-2/3" />
  <div className="sd-shimmer h-3 w-16 ml-auto" />
</div>
```

`sd-shimmer` is defined in `src/index.css` — it uses `var(--surface-muted)` as the base with a sliding gradient animation.

---

## Floating Popovers and Dropdowns

Use `sd-floating-popover` as the container class for all floating menus, filter dropdowns, and tooltips.

```tsx
<div className="sd-floating-popover p-1.5">
  <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-[length:var(--font-label)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">
    Option label
  </button>
</div>
```

`sd-floating-popover` provides: `var(--card-bg)` background, `var(--border-color)` border, `var(--shell-shadow-md)` shadow, and `var(--shell-radius)` border-radius.

**Inner item rules:**
- Container padding: `p-1.5` (6px)
- Item padding: `px-2.5 py-2` (10px/8px)
- Item text: `text-[length:var(--font-label)] text-[var(--text-secondary)]`
- Item hover: `hover:bg-[var(--hover-bg)]`
- Section labels: `text-[length:var(--font-meta)] text-[var(--text-muted)]` + uppercase tracking

---

## QA Checklist (before merging any UI change)

1. Page uses `PageHeader` for its title
2. Card surfaces use `PageCard` / `surface-card` — no bespoke `bg-white rounded-lg border`
3. No root-level `px-*`, `py-*`, `max-w-*` on page component (PageContainer handles these)
4. Typography uses token classes — no `text-xl`, `text-2xl`, `text-[Npx]` in functional UI
5. Color references use CSS tokens — no `text-gray-900`, `bg-gray-50` in main UI
6. Shared primitives used: `Button`, `Input`, `Select`, `Modal`, `Table`
7. Validate light mode + dark mode
8. Validate at 768px, 1280px, 1440px widths
9. `npx tsc --noEmit` passes
10. If new shared pattern introduced: document it in `src/docs/`
