# Frontend Standards

This is the team reference for SafariDesk frontend work. If you touch UI, start here before writing or reviewing code.

## 1. Build From the System, Not From the Page

SafariDesk should feel like one product. That means:

- shared tokens before hardcoded values
- shared primitives before page-local controls
- shared shell classes before page-local wrapper spacing

If a page needs a new pattern, add the pattern to the system first or document the exception immediately.

## 2. Page Layout Contract

Every route should be structured in three layers:

1. shell
2. page stack
3. local content

Use these classes:

- `sd-page-shell` for standard app pages
- `sd-content-shell` for wider content pages
- `sd-config-shell` for internal settings/configuration
- `sd-page-stack` for section rhythm inside the shell

Do not mix wrapper-specific `px-* / py-* / max-w-*` classes into the page root when a shell class already solves the problem.

## 3. Spacing Standard

- Page inset comes from `--shell-page-padding`
- Panel/header/editor inset comes from `--shell-panel-padding`
- Vertical section rhythm should come from shared stack spacing, not one-off `space-y-*` at the route root

If a surface needs more room, prefer:

- promoting a token
- using a documented component variant

Do not silently invent another spacing scale.

## 4. Typography Standard

Use the token hierarchy in `src/index.css`. See `src/docs/typography-system.md` for the full reference.

- page title: `--font-page-title` (22px)
- page subtitle: `--font-page-subtitle` (14px)
- section title: `--font-section-title` (16px)
- body: `--font-body` (15px)
- label: `--font-label` (14px)
- meta: `--font-meta` (13px)

### The `length:` prefix is mandatory

Tailwind cannot infer the CSS property from a custom variable alone. Without the prefix, no `font-size` rule is emitted.

```tsx
// ❌ Wrong — emits nothing
<p className="text-[var(--font-body)]">

// ✅ Right
<p className="text-[length:var(--font-body)]">
```

When readability needs adjustment, fix it systematically. Do not randomly bump one page to solve a local complaint.

## 5. Color Standard

All colors come from CSS custom properties defined in `src/index.css`. Never use hardcoded Tailwind color utilities (`text-gray-900`, `bg-red-100`) in functional UI.

### Text colors

```tsx
text-[var(--text-primary)]    // #263A33 — headings, primary content
text-[var(--text-secondary)]  // #5F6A65 — descriptions, secondary content
text-[var(--text-muted)]      // #A4ADA5 — timestamps, helper text, disabled
```

### Surface colors

```tsx
bg-[var(--card-bg)]           // white / dark-aware card surface
bg-[var(--surface-muted)]     // #F6F8F6 — input backgrounds, row stripes
bg-[var(--surface-subtle)]    // #FBFCFB — icon containers, info boxes
bg-[var(--hover-bg)]          // #F3F6F2 — hover state for list items, buttons
border-[var(--border-color)]  // #E3E9E3 — all borders
```

### Status colors

Status colors come in triads: `bg`, `text`, `border`. Use `var(--status-{variant}-{property})`.

| Variant | Use when |
|---|---|
| `info` | Informational, pending, in-progress |
| `success` | Active, connected, completed |
| `warning` | Attention needed, near threshold |
| `danger` | Error, failed, destructive action |
| `neutral` | Inactive, archived, secondary labels |

**Pattern — background and border use inline style, text color uses className:**

```tsx
// ✅ Status banner
<div
  className="rounded-[var(--shell-radius)] border px-4 py-3 text-[length:var(--font-body)]"
  style={{
    backgroundColor: 'var(--status-info-bg)',
    borderColor: 'var(--status-info-border)',
    color: 'var(--status-info-text)',
  }}
>
  Connected to workspace.
</div>

// ✅ Status badge
<span
  className="px-2 py-0.5 rounded-full text-[length:var(--font-meta)] font-medium"
  style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
>
  Active
</span>
```

**Never use:** `bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300` — breaks in dark mode.

## 6. Dark Mode Rules

**Never add `dark:` Tailwind class modifiers in functional UI code.** All CSS variables defined in `src/index.css` automatically swap inside the `.dark {}` block. Adding `dark:` overrides bypasses the token system and creates inconsistency.

```tsx
// ❌ Wrong
<div className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">

// ✅ Right
<div className="bg-[var(--card-bg)] border-[var(--border-color)]">
```

The only acceptable `dark:` usage is in third-party component overrides or Tailwind config-level styles where CSS variables are not available.

## 7. Loading States

Use `sd-shimmer` skeleton rows — not spinners, not `animate-pulse` wrappers.

```tsx
// ✅ User/contact row shimmer
{isLoading && (
  <div className="divide-y divide-[var(--border-color)]">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="px-4 py-3 flex items-center gap-3">
        <div className="sd-shimmer h-8 w-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="sd-shimmer h-3.5 w-1/3" />
          <div className="sd-shimmer h-3 w-1/2" />
        </div>
        <div className="sd-shimmer h-3 w-20" />
      </div>
    ))}
  </div>
)}

// ✅ Article/document row shimmer
{isLoading && (
  <div className="divide-y divide-[var(--border-color)]">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="px-4 py-3 flex items-center gap-3">
        <div className="sd-shimmer h-4 w-2/3" />
        <div className="sd-shimmer h-3 w-16 ml-auto" />
      </div>
    ))}
  </div>
)}
```

`sd-shimmer` is defined in `src/index.css`. It uses `var(--surface-muted)` as the base with a sliding gradient animation. Shape it with `h-*` / `w-*` / `rounded-*` utilities.

## 8. Floating Popovers and Dropdowns

Use `sd-floating-popover` as the container for all floating menus, filter dropdowns, and tooltips.

```tsx
<div className="sd-floating-popover p-1.5">
  {/* Section label */}
  <p className="px-2.5 py-1 text-[length:var(--font-meta)] uppercase tracking-wide text-[var(--text-muted)]">
    Filter by status
  </p>
  {/* Item */}
  <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-[length:var(--font-label)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">
    Open
  </button>
</div>
```

`sd-floating-popover` provides: `var(--card-bg)` background, `var(--border-color)` border, `var(--shell-shadow-md)` shadow, `var(--shell-radius)` border-radius.

**Inner item rules:**
- Container: `p-1.5`
- Items: `px-2.5 py-2`
- Item text: `text-[length:var(--font-label)] text-[var(--text-secondary)]`
- Item hover: `hover:bg-[var(--hover-bg)]`
- Section labels: `text-[length:var(--font-meta)] text-[var(--text-muted)]` uppercase

## 9. Card Surfaces

| Surface | Use on | Class/Component |
|---|---|---|
| `PageCard` | Any full-width section card | `<PageCard>` component |
| `surface-card` | Inline div-based card | `className="surface-card"` |
| `sd-config-card` | Config pages (`/config/*`) | `className="sd-config-card"` |

Anatomy of all card surfaces:
- Background: `var(--card-bg)`
- Border: `1px solid var(--border-color)`
- Radius: `var(--shell-radius)` (8px)
- Padding: `p-4` to `p-6`

## 10. Primitive Standard

Use shared components whenever they exist.

- buttons: `src/components/ui/Button.tsx`
- inputs: `src/components/ui/Input.tsx`
- selects: `src/components/ui/Select.tsx`
- dropdowns: `src/components/ui/Dropdown.tsx`
- badges: `src/components/ui/Badge.tsx`
- tables: `src/components/ui/Table.tsx`
- modals: `src/components/ui/Modal.tsx`

If the primitive is missing a capability, extend it. Do not clone a local version just to move faster.

## 11. Responsive Standard

Responsive behavior is not "make everything smaller."

Use these rules:

- constrain page width with shell max-width tokens
- compress spacing through root tokens at breakpoints
- let rails stack below content when space runs out
- keep information hierarchy intact on small screens

Wide-screen issues should usually be fixed by shell width or token changes, not by stretching cards forever.

## 12. Visual Consistency Rules

- radius should follow the shared shell radius
- borders stay quiet and neutral
- green accent is intentional, not decorative noise
- hover, focus, active, and empty states must be styled
- dashboard, config, docs, and admin pages must still feel like the same product

## 13. What Reviewers Should Reject

Reject UI code when you see:

- route-root `px-4 md:px-8 py-4` wrappers
- random `max-w-*` values without shell context
- raw HTML controls when shared primitives exist
- `text-sm`, `text-xs`, `text-gray-*`, `bg-gray-*` in functional UI
- `dark:` Tailwind class modifiers in functional UI
- `bg-red-100 dark:bg-red-900/30` status color patterns
- typography changes made to only one page without system reasoning
- duplicated component behavior implemented locally
- `text-[var(--font-body)]` without the `length:` prefix

## 14. Merge Checklist

Before shipping frontend work:

1. Confirm the page uses the correct shell class
2. Confirm spacing is token-driven
3. Confirm typography uses `text-[length:var(--font-*)]` classes
4. Confirm no `dark:` modifiers in functional UI
5. Confirm status colors use `var(--status-{variant}-{bg|text|border})`
6. Confirm shared primitives were used where available
7. Check the page at mobile, desktop, and wide-screen widths
8. `npx tsc --noEmit` passes with 0 errors
9. Update the docs if you introduced a new shared pattern or exception

## 15. Source of Truth

Use these files as the primary references:

- `src/index.css` — all token definitions
- `src/docs/design-guidelines.md` — visual rules and component patterns
- `src/docs/typography-system.md` — full type scale reference
- `src/docs/spacing-rules.md` — page layout and spacing enforcement
- `src/docs/color-tokens.md` — complete status and surface color reference
