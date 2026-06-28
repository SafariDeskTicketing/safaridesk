import navigationConfig from '../navigation.json';

type DocMeta = {
  title: string;
  description: string;
  slug: string;
};

type DocData = {
  meta: DocMeta;
  content: string;
};

const customDocs: Record<string, string> = {
  'design-system/frontend-audit': `# Frontend Audit

This audit compares the current SafariDesk frontend against the active SafariDesk Figma system and the implementation tokens in \`src/index.css\`.

## Audit Scope

- App shell and navigation
- Auth shell
- Shared controls: button, input, select, dropdown, badge, modal
- Data table styling
- Dashboard surfaces and right-rail cards
- Responsive behavior for desktop-first Figma frames

## Current Figma Baseline

- Light app canvas: \`#F8F8F8\`
- White shell surfaces
- Radius: \`8px\`
- Large panel padding: \`24px\`
- Page inset: \`16px\`
- Accent green: \`#257A42\`
- Text hierarchy:
  - primary: \`#263A33\`
  - secondary: \`#5F6A5D\`
  - tertiary: \`#A4ADA5\`
- Sidebar width: \`240px\`
- Max content width: \`1200px\`

## Exact Mismatches Found

### 1. Auth shell was visually off-system

- File: \`src/components/layouts/AuthLayout.tsx\`
- Previous state: dark glassmorphism, heavy black gradients, large cinematic contrast
- Figma system: light enterprise shell with calm surfaces and the same green/neutral token language as the app
- Fix: auth layout now uses the shared light canvas, bordered surfaces, soft panel hierarchy, and SafariDesk tokenized accents

### 2. Shared controls mixed system tokens with generic gray or blue UI

- Files:
  - \`src/components/ui/Button.tsx\`
  - \`src/components/ui/Input.tsx\`
  - \`src/components/ui/Select.tsx\`
  - \`src/components/ui/Dropdown.tsx\`
  - \`src/components/ui/Badge.tsx\`
- Previous state: some controls used SafariDesk variables, others still used generic Tailwind gray, blue, or dark-theme-only treatment
- Figma system: controls should share one border softness, one radius, one typography scale, and one accent/focus treatment
- Fix: controls now use the same border, surface, focus ring, and semantic status variables

### 3. Table styling did not match the light Figma data-density model

- File: \`src/components/ui/Table.tsx\`
- Previous state: generic gray header, blue pagination, mixed text sizes, heavier default table appearance
- Figma system: lightweight enterprise table with quiet header rows, soft separators, and neutral pagination chrome
- Fix: table and pagination were rebuilt around the SafariDesk token set

### 4. Dashboard surfaces were close, but not fully normalized

- Files:
  - \`src/pages/DashboardPage.tsx\`
  - \`src/pages/dashboard/StatCard.tsx\`
  - \`src/pages/dashboard/RecentItems.tsx\`
- Previous state: structurally close to Figma, but shadows, queue-card styling, status colors, and view-all links were still inconsistent
- Figma system: same surface model across filter bars, analytics cards, right rails, and queue items
- Fix: dashboard sections now use shared surface treatment and tokenized status colors

### 5. Docs did not contain a real design handoff layer

- Files:
  - \`src/docs/navigation.json\`
  - \`src/docs/utils/docsUtils.ts\`
- Previous state: docs sections were mostly placeholder content
- Figma system need: a durable design-to-code reference, not only screenshots and ad hoc notes
- Fix: the docs now include audit, component spec, and implementation checklist pages

## Residual Gaps

- \`GenericPersistentNav.tsx\` still uses a legacy visual language and should be aligned next if it remains part of the active experience
- Some older feature pages still use raw \`select\`, raw card wrappers, or direct Tailwind gray/blue values instead of shared primitives
- Dashboard charts are structurally aligned, but chart palette and tooltip polish can still be tuned if you want exact screenshot parity

## Recommendation

Use shared primitives first, then sweep feature pages route-by-route. The fastest path is:

1. Replace raw inputs/selects/buttons with shared UI primitives
2. Replace raw bordered wrappers with shared card/surface patterns
3. Refactor dense list and table pages next
4. Finish page-level responsive tuning after the primitive sweep
`,
  'design-system/component-spec': `# Component Spec

This page documents the SafariDesk frontend contract between Figma and code.

## Foundations

### Canvas and surfaces

- App canvas: \`var(--app-bg)\` => \`#F8F8F8\`
- Primary surface: \`var(--card-bg)\` => white
- Muted surface: \`var(--surface-muted)\`
- Subtle surface: \`var(--surface-subtle)\`
- Standard border: \`var(--border-color)\`
- Standard radius: \`var(--shell-radius)\` => \`8px\`

### Layout tokens

- Sidebar width: \`var(--shell-sidebar-width)\` => \`240px\`
- Collapsed sidebar width: \`var(--shell-sidebar-collapsed-width)\` => \`64px\`
- Topbar height: \`var(--shell-topbar-height)\`
- Desktop content width: \`var(--shell-desktop-max-width)\` => \`1200px\`
- Page inset: \`var(--shell-page-padding)\`
- Large panel padding: \`var(--shell-panel-padding)\`

### Typography tokens

- Page title: \`var(--font-page-title)\`
- Page subtitle: \`var(--font-page-subtitle)\`
- Section title: \`var(--font-section-title)\`
- Body: \`var(--font-body)\`
- Label/meta/nav/button: \`var(--font-label)\`, \`var(--font-meta)\`, \`var(--font-nav)\`, \`var(--font-button)\`

### Semantic status tokens

- Info: \`--status-info-*\`
- Success: \`--status-success-*\`
- Warning: \`--status-warning-*\`
- Danger: \`--status-danger-*\`
- Neutral: \`--status-neutral-*\`

## Shared Primitives

### Button

- File: \`src/components/ui/Button.tsx\`
- Variants: \`primary\`, \`secondary\`, \`outline\`, \`ghost\`, \`danger\`
- Sizes:
  - \`sm\`: 30px high
  - \`md\`: 34px high
  - \`lg\`: 38px high
- Rules:
  - All button chrome comes from the shared token system
  - Primary action uses the SafariDesk green
  - Outline/ghost buttons stay quiet unless hovered

### Input

- File: \`src/components/ui/Input.tsx\`
- Height: 34px
- Radius: 8px
- Label: 12px medium
- Input text: 13px regular
- Rules:
  - Quiet hover
  - Accent focus
  - Soft red error state

### Select

- File: \`src/components/ui/Select.tsx\`
- Mirrors input sizing and border behavior
- Selected dropdown items use shared active navigation tones
- Search mode keeps the same field chrome as input

### Badge

- File: \`src/components/ui/Badge.tsx\`
- Rounded pill
- Semantic styles come from shared status tokens
- Intended for statuses, labels, and role tags

### Dropdown

- File: \`src/components/ui/Dropdown.tsx\`
- White surface
- 8px radius
- Subtle border
- Shared hover/active state language

### Modal

- File: \`src/components/ui/Modal.tsx\`
- Surface uses the same card language as the app shell
- Border, radius, and shadow are tokenized

### Card

- File: \`src/components/ui/Card.tsx\`
- Use this instead of page-local bordered wrappers where possible
- Variants:
  - default surface via \`sd-surface\`
  - muted surface via \`sd-surface-muted\`

### Table

- File: \`src/components/ui/Table.tsx\`
- Use for light enterprise data views
- Header rows stay quiet
- Pagination uses soft pill controls, not default blue buttons

## Shell Specs

### Main app shell

- Files:
  - \`src/components/layout/Layout.tsx\`
  - \`src/components/layout/Header.tsx\`
- Rules:
  - Sidebar and topbar remain neutral
  - Accent appears only on active, hover, focus, and primary actions
  - Search, profile, notifications, and create actions follow the same field/button chrome

### Auth shell

- File: \`src/components/layouts/AuthLayout.tsx\`
- Rules:
  - Use the same light design language as the main app
  - Avoid introducing a second visual system for authentication

## Responsive Rules

- Desktop Figma width is preserved with \`var(--shell-desktop-max-width)\`
- Padding compresses at tablet and mobile breakpoints through root token changes in \`src/index.css\`
- Cards keep hierarchy but stack vertically when rail layouts collapse
`,
  'design-system/implementation-checklist': `# Implementation Checklist

Use this checklist when converting additional SafariDesk Figma frames into production code.

## Before You Build

- Confirm the target Figma frame, node, or screenshot
- Identify whether the work belongs in a shared primitive or a page-specific component
- Map every new color, spacing value, and radius to an existing token before adding anything new

## Token Check

- Use existing canvas, surface, text, and border variables first
- Use semantic status tokens for badges and indicators
- Do not hardcode blue, gray, or random shadow values when a SafariDesk token already exists
- If a new token is truly needed, add it in \`src/index.css\`

## Primitive Check

- Buttons must use \`src/components/ui/Button.tsx\`
- Inputs must use \`src/components/ui/Input.tsx\`
- Dropdown-style selects must use \`src/components/ui/Select.tsx\`
- Status labels must use \`src/components/ui/Badge.tsx\`
- Standard bordered panels should use \`src/components/ui/Card.tsx\` or the \`sd-surface\` contract
- Dense data views should use \`src/components/ui/Table.tsx\`

## Layout Check

- Page content should sit inside the shared \`1200px\` shell width
- Sidebar, topbar, and content spacing should follow shell tokens
- Right rails should stack below main content on smaller screens
- Mobile should preserve hierarchy, not just shrink everything evenly

## Visual Fidelity Check

- Radius matches SafariDesk standard \`8px\`
- Borders are quiet and neutral
- Accent green is used intentionally, not as a background wash for entire pages
- Typography follows the documented scale
- Empty states, hover states, and selected states are all styled

## Documentation Check

- If the implementation introduces a new shared pattern, document it in the design system docs
- If a Figma mismatch is discovered, update the audit page so the team has one source of truth

## Route-by-Route Rollout Plan

1. Sweep pages still using raw form elements
2. Sweep pages still using local bordered wrappers instead of shared surfaces
3. Align data tables and list-heavy admin pages
4. Tune charts, graph legends, and drawer states for exact visual parity
5. Finish any remaining legacy navigation shells
`,
  'design-system/spacing-rules': `# Spacing Rules

This page is the enforcement layer for SafariDesk page spacing. Use it when touching any frontend route, admin screen, or documentation page.

## Non-Negotiable Rule

Do not create page-level spacing with local wrapper classes such as:

- \`px-4 md:px-8\`
- \`py-4\`
- \`mx-auto max-w-*\`
- mixed page-root \`p-*\` values

At the page root, use shared shell classes instead.

## Approved Shell Classes

### \`sd-page-shell\`

Use for app pages that should align to the standard desktop shell width.

- Width constrained by \`--shell-desktop-max-width\`
- Horizontal padding comes from \`--shell-page-padding\`
- Use for route-level pages with standard enterprise layouts

### \`sd-content-shell\`

Use for wider content routes where the page can breathe slightly more.

- Width constrained by \`--shell-content-max-width\`
- Full page padding comes from \`--shell-page-padding\`
- Use for dashboards, docs content, knowledge editors, and dense admin views

### \`sd-config-shell\`

Use for internal configuration pages.

- No artificial desktop max-width
- Padding comes from \`--shell-page-padding\`
- Typography is normalized for settings screens

### \`sd-page-stack\`

Use inside the page shell to create a consistent vertical rhythm between sections.

- Standard gap: \`20px\`
- Replaces ad hoc root \`space-y-4\`, \`space-y-5\`, and top-level \`py-4\` combinations

## Token Source of Truth

These live in \`src/index.css\`.

- \`--shell-page-padding\`
- \`--shell-panel-padding\`
- \`--shell-desktop-max-width\`
- \`--shell-content-max-width\`

Do not hardcode replacement values in page components unless the pattern is being promoted into the design system.

## Responsive Rule

Small-screen and large-screen spacing must be solved through token changes, not route-by-route overrides.

- Tablet and mobile compression happens in \`src/index.css\`
- Large-screen expansion also happens in \`src/index.css\`
- If one page looks wrong on a big monitor, fix the shell or the shared token first

## Allowed Exceptions

Local padding is acceptable only for:

- inner cards
- modals and drawers
- table cells
- chip groups and inline controls
- highly custom surfaces already documented in the design system

Even then, local spacing must still respect the token scale.

## Review Checklist

Before merging UI work:

1. Is the page root using an approved shell class?
2. Is the section rhythm driven by \`sd-page-stack\` or a documented equivalent?
3. Did you avoid introducing route-specific wrapper padding?
4. Does the page still behave at mobile, desktop, and wide-screen sizes?
`,
  'design-system/frontend-standards': `# Frontend Standards

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

- \`sd-page-shell\` for standard app pages
- \`sd-content-shell\` for wider content pages
- \`sd-config-shell\` for internal settings/configuration
- \`sd-page-stack\` for section rhythm inside the shell

Do not mix wrapper-specific \`px-* / py-* / max-w-*\` classes into the page root when a shell class already solves the problem.

## 3. Spacing Standard

- Page inset comes from \`--shell-page-padding\`
- Panel/header/editor inset comes from \`--shell-panel-padding\`
- Vertical section rhythm should come from shared stack spacing, not one-off \`space-y-*\` at the route root

If a surface needs more room, prefer:

- promoting a token
- using a documented component variant

Do not silently invent another spacing scale.

## 4. Typography Standard

Use the token hierarchy in \`src/index.css\`.

- page title: \`--font-page-title\`
- page subtitle: \`--font-page-subtitle\`
- section title: \`--font-section-title\`
- body: \`--font-body\`
- label: \`--font-label\`
- meta: \`--font-meta\`

When readability needs adjustment, fix it systematically. Do not randomly bump one page to solve a local complaint.

## 5. Primitive Standard

Use shared components whenever they exist.

- buttons: \`src/components/ui/Button.tsx\`
- inputs: \`src/components/ui/Input.tsx\`
- selects: \`src/components/ui/Select.tsx\`
- dropdowns: \`src/components/ui/Dropdown.tsx\`
- badges: \`src/components/ui/Badge.tsx\`
- tables: \`src/components/ui/Table.tsx\`
- modals: \`src/components/ui/Modal.tsx\`

If the primitive is missing a capability, extend it. Do not clone a local version just to move faster.

## 6. Responsive Standard

Responsive behavior is not “make everything smaller.”

Use these rules:

- constrain page width with shell max-width tokens
- compress spacing through root tokens at breakpoints
- let rails stack below content when space runs out
- keep information hierarchy intact on small screens

Wide-screen issues should usually be fixed by shell width or token changes, not by stretching cards forever.

## 7. Visual Consistency Rules

- radius should follow the shared shell radius
- borders stay quiet and neutral
- green accent is intentional, not decorative noise
- hover, focus, active, and empty states must be styled
- dashboard, config, docs, and admin pages must still feel like the same product

## 8. What Reviewers Should Reject

Reject UI code when you see:

- route-root \`px-4 md:px-8 py-4\` wrappers
- random \`max-w-*\` values without shell context
- raw HTML controls when shared primitives exist
- one-off color values that bypass tokens
- typography changes made to only one page without system reasoning
- duplicated component behavior implemented locally

## 9. Merge Checklist

Before shipping frontend work:

1. Confirm the page uses the correct shell class
2. Confirm spacing is token-driven
3. Confirm typography follows the shared hierarchy
4. Confirm shared primitives were used where available
5. Check the page at mobile, desktop, and wide-screen widths
6. Update the docs if you introduced a new shared pattern or exception

## 10. Source of Truth

Use these files as the primary references:

- \`src/index.css\`
- \`src/docs/design-guidelines.md\`
- \`src/docs/navigation.json\`
- this frontend standards page
- the spacing rules page
`,
};

const buildDocsIndex = () => {
  const docs: Record<string, DocData> = {};
  for (const section of navigationConfig.navigation) {
    for (const item of section.items) {
      const description = item.description ?? 'Documentation for this topic.';
      docs[item.slug] = {
        meta: {
          title: item.title,
          description,
          slug: item.slug,
        },
        content:
          customDocs[item.slug] ??
          `# ${item.title}\n\n${description}\n\n## Overview\n\nThis section will be expanded with detailed guidance, examples, and best practices.\n\n## Steps\n\n1. Review the requirements for this feature.\n2. Configure your workspace accordingly.\n3. Validate the setup with a test workflow.\n\n## Tips\n\n- Keep your configuration aligned with your team structure.\n- Use tags and categories for clarity.\n- Automate repetitive steps where possible.\n`,
      };
    }
  }
  return docs;
};

const docsIndex = buildDocsIndex();

export const getDocumentContent = async (slug: string): Promise<DocData | null> => {
  const normalized = slug.replace(/^\/+/, '').replace(/\/+$/, '');
  return docsIndex[normalized] ?? null;
};
