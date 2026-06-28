# Color Tokens

> **Source of truth:** `src/index.css` — `:root {}` for light mode, `.dark {}` for dark mode.  
> All tokens auto-swap when the `.dark` class is on the `<html>` element. Never use `dark:` Tailwind modifiers in functional UI.

---

## Text Colors

| Token | Light | Use |
|---|---|---|
| `var(--text-primary)` | `#263A33` | Headings, body text, input values |
| `var(--text-secondary)` | `#5F6A65` | Descriptions, subtitles, secondary labels |
| `var(--text-muted)` | `#A4ADA5` | Timestamps, helper text, placeholders, disabled |

```tsx
<p className="text-[var(--text-primary)]">Primary</p>
<p className="text-[var(--text-secondary)]">Secondary</p>
<p className="text-[var(--text-muted)]">Muted</p>
```

---

## Surface Colors

| Token | Light | Use |
|---|---|---|
| `var(--card-bg)` | `#FFFFFF` | Card backgrounds, modal backgrounds |
| `var(--surface-subtle)` | `#FBFCFB` | Icon containers, tinted info boxes, selected row bg |
| `var(--surface-muted)` | `#F6F8F6` | Input backgrounds, row stripes, skeleton base |
| `var(--hover-bg)` | `#F3F6F2` | List item hover, button ghost hover |
| `var(--border-color)` | `#E3E9E3` | All borders — cards, inputs, dividers |

```tsx
// Input field background
<input className="bg-[var(--surface-muted)] border border-[var(--border-color)]" />

// Hover row
<tr className="hover:bg-[var(--hover-bg)]" />

// Icon container
<div className="bg-[var(--surface-subtle)] text-primary-600 rounded-[var(--shell-radius)]" />
```

---

## Status Color Triads

Every status variant has three tokens: `bg`, `text`, `border`.

### Info (blue-tinted)
| Token | Light value |
|---|---|
| `var(--status-info-bg)` | `#EEF4FF` |
| `var(--status-info-text)` | `#315EFB` |
| `var(--status-info-border)` | `#C7D9FF` |

### Success (green-tinted)
| Token | Light value |
|---|---|
| `var(--status-success-bg)` | `#EDF8F0` |
| `var(--status-success-text)` | `#257A42` |
| `var(--status-success-border)` | `#B3E6C3` |

### Warning (amber-tinted)
| Token | Light value |
|---|---|
| `var(--status-warning-bg)` | `#FFF6E8` |
| `var(--status-warning-text)` | `#D97706` |
| `var(--status-warning-border)` | `#FFD98A` |

### Danger (red-tinted)
| Token | Light value |
|---|---|
| `var(--status-danger-bg)` | `#FFF0EF` |
| `var(--status-danger-text)` | `#E05245` |
| `var(--status-danger-border)` | `#FFCBC8` |

### Neutral (gray-tinted)
| Token | Light value |
|---|---|
| `var(--status-neutral-bg)` | `#F3F5F4` |
| `var(--status-neutral-text)` | `#5F6A65` |
| `var(--status-neutral-border)` | `#D9DDD9` |

---

## How to Apply Status Colors

Background and border **cannot** be expressed as simple Tailwind arbitrary values without complications, so they go in `style={}`. Text color is safe as `className`.

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
  Channel connected successfully.
</div>

// ✅ Status badge / pill
<span
  className="px-2 py-0.5 rounded-full text-[length:var(--font-meta)] font-medium"
  style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
>
  Active
</span>

// ✅ Danger action button hover
<button className="hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-text)]">
  Deactivate
</button>
```

---

## Accent / Primary Color

The brand accent is primary green. It is defined as a Tailwind color scale and also as CSS variables.

| Class | Use |
|---|---|
| `text-primary-600` | Links, "Configure →" labels, active icon tint |
| `bg-primary-600` | Filled buttons, active toggle state |
| `border-primary-600` | Focus ring, selected state border |
| `bg-[var(--surface-subtle)]` | Light tint icon container (replaces `bg-primary-100 dark:bg-primary-900/30`) |

---

## Shell / Navigation Colors

| Token | Use |
|---|---|
| `var(--shell-nav-active-bg)` | Active sidebar item background |
| `var(--shell-nav-active-text)` | Active sidebar item text + icon |
| `var(--shell-nav-hover-bg)` | Sidebar item hover background |

---

## What NOT to Use

These patterns are forbidden in functional UI. They break in dark mode.

```
text-gray-900 dark:text-white     → text-[var(--text-primary)]
text-gray-600 dark:text-gray-400  → text-[var(--text-secondary)]
text-gray-400 dark:text-gray-500  → text-[var(--text-muted)]
bg-white dark:bg-gray-800         → bg-[var(--card-bg)]
bg-gray-50 dark:bg-gray-800/50    → bg-[var(--surface-muted)]
hover:bg-gray-100 dark:hover:bg-gray-800 → hover:bg-[var(--hover-bg)]
bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 → use status-danger tokens
bg-sky-100 dark:bg-sky-900/30     → bg-[var(--surface-subtle)]
bg-primary-100 dark:bg-primary-900/30 → bg-[var(--surface-subtle)]
border-gray-200 dark:border-gray-700  → border-[var(--border-color)]
```
