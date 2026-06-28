# Spacing Rules

This page is the enforcement layer for SafariDesk page spacing. Use it when touching any frontend route, admin screen, or documentation page.

## Non-Negotiable Rule

Do not create page-level spacing with local wrapper classes such as:

- `px-4 md:px-8`
- `py-4`
- `mx-auto max-w-*`
- mixed page-root `p-*` values

At the page root, use shared shell classes instead.

## Approved Shell Classes

### `sd-page-shell`

Use for app pages that should align to the standard desktop shell width.

- Width constrained by `--shell-desktop-max-width`
- Horizontal padding comes from `--shell-page-padding`
- Use for route-level pages with standard enterprise layouts

### `sd-content-shell`

Use for wider content routes where the page can breathe slightly more.

- Width constrained by `--shell-content-max-width`
- Full page padding comes from `--shell-page-padding`
- Use for dashboards, docs content, knowledge editors, and dense admin views

### `sd-config-shell`

Use for internal configuration pages.

- No artificial desktop max-width
- Padding comes from `--shell-page-padding`
- Typography is normalized for settings screens

### `sd-page-stack`

Use inside the page shell to create a consistent vertical rhythm between sections.

- Standard gap: `24px`
- Replaces ad hoc root `space-y-4`, `space-y-5`, and top-level `py-4` combinations

## Token Source of Truth

These live in `src/index.css`.

- `--shell-page-padding`
- `--shell-panel-padding`
- `--shell-desktop-max-width`
- `--shell-content-max-width`

Do not hardcode replacement values in page components unless the pattern is being promoted into the design system.

## Responsive Rule

Small-screen and large-screen spacing must be solved through token changes, not route-by-route overrides.

- Tablet and mobile compression happens in `src/index.css`
- Large-screen expansion also happens in `src/index.css`
- If one page looks wrong on a big monitor, fix the shell or the shared token first

## Allowed Exceptions

Local padding is acceptable only for:

- inner cards
- modals and drawers
- table cells
- chip groups and inline controls
- highly custom surfaces already documented in the design system

Even then, local spacing must still respect the token scale.

## Critical: PageHeader + sd-page-stack Compounding

**Never wrap `<PageHeader>` inside an `sd-page-stack` container.**

`sd-page-stack` creates a flex-column with `gap: 24px`. `PageHeader` renders its root as
`<header className="mb-6 ...">` with `margin-bottom: 24px`. In CSS Flexbox, margin and gap
**do not collapse** — they add together. The result is a 44px dead gap between the page title
and the first card, instead of the intended 24px.

**Correct pattern — page root should be a plain div:**
```tsx
// ✅ correct
<div className="w-full">
  <PageHeader title="My Page" />
  <PageCard padding="md">...</PageCard>
</div>

// ✅ also correct (AdminCrudPage already does this)
<AdminCrudPage title="My Page" ...>
  <Table ... />
</AdminCrudPage>
```

**Wrong pattern:**
```tsx
// ❌ do not do this — gap compounds with PageHeader mb-6
<div className="sd-page-stack w-full">
  <PageHeader title="My Page" />
  <PageCard ...>...</PageCard>
</div>
```

`sd-page-stack` is appropriate for spacing *between content sections that don't start with
PageHeader*, e.g. a stack of multiple `<PageCard>` blocks below a PageHeader.

---

## Review Checklist

Before merging UI work:

1. Is the page root using a plain `w-full` div (not `sd-page-stack` at the route root)?
2. Is spacing between PageHeader and first card coming from PageHeader's own `mb-6` only?
3. Is the section rhythm for cards below the first driven by `space-y-*` or `sd-page-stack`?
4. Did you avoid introducing route-specific wrapper padding?
5. Does the page still behave at mobile, desktop, and wide-screen sizes?
