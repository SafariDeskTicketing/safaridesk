# SafariDesk Typography System

> **This document is the single source of truth for font sizes, weights, and text token usage across the entire app.**  
> Last updated: April 2026

---

## 1. The Scale

SafariDesk uses a six-step functional type scale. **No other font sizes are permitted in functional UI text.**

| Step | Size | Weight | CSS Token | Tailwind Token Class | Use cases |
|---|---|---|---|---|---|
| Page Title | 22px | 600 | `var(--font-page-title)` | `text-[length:var(--font-page-title)]` | `<h1>` on every authenticated route |
| Page Subtitle | 14px | 400 | `var(--font-page-subtitle)` | `text-[length:var(--font-page-subtitle)]` | Supporting line under page title |
| Section Title | 16px | 600 | `var(--font-section-title)` | `text-[length:var(--font-section-title)]` | Card headings, `<h2>` inside page sections |
| Body | 15px | 400 | `var(--font-body)` | `text-[length:var(--font-body)]` | Default content text, descriptions, table cells |
| Label | 14px | 500 | `var(--font-label)` | `text-[length:var(--font-label)]` | Form labels, table column headers, nav items |
| Meta | 13px | 400 | `var(--font-meta)` | `text-[length:var(--font-meta)]` | Timestamps, badge text, helper/hint text, sub-items |

### Special-purpose additions (use sparingly)
| Step | Size | Weight | Use |
|---|---|---|---|
| Stat Value | 24px | 700 | Dashboard KPI numbers only |
| Display | 28–32px | 700 | Hero text, onboarding screens, marketing copy inside app |
| Button | 14px | 500 | All button labels — use `var(--font-button)` |

---

## 2. Font Weights

| Token | Value | Name | Use |
|---|---|---|---|
| `var(--font-weight-title)` | 600 | semibold | Page titles, section titles |
| `var(--font-weight-body)` | 400 | regular | Body text, subtitles |
| `var(--font-weight-medium)` | 500 | medium | Labels, nav items, buttons |

**Weight in CSS:** Always use `style={{ fontWeight: 'var(--font-weight-title)' }}` for inline style or the component token class, not Tailwind `font-semibold` on functional headings. Tailwind font utilities are acceptable only when using the semantic component classes (`.text-page-title` already embeds the correct weight).

---

## 3. Utility Classes (use these in JSX)

These are defined in `src/index.css` under `@layer components`:

```
.text-page-title    → 22px / 600 / --text-primary
.text-page-subtitle → 14px / 400 / --text-secondary
.text-section-title → 16px / 600 / --text-primary
.text-body          → 15px / 400 / --text-primary
.text-label         → 14px / 500 / --text-primary
.text-meta          → 13px / 400 / --text-secondary
.text-stat-value    → 24px / 700 / --text-primary
```

**Preferred pattern (component-based):**
```tsx
<h1 className="text-[length:var(--font-page-title)] leading-tight text-[var(--text-primary)]"
    style={{ fontWeight: 'var(--font-weight-title)' }}>
  Page Title
</h1>
```

**Even shorter via `PageHeader` (preferred):**
```tsx
<PageHeader title="Page Title" subtitle="Supporting description" />
```
`PageHeader` already handles all the above typography correctly — use it for every page.

---

## 4. What NOT to Use

These patterns are forbidden in functional UI code. Raise a review comment if you see them.

### Forbidden sizes
```
text-[10px]   → too small — never use
text-[11px]   → too small — never use
text-[12px]   → too small — use text-meta (13px)
text-[17px]   → not on scale — use section-title (16px) or body (15px)
text-[18px]   → not on scale — use page-title (22px) or section-title (16px)
text-[20px]   → not on scale — use page-title (22px) or section-title (16px)
```

### Forbidden Tailwind shortcuts (in functional app UI)
```
text-xs   → use text-[length:var(--font-meta)] instead (13px)
text-sm   → use text-[length:var(--font-body)] or text-[length:var(--font-label)] (15px / 14px)
text-base → use text-[length:var(--font-section-title)] (16px)
text-lg   → use text-[length:var(--font-section-title)] (16px) or text-[length:var(--font-page-title)] (22px)
text-xl   → not in scale — use page title (22px)
text-2xl  → not in scale — use stat/display only
```

> **Exception:** `text-xs`, `text-sm` etc. are acceptable in third-party component overrides and markdown rendered content where raw Tailwind utilities are required by the renderer.

### Forbidden color references
```
text-gray-900     → use text-[var(--text-primary)]
text-gray-600     → use text-[var(--text-secondary)]
text-gray-400     → use text-[var(--text-muted)]
dark:text-white   → use text-[var(--text-primary)] (dark-aware)
```

---

## 5. Color Hierarchy

Always use CSS variable references for text color — never hardcode gray values.

| Role | Token | Light value | Dark value |
|---|---|---|---|
| Primary text | `var(--text-primary)` | `#263A33` | light on dark bg |
| Secondary text | `var(--text-secondary)` | `#5F6A5D` | muted on dark bg |
| Muted / disabled | `var(--text-muted)` | `#A4ADA5` | lighter muted |
| Link / accent | `var(--primary-600)` | green accent | same accent |

---

## 6. Sidebar Typography

The sidebar nav is its own micro-typography context.

| Element | Size | Weight | Token |
|---|---|---|---|
| Nav group label | 13px | 600 | `var(--font-meta)` + heavier weight |
| Nav item (top level) | 14px | 500 | `var(--font-label)` |
| Nav sub-item | 13px | 400 | `var(--font-nav-submenu)` |
| Workspace name | 14px | 600 | `var(--font-workspace-title)` |
| Workspace subtitle | 12px | 400 | `var(--font-workspace-subtitle)` |
| Active item | same size + accent color | — |
| Badge / count chip | 13px | 500 | `var(--font-meta)` |

---

## 7. Form Typography

| Element | Size | Weight | Token |
|---|---|---|---|
| Field label | 14px | 500 | `var(--font-label)` |
| Field input text | 15px | 400 | `var(--font-body)` |
| Helper / hint text | 13px | 400 | `var(--font-meta)` |
| Error text | 13px | 400 | `var(--font-meta)` + error color |
| Button text | 14px | 500 | `var(--font-button)` |

---

## 8. Table Typography

| Element | Size | Weight | Token |
|---|---|---|---|
| Column header | 14px | 500 | `var(--font-label)` |
| Cell body text | 15px | 400 | `var(--font-body)` |
| Cell meta text (date, id) | 13px | 400 | `var(--font-meta)` |
| Pagination text | 15px | 400 | `var(--font-body)` |
| Badge/chip | 13px | 500 | `var(--font-meta)` |

---

## 9. Common Mistakes and Corrections

| Mistake | Correct replacement |
|---|---|
| `<h1 className="text-2xl font-bold">` | `<PageHeader title="..." />` |
| `<h2 className="text-lg font-semibold">` | `<PageCardHeader title="..." />` or `className="text-section-title"` |
| `<p className="text-sm text-gray-600">` | `<p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">` |
| `<span className="text-xs text-gray-400">` | `<span className="text-[length:var(--font-meta)] text-[var(--text-muted)]">` |
| `<label className="text-sm font-medium text-gray-700">` | `<label className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">` |
| `<td className="text-sm">` | `<td className="text-[length:var(--font-body)]">` |
| `className="text-[14px]"` | `className="text-[length:var(--font-body)]"` |
| `className="text-[20px] font-semibold"` | Use section title (16px) or page title (22px) token |
| `style={{ fontSize: '12px' }}` | Not permitted — use meta token (13px) |
| `style={{ fontSize: '10px' }}` | Never — minimum is 13px (meta) |

---

## 10. Implementation Reference

**In a page component:**
```tsx
import { PageHeader } from '../components/layout';

const MyPage = () => (
  <div>
    <PageHeader
      title="My Page"
      subtitle="Manage your things"
      actions={<Button>Add New</Button>}
    />
    <section className="surface-card p-5 mt-4">
      <h2 className="text-[length:var(--font-section-title)]"
          style={{ fontWeight: 'var(--font-weight-title)' }}>
        Section Name
      </h2>
      <p className="mt-1 text-[length:var(--font-body)] text-[var(--text-secondary)]">
        Description text
      </p>
    </section>
  </div>
);
```

**In a form label:**
```tsx
<label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
  Field Name
</label>
```

**In a table header:**
```tsx
<th className="text-[length:var(--font-label)] font-medium text-[var(--text-secondary)]">
  Column Name
</th>
```

**In a helper text span:**
```tsx
<span className="text-[length:var(--font-meta)] text-[var(--text-muted)]">
  This is helper text
</span>
```
