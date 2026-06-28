# SafariDesk Visual Revamp — Master Plan

> **Owner:** Job Tanui  
> **Status:** Execution Phase (0-3 Active)  
> **Last updated:** April 2026  
> **Scope:** Full authenticated-app visual revamp — card layouts, typography, spacing, sidebar, `/config/*`, `/users/*`, all pages

---

## 1. Objective

Bring every authenticated page in SafariDesk to the same visual standard already established on `/tickets` and `/tasks`.

The outcome must be:
- One card layout language across the entire app
- One strict typography scale (12 / 14 / 16 / 18 / 24 px — nothing else in functional UI)
- One spacing rhythm derived from the existing token system
- Sidebar nav that reads cleanly at the established scale
- Config and Users pages that look as polished as the ticket/task pages do today
- All duplicated components collapsed before new UI is added

### What does NOT change
- All business logic, API integration, and state management
- React Router structure
- Authentication/permissions model
- The existing CSS variable design token system (it is already strong — we use it more, not replace it)

## Execution Snapshot (April 2026)
- Typography tokens in `src/index.css` now match the guide scale (`18/16/14/12` with `24` stat and `28/32` display tiers).
- Shared table typography in `src/components/ui/Table.tsx` aligned to label/body token roles.
- `/users/agents`, `/users/customers`, and `/users/roles` migrated to `PageHeader` + `PageCard` shells.
- Agent create/edit duplication collapsed into a single mode-driven `src/pages/users/mini/AgentForm.tsx`; legacy `NewAgent.tsx` and `EditAgent.tsx` removed.
- Legacy `DataTable.tsx` now delegates rendering to canonical `Table.tsx` (compat wrapper) to reduce table system drift.
- `src/pages/sla/main.tsx` now uses `PageHeader` and `sd-page-stack` root shell.
- Phase-0 typography gate path restored: `scripts/check-ui-scale.mjs` and `ui-scale-baseline.json` are now in `SafariDesk-Front` and `npm run ui-scale:check` passes.

---

## 2. Figma Design — How to Connect

The Figma design is on the user's desktop Figma app. To allow Claude and the AI tooling to pull the design directly:

**Steps to enable Figma Dev Mode MCP:**
1. Open the Figma desktop app and update to the latest version
2. Open the Figma menu (upper-left corner)
3. Navigate to **Preferences → Enable Dev Mode MCP Server**
4. Restart the Claude desktop app (Cowork)
5. Share the Figma file URL with Claude in the next session

Once enabled, Claude can pull screenshots, spacing values, color tokens, component hierarchy, and typography directly from the Figma file without manual copy/paste.

**What to pull from Figma:**
- Color tokens and their mapping to CSS variables
- Typography scale (confirm 12/14/16/18/24 intention)
- Card/surface anatomy (border, radius, shadow, padding)
- Sidebar nav anatomy and spacing
- Config and Users page frame references
- Spacing grid system (confirm 4pt base)

> Until Figma Dev Mode is enabled, this plan uses the existing `design-guidelines.md` + codebase audit as the source of truth for design decisions.

---

## 3. Current State Assessment

### 3.1 What is already working
| Item | Status |
|---|---|
| CSS variable token system (`--font-*`, `--shell-*`, `--card-bg`, `--border-color`, etc.) | ✅ Solid |
| `PageContainer` — GitHub-style max-width wrapper in `Layout.tsx` | ✅ Done |
| `PageHeader` — standardized page title/subtitle/actions | ✅ Done |
| `PageCard` / `PageCardHeader` — canonical card surface | ✅ Done |
| Typography utility classes (`.text-page-title`, `.text-section-title`, `.surface-card`, etc.) | ✅ Done |
| `sd-content-shell` neutralized (no longer double-constrains) | ✅ Done |
| Dashboard — PageHeader wired | ✅ Done |
| Settings — PageHeader wired | ✅ Done |
| Integrations (main) — PageHeader + surface-card | ✅ Done |
| Notifications — wrapper + card classes updated | ✅ Done |
| React Query v5 fix | ✅ Done |
| Token refresh URL fix | ✅ Done |
| Duplicate cn() / date.ts consolidated | ✅ Done |

### 3.2 What is NOT done yet (this revamp plan covers these)
| Area | Issue |
|---|---|
| `/config/*` pages | Still use ad hoc `sd-config-card`, raw `bg-white`, `text-[Npx]` pixel sizes |
| `/users/*` pages | Reduced variance — Agents/Customers/Roles migrated; Profile/Security and remaining typography cleanup still pending |
| `/sla/*` pages | Entire SLA surface is high variance — custom px wrappers, custom steppers, no shared cards |
| Setup wizard pages (Slack, Teams, Telegram, SMS) | Duplicate 3-step layout per provider, local typography |
| Sidebar nav items | Mostly tokenized; remaining micro-components still need final pass |
| Profile / Security tab | Local switch/stat component variants outside shared system |
| Agent create / edit forms | Resolved — merged into mode-driven `AgentForm` |
| Email integration flow | 6+ overlapping modals/drawers/wizards (D5) |
| Table system | Compatibility layer active: `DataTable.tsx` now routes through `Table.tsx`; full call-site migration pending |
| `text-xs / text-sm / text-[Npx]` usage | 850+ occurrences not on token scale |

---

## 4. Typography System (Strict Policy)

This is the single agreed type scale. No other sizes are permitted in functional UI text.

| Role | Size | Weight | Token class | Use |
|---|---|---|---|---|
| Page Title | 18px | 600 | `--font-page-title` / `.text-page-title` | `<h1>` on every route |
| Page Subtitle | 14px | 400 | `--font-page-subtitle` / `.text-page-subtitle` | Supporting text under page title |
| Section Title | 16px | 600 | `--font-section-title` / `.text-section-title` | Card headings, section headers |
| Body | 14px | 400 | `--font-body` / `.text-body` | Default content text |
| Label | 14px | 500 | `--font-label` / `.text-label` | Form labels, table headers, nav items |
| Meta | 12px | 400 | `--font-meta` / `.text-meta` | Helper text, timestamps, badges, chips |
| Button | 14px | 500 | `--font-button` | All button labels |
| KPI / Stat | 24px | 700 | `--font-stat` (add if needed) | Dashboard metrics only |
| Display (hero) | 24px–32px | 700 | Exceptional use only | Not in config/users |

**What to remove from config/users/SLA/sidebar:**
- `text-[13px]`, `text-[15px]`, `text-[16px]`, `text-[17px]`, `text-[20px]` — replace with nearest token
- `text-xs` in functional labels — replace with `text-[length:var(--font-meta)]`
- `text-sm` in body content — replace with `text-[length:var(--font-body)]`
- `text-2xl` in page titles — replace with `text-[length:var(--font-page-title)]`
- `font-bold` in headings — replace with `font-[var(--font-weight-title)]`

**Sidebar specifically:** Nav items should be 14px / 500 weight (`.text-label` scale). Active + hover use the accent color tokens already in place.

---

## 5. Card / Surface System

SafariDesk uses one visual card language. Every card-like surface on every page should conform to this anatomy.

### 5.1 Card anatomy
```
background:   var(--card-bg)          ← white in light / dark-aware
border:       1px solid var(--border-color)
border-radius: var(--shell-radius)    ← 8px
box-shadow:   var(--shell-shadow-sm)  ← subtle
padding:      16px–24px (p-4 to p-6)
```

### 5.2 Shared surface classes (use these, in priority order)
| Class | When to use |
|---|---|
| `PageCard` (component) | Full page sections that need a card wrapper with optional header |
| `surface-card` (utility class) | Quick card surface on a div — same visual as PageCard |
| `sd-config-card` | Legacy config-page card — acceptable only if `surface-card` would require a larger refactor |
| `Card` (component) | Lower-level shared UI card — use when PageCard is too heavy |

### 5.3 What to stop using
- `bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700` — replace with `surface-card`
- `bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle` — same
- Arbitrary `rounded-[12px]`, `rounded-xl` — use `rounded-[var(--shell-radius)]`

---

## 6. Spacing Grid

All spacing uses the 4pt base grid from `design-guidelines.md`.

| Usage | Value | Tailwind |
|---|---|---|
| Micro gap (icon, badge) | 4px | `gap-1` / `p-1` |
| Tight gap | 8px | `gap-2` / `p-2` |
| Icon / label gap | 12px | `gap-3` |
| Card inner padding (compact) | 16px | `p-4` |
| Card inner padding (standard) | 20px | `p-5` |
| Card inner padding (roomy) | 24px | `p-6` |
| Section gap | 20px | `gap-5` / `space-y-5` |
| Page section gap | 24px | `gap-6` / `space-y-6` |
| Major section gap | 32px | `gap-8` |

**Page root spacing:** PageContainer handles this globally via `px-4 sm:px-6 lg:px-8` and `py-6 sm:py-8`. No page component should add root-level `px-*` or `py-*`.

---

## 7. Per-Area Plan

### 7.1 `/config/*` pages

All config pages need:
1. Root wrapper changed from `sd-config-content` to `<div className="sd-page-stack">` (section rhythm container)
2. `PageHeader` at the top for title/subtitle/actions
3. All card surfaces switched to `surface-card` (replacing inline `bg-white rounded-lg border...`)
4. Typography replaced with token classes

| File | Priority | Card work | Typography work | Notes |
|---|---|---|---|---|
| `components/config/Gen.tsx` | High | Replace ad hoc cards with `surface-card` / `PageCard` | Replace `text-[16px]`, `text-[15px]` with tokens | Monolithic — split into section components after card pass |
| `components/config/HelpCenter.tsx` | Medium | Replace `Card` + custom Toggle divs with `surface-card` + `ToggleSwitch` | Replace `text-sm`, `text-base` with tokens | `text-sm` base wrapper needs removal |
| `components/config/Billing.tsx` | Medium | Align package cards to `surface-card` | Replace local heading sizes | Keep pricing grid layout |
| `pages/config/csat.tsx` | Medium | Keep `sd-config-card` — it already uses CSS vars | Replace `text-[15px]`, `text-[14px]`, `text-[12px]` with token classes | Closest to compliant already |
| `pages/config/integrations.tsx` | Medium | Replace `bg-white dark:bg-surface-elevated rounded-lg border` cards with `surface-card` | Replace `text-[20px]`, `text-[15px]`, `text-[17px]` | Grid of integration cards |
| `pages/config/slack-setup.tsx` | High | Shared `IntegrationSetupScaffold` (see §9.3) | Replace all local sizes | Duplicate of teams/telegram/sms setup |
| `pages/config/teams-setup.tsx` | High | Same as above | Same | Duplicate |
| `pages/config/telegram-setup.tsx` | High | Same | Same | Duplicate |
| `pages/config/safari-sms-setup.tsx` | High | Same | Same | Duplicate |

### 7.2 `/users/*` pages

| File | Priority | Card work | Typography work | Notes |
|---|---|---|---|---|
| `pages/users/Agents.tsx` | High | Add `PageHeader`, wrap table area in `PageCard` | Replace local classes | Need AgentForm merge first (§9.5) |
| `pages/users/Customers.tsx` | High | Add `PageHeader`, wrap table in `PageCard` | Replace local classes | Similar CRUD to Agents |
| `pages/users/Roles.tsx` | High | Uses `Card` component already — switch to `PageCard` | Replace local heading sizes | Permission matrix needs careful layout |
| `pages/users/Profile.tsx` | Medium | Profile tabs in `PageCard` sections | Replace local `text-sm`, `font-medium` | Has local `StatCard` + `Switch` to consolidate |
| `pages/users/SecurityTab.tsx` | Medium | `Card` → `PageCard` | Align to token scale | Sub-component of Profile |
| `pages/users/mini/NewAgent.tsx` | High | Form inside `PageCard` | Align labels to `text-label` | Merge with EditAgent |
| `pages/users/mini/EditAgent.tsx` | High | Same | Same | Merge with NewAgent into `AgentForm` mode prop |

### 7.3 Sidebar (`components/layout/Header.tsx`)

- Nav item font size: must use `text-[length:var(--font-label)]` = 14px/500
- Nav item sub-item: `text-[length:var(--font-meta)]` = 12px/400
- Active state: token-based accent fill (already exists)
- Flyout / what's-new drawer: replace `text-xl`, `text-[16px]`, `text-[14px]`, `text-xs` with token classes
- Sidebar footer: compact, uses same token scale

### 7.4 `/sla/*` pages (under Config)

SLA is the most complex area because of the high degree of duplication.

| File | Priority | Action |
|---|---|---|
| `pages/sla/main.tsx` | High | Remove `min-h-screen bg-gray-50 px-4 md:px-8 py-4 flex justify-center` root — use `sd-page-stack` instead. Add `PageHeader`. |
| `pages/sla/add.tsx` | High | Use `PageCard` for each step. Typography pass. |
| `pages/sla/edit.tsx` | High | Same as add.tsx — merge into shared SLA editor (§9.4) |
| `pages/sla/mini/PolicyForm.tsx` | Medium | Replace custom `Stepper` with `ui/Stepper.tsx` (it exists!). Card pass. |
| `pages/sla/mini/BusinessHoursComponent.tsx` | Medium | Consolidate with `BusinessHoursForm.tsx` + `BusinessHoursInline.tsx` |
| `pages/sla/mini/HolidayComponent.tsx` | Medium | Consolidate with `HolidayForm.tsx` |
| `pages/sla/mini/PoliciesComponent.tsx` | Medium | Card pass |

---

## 8. Duplicate Component Removal Plan

Remove duplicates **before** applying the card/typography pass. Removing dead code first makes the migration cleaner.

### Phase A — High-value, low-risk removals (do first)

| Cluster | Files to remove / merge | Replacement |
|---|---|---|
| D1: Parallel settings routes | `/settings/*` → redirect to `/config/*`. `SettingsPage.tsx` removed after redirect validation. | `ConfigPage` via `config.tsx` |
| D9: Agent create/edit | Merge `NewAgent.tsx` + `EditAgent.tsx` into `AgentForm.tsx` with `mode: 'create' \| 'edit'` prop | `AgentForm.tsx` |
| D8: Task/Ticket settings modals | Extract shared `ModalSectionCard` + `ModalFooter` primitives | Shared modal atoms |
| D11: Table duplication | Deprecate `DataTable.tsx` in favor of `Table.tsx` variants | `ui/Table.tsx` |

### Phase B — Medium effort removals (do after card pass)

| Cluster | Files to merge | Replacement |
|---|---|---|
| D7: Integration setup wizards | Merge Slack/Teams/Telegram/SMS setup into `IntegrationSetupScaffold.tsx` with provider config map | `IntegrationSetupScaffold` |
| D3: CRUD scaffold | Agents, Customers, Roles, Departments, TicketCategories, Labels share list+filter+modal. Extract `AdminCrudPage` scaffold | `AdminCrudPage` |
| D6: SLA add/edit | `add.tsx` + `edit.tsx` → one `SlaEditor.tsx` with mode prop | `SlaEditor.tsx` |

### Phase C — Complex consolidations (do last)

| Cluster | Files | Replacement |
|---|---|---|
| D5: Email integration | MailIntegrations + MailIntegrationDrawer + MailIntegrationWizard + UpdateEmailModal + ValidateCredentialsModal + EmailSettings + Emails + EmailTemplates + EmailFilters + SmtpSettings | Shared `IntegrationFormSection` atoms |
| D4: General/business settings | Gen.tsx + Settings.tsx + GeneralSettings.tsx + BusinessSettings.tsx | Canonical general settings composition |

---

## 9. Proposed New Shared Components

These are the components that support the migration. Some are now implemented and being adopted incrementally.

### 9.1 `AdminCrudPage` scaffold
```tsx
<AdminCrudPage
  title="Agents"
  subtitle="Manage your team members and their access"
  actions={<Button>Add Agent</Button>}
  filterBar={<FilterRow />}
>
  <Table ... />
</AdminCrudPage>
```
Replaces the repeated page-title + filter-row + table-card pattern in every CRUD page.

### 9.2 `SettingsSectionCard`
```tsx
<SettingsSectionCard title="Email Notifications" description="Configure how email alerts are delivered">
  <ToggleRow label="New ticket alert" />
  <ToggleRow label="SLA breach alert" />
</SettingsSectionCard>
```
Replaces the repeated card+label+toggle pattern in config pages.

### 9.3 `IntegrationSetupScaffold`
```tsx
<IntegrationSetupScaffold
  provider="slack"
  steps={slackSteps}
  logo={<SlackLogo />}
  title="Connect Slack"
/>
```
Replaces the 4 identical 3-step wizard pages.

### 9.4 `SlaEditor`
```tsx
<SlaEditor mode="create" /> // or mode="edit" policyId={id}
```
Collapses `add.tsx` + `edit.tsx` into one composition.

### 9.5 `AgentForm`
```tsx
<AgentForm mode="create" />
<AgentForm mode="edit" agentId={id} initialValues={agent} />
```
Collapses `NewAgent.tsx` + `EditAgent.tsx`.

---

## 10. Execution Phases

### Phase 0 — Baseline ✅ Complete
- PageContainer, PageHeader, PageCard primitives created
- Typography utility classes added to index.css
- sd-content-shell neutralized
- Dashboard, Settings, Integrations, Notifications pages migrated
- React Query, token refresh URL, cn() / date.ts fixes done

### Phase 1 — Typography normalization ✅ Active (major baseline complete)
- Token hierarchy defined in CSS ✅
- Core shell/font tokens aligned to guide scale ✅
- Shared Table typography aligned to token roles ✅
- **Remaining:** deep feature-level cleanup in config/email/SLA/profile-security surfaces

### Phase 2 — Config + Users card + typography pass 🔲 Active
**Estimated effort:** 4–6 days of focused work

Order of attack:
1. Sidebar (`Header.tsx`) — typography only, no structural change ✅
2. `/users/*` pages — PageHeader + PageCard + typography ✅ (Agents/Customers/Roles)
3. `/config/*` pages — PageHeader + surface-card + typography (leave setup wizards for Phase 4) 🟡 in progress
4. `/sla/main.tsx` — PageHeader + PageCard wrapper 🟡 header/shell done; deeper card pass pending

### Phase 3 — Duplicate removal — first pass 🟡 In progress
**Estimated effort:** 5–7 days

1. Merge `NewAgent` + `EditAgent` → `AgentForm` ✅
2. Deprecate `DataTable.tsx` → extend `Table.tsx` ✅
3. `SettingsPage.tsx` route redirect + removal ✅
4. Create `AdminCrudPage` scaffold ✅ (adopted by `/users/agents`)

### Phase 4 — Integration setup + SLA convergence 🔲 Pending
**Estimated effort:** 7–10 days

1. `IntegrationSetupScaffold` — migrate Slack, Teams, Telegram, SMS
2. `SlaEditor` — merge add/edit
3. Consolidate SLA sub-components (BusinessHours × 3, Holiday × 2)

### Phase 5 — Email integration consolidation 🔲 Pending
**Estimated effort:** 5–7 days
- Shared `IntegrationFormSection` atoms
- Consolidate 10 email-related files

### Phase 6 — Hardening + QA 🔲 Pending
**Estimated effort:** 3–4 days
- Full desktop + mobile visual QA
- TypeScript clean (`npx tsc --noEmit`)
- Icon migration to AppIcons where outstanding
- Remove all deprecated components and routes

---

## 11. Visual QA Checkpoints

After each phase, validate these pages at 1280px, 1440px, and 768px widths:

| Page | Check |
|---|---|
| Dashboard | Card rhythm, stat cards, chart panel |
| Tickets list | Table, filter row, empty state |
| Ticket detail | Two-column layout, sidebar, timeline |
| Tasks list | Same as tickets |
| Config → General | Section cards, form inputs, save affordance |
| Config → SLA | Policy list, add/edit forms, business hours |
| Config → Email | Integration list, wizard/drawer forms |
| Config → Integrations | Card grid, status badges |
| Users → Agents | Table, add/edit form drawer |
| Users → Customers | Table, contact detail |
| Users → Roles | Permission matrix |
| Profile | Tabs, avatar, settings |
| Sidebar | All nav items, active/hover states, collapsed state |
| Knowledge | Article list, editor |

**Dark mode:** validate all the above in dark mode after each phase.

---

## 12. What Copilot / Other Tools Are Working On

The user is using Copilot (GPT-4.5 Codex) in parallel. This plan is designed to be compatible with incremental contributions from any tool.

**Safe areas for parallel work:**
- Any component file that hasn't been touched in Phases 0–2
- Test file creation
- Documentation improvements
- API layer / service files

**Coordinate before touching:**
- `src/components/layout/*` — core layout primitives
- `src/index.css` — token system
- `src/stores/*` — state management
- `src/App.tsx` — routing

**If a conflict occurs:**
- Trust the token system (`--font-*`, `--card-bg`, etc.) as the source of truth
- Trust `PageContainer` / `PageHeader` / `PageCard` as the canonical layout API
- Do not introduce new hardcoded pixel font sizes

---

## 13. Definition of Done

The revamp is complete when:
- [ ] All `/config/*` pages use `PageHeader` + `surface-card` / `PageCard`
- [ ] All `/users/*` pages use `PageHeader` + `PageCard`
- [ ] Sidebar nav uses `--font-label` (14px/500) tokens throughout
- [ ] No `text-[13px]`, `text-[15px]`, `text-[17px]`, `text-[20px]` in config/users/SLA/sidebar
- [ ] No `text-2xl`, `text-xl` in config/users page titles (replaced with token class)
- [ ] No `bg-white dark:bg-gray-800 rounded-lg border border-gray-200` pattern (replaced with `surface-card`)
- [ ] No root-level `px-4 md:px-8` wrappers on any authenticated page
- [x] `NewAgent` and `EditAgent` merged into `AgentForm`
- [ ] SLA `add.tsx` + `edit.tsx` merged into `SlaEditor`
- [ ] At least 3 of the 4 integration setup pages merged into `IntegrationSetupScaffold`
- [x] `DataTable.tsx` deprecated in favor of `Table.tsx`
- [x] `SettingsPage.tsx` removed or fully redirected
- [ ] `npx tsc --noEmit` passes clean
- [ ] Visual QA checkpoints from §11 pass at all widths in light + dark mode
