# Config + Users + SLA — File-by-File Audit

> **Purpose:** Detailed per-file status for the visual revamp. Each entry tracks the current design approach, what needs to change, and migration priority.  
> **Last audited:** April 2026  
> **Legend:** 🔴 High Variance · 🟡 Mixed · 🟢 Stable · ✅ Done

---

## How to Read This Document

| Column | Meaning |
|---|---|
| Status | Overall alignment to the design system |
| Root wrapper | What the outermost `<div>` looks like |
| PageHeader | Whether the standard `<PageHeader>` is used |
| Card surface | Which card surface the page uses |
| Typography | Whether font sizes follow the 12/14/16/18/24 token scale |
| Double-constraint risk | Does the page add its own padding/max-width that conflicts with `PageContainer` |
| Action | What needs to happen in this file |

---

## A. Config Pages (`src/pages/config/` and `src/components/config/`)

### A1. `src/components/config/ConfigLayout.tsx`
| Field | Value |
|---|---|
| **Status** | 🟢 Stable |
| **Exports** | `ConfigLayout` |
| **Root wrapper** | `<section className="w-full bg-[var(--app-bg)]">` |
| **PageHeader** | N/A — layout shell, not a page |
| **Card surface** | None (wrapper only) |
| **Typography** | None — layout only |
| **Double-constraint risk** | None |
| **Action** | None required. Keep as config shell. |

---

### A2. `src/components/config/Gen.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `SettingsComponent` |
| **Root wrapper** | Not fully captured — likely sd-config-content |
| **PageHeader** | ❌ No |
| **Card surface** | `sd-config-card` with `p-5` — partially correct |
| **Typography** | `text-[16px]`, `text-[15px]`, `--font-page-title` (mixed) |
| **Double-constraint risk** | Possible if it uses padding on root |
| **Identified issues** | Monolithic single file — appearance, theme accent, app scale, workspace name all in one component. Typography mix of pixel values and token references. |
| **Action** | 1. Add `<PageHeader>` for "General Settings". 2. Replace pixel font sizes with token classes. 3. Replace any bg-white card divs with `surface-card`. 4. Split into SettingsSection sub-components (post-card-pass). |

---

### A3. `src/components/config/HelpCenter.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `HelpCenter` |
| **Root wrapper** | `<div className="w-full text-sm">` — text-sm base override is a problem |
| **PageHeader** | ❌ No |
| **Card surface** | `Card` component + custom Toggle divs |
| **Typography** | `text-base`, `text-sm`, `text-xs`, `font-medium`, `font-semibold` — none tokenized |
| **Double-constraint risk** | `w-full max-w-full` unusual but not harmful |
| **Action** | 1. Remove `text-sm` from root wrapper. 2. Add `<PageHeader>`. 3. Switch `Card` → `PageCard` + `PageCardHeader`. 4. Replace `text-sm/text-xs/text-base` with token classes. 5. Replace custom Toggle divs with `ui/ToggleSwitch.tsx`. |

---

### A4. `src/components/config/Billing.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `Billing` |
| **Root wrapper** | Not fully read |
| **PageHeader** | ❌ Unknown |
| **Card surface** | Unknown — likely bg-white card grid for packages |
| **Typography** | Unknown |
| **Double-constraint risk** | Unknown |
| **Action** | Full read needed. Apply: `<PageHeader>`, `surface-card` for package cards, typography pass. Keep grid layout for pricing tiers. |

---

### A5. `src/pages/config/csat.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `CsatConfigPage`, `Field` (inline), `Toggle` (inline), `QuestionCard` (inline) |
| **Root wrapper** | `<div className="sd-config-content gap-5">` |
| **PageHeader** | ❌ No |
| **Card surface** | `sd-config-card` — ✅ uses CSS variables correctly |
| **Typography** | `text-[15px]`, `text-[16px]`, `text-[14px]`, `text-[20px]`, `text-[12px]` — all pixel-locked |
| **Double-constraint risk** | None (`sd-config-content` is compatible) |
| **Inline sub-components** | `Toggle`, `Field`, `QuestionCard` — should be extracted to shared files |
| **Action** | 1. Add `<PageHeader title="CSAT Settings">`. 2. Replace all `text-[Npx]` with token classes. 3. Keep `sd-config-card` (acceptable). 4. Extract `Toggle` → use `ui/ToggleSwitch.tsx`. 5. Consider extracting `QuestionCard` → `SettingsSectionCard`. |

---

### A6. `src/pages/config/integrations.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `IntegrationsPage` (config version — different from `pages/IntegrationsPage.tsx`) |
| **Root wrapper** | `<div className="sd-config-content gap-4">` |
| **PageHeader** | ❌ No |
| **Card surface** | `bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle` |
| **Typography** | `text-[20px]`, `text-[15px]`, `text-[17px]` — all pixel-locked |
| **Double-constraint risk** | None |
| **Caution** | This file (`pages/config/integrations.tsx`) overlaps with `pages/IntegrationsPage.tsx`. Likely the config-scoped version. Verify routing — one may be dead. |
| **Action** | 1. Add `<PageHeader>`. 2. Replace bg-white card divs with `surface-card`. 3. Replace pixel font sizes with tokens. 4. Clarify which integrations page is canonical. |

---

### A7. `src/pages/config/slack-setup.tsx` 🔴
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `SlackSetupPage` |
| **Root wrapper** | `<div className="min-h-[80vh] flex">` — two-column split layout |
| **PageHeader** | ❌ No |
| **Card surface** | `bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700` |
| **Typography** | `text-sm`, `text-lg`, `text-2xl`, `text-xs` — Tailwind utilities, not tokens |
| **Layout** | Left: `w-72` step sidebar. Right: `flex-1 p-8` content area |
| **Duplicate** | **D7 — identical structure to Teams, Telegram, SMS setups** |
| **Action** | Create `IntegrationSetupScaffold` component with provider config. Migrate all 4 setup pages to it. |

### A8. `src/pages/config/teams-setup.tsx` 🔴
*(Identical findings to A7 — D7 duplicate)*

### A9. `src/pages/config/telegram-setup.tsx` 🔴
*(Identical findings to A7 — D7 duplicate)*

### A10. `src/pages/config/safari-sms-setup.tsx` 🔴
*(Identical findings to A7 — D7 duplicate, longest file)*

---

## B. Settings Components (used by `/config/*`)

### B1. `src/components/settings/GeneralSettings.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `GeneralSettings` |
| **Root wrapper** | `<div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6">` — the whole component IS a card |
| **PageHeader** | N/A — sub-component (card inside a page) |
| **Card surface** | bg-white card (root is the card) |
| **Typography** | `text-lg font-semibold`, `text-sm font-medium`, `text-sm` body — not tokenized |
| **Action** | Replace root with `PageCard`. Replace `text-lg` heading with `text-section-title`. Replace `text-sm` body with `text-body`. |

---

### B2. `src/components/settings/Settings.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `Settings` |
| **Root wrapper** | `<div className="text-sm px-4 md:px-8 py-4 flex justify-center">` — **VIOLATION: root-level px-4/py-4** |
| **PageHeader** | ❌ No |
| **Card surface** | `bg-white dark:bg-gray-800 rounded-lg border border-gray-200 p-6` |
| **Typography** | `text-sm` base, `font-semibold`, `text-gray-*` color refs |
| **Double-constraint risk** | ✅ **YES — px-4 md:px-8 + flex justify-center conflicts with global PageContainer** |
| **Action** | 1. Remove root `px-4 md:px-8 py-4 flex justify-center`. 2. Add `<PageHeader>`. 3. Switch cards to `surface-card`. 4. Token-ize typography. |

---

### B3. `src/components/settings/BusinessSettings.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `BusinessSettings` |
| **Root wrapper** | Unknown — simple form |
| **Card surface** | Likely similar to GeneralSettings |
| **Action** | Apply same pass as GeneralSettings: PageCard, token typography. Likely candidate to merge with Gen.tsx section (D4). |

---

### B4. `src/components/settings/EmailSettings.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `EmailSettings` |
| **Root wrapper** | Unknown — tabbed layout |
| **Card surface** | Mixed — tabbed config surface |
| **Typography** | Mixed pixel + Tailwind utilities |
| **Duplicate** | **D5 — overlaps with MailIntegrations, Emails, SmtpSettings, etc.** |
| **Action** | Part of Phase C (email integration consolidation). Card/typography pass can happen earlier. |

---

### B5. `src/components/settings/MailIntegrations.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `MailIntegrations` |
| **Duplicate** | **D5** |
| **Action** | Phase C — consolidate with Drawer, Wizard, UpdateEmailModal, ValidateCredentialsModal. |

### B6–B10. `MailIntegrationDrawer`, `MailIntegrationWizard`, `UpdateEmailModal`, `ValidateCredentialsModal`, `SmtpSettings`
All are **D5 duplicates** — Phase C consolidation target. In the meantime, apply typography token pass.

---

### B11. `src/components/settings/Departments.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `DepartmentsPage` |
| **Pattern** | CRUD list + filter + modal — **D3 duplicate** |
| **Action** | Phase B — `AdminCrudPage` scaffold target. First apply PageHeader + PageCard + typography pass. |

### B12. `src/components/settings/TicketCategories.tsx`
*(Same as B11 — D3 duplicate, CRUD pattern)*

### B13. `src/components/settings/LabelsSettings.tsx`
*(Same as B11 — D3 duplicate, CRUD pattern)*

### B14. `src/components/settings/TaskSettingsModal.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Duplicate** | **D8** — overlaps with TicketSettingsModal |
| **Action** | Extract `ModalSectionCard` + `ModalFooter` atoms shared with TicketSettingsModal. |

### B15. `src/components/settings/TicketSettingsModal.tsx`
*(Same as B14 — D8 duplicate)*

---

## C. Users Pages (`src/pages/users/`)

### C1. `src/pages/users/Agents.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `AgentsPage` |
| **Root wrapper** | Unknown — likely local px/py wrapper |
| **PageHeader** | ❌ No |
| **Card surface** | Table + local wrappers — no PageCard |
| **Typography** | Mixed local utilities |
| **Duplicate** | **D3** — CRUD pattern, **D9** — AgentForm duplication |
| **Action** | 1. Add `<PageHeader title="Agents" actions={<Button>Add Agent</Button>}>`. 2. Wrap table area in `PageCard`. 3. Typography pass. 4. Merge NewAgent + EditAgent (D9). |

---

### C2. `src/pages/users/Customers.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `ContactPage` |
| **Root wrapper** | Unknown |
| **PageHeader** | ❌ No |
| **Card surface** | Unknown |
| **Duplicate** | **D3** — CRUD pattern |
| **Action** | Same as Agents: PageHeader + PageCard + typography pass. |

---

### C3. `src/pages/users/Roles.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `RolesPage` |
| **PageHeader** | ❌ No |
| **Card surface** | Uses `Card`, `CardContent`, `CardHeader`, `CardTitle` from ui/Card — ✅ good |
| **Typography** | Unknown |
| **Duplicate** | **D3** |
| **Action** | 1. Add `<PageHeader>`. 2. Upgrade `Card` usages to `PageCard` where appropriate. 3. Typography pass. |

---

### C4. `src/pages/users/Profile.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `Switch` (local), `StatCard` (local), `Profile` (default) |
| **PageHeader** | ❌ No |
| **Card surface** | `Card` component, `bg-white`, custom |
| **Typography** | `text-sm`, `font-medium`, `text-[var(--text-secondary)]` mixed |
| **Duplicate** | **D10** — local Switch conflicts with `ui/ToggleSwitch.tsx`; local StatCard duplicates dashboard's |
| **Action** | 1. Add `<PageHeader>`. 2. Remove local `Switch` → use `ui/ToggleSwitch.tsx`. 3. Remove local `StatCard` → use shared one. 4. Typography pass. |

---

### C5. `src/pages/users/SecurityTab.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `SecurityTab` |
| **PageHeader** | N/A — sub-tab, not a page |
| **Card surface** | `Card` component |
| **Action** | Typography pass. Switch `Card` → `PageCard` for consistency. |

---

### C6. `src/pages/users/mini/NewAgent.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `AgentForm` |
| **Root wrapper** | `<div className="space-y-4">` |
| **Card surface** | None |
| **Typography** | `text-sm font-medium` labels |
| **Duplicate** | **D9** — near-identical to EditAgent.tsx |
| **Action** | **Merge with EditAgent.tsx into `AgentForm.tsx` with `mode` prop.** |

---

### C7. `src/pages/users/mini/EditAgent.tsx`
*(D9 duplicate of NewAgent — see C6)*

---

### C8. `src/pages/Users.tsx`
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `Users` (default) |
| **Root wrapper** | `<Routes>` — router only, no wrapper div |
| **PageHeader** | N/A — just routes |
| **Double-constraint risk** | Previously used `sd-content-shell` — now neutralized |
| **Action** | Check if `sd-content-shell` was removed after neutralization. No structural change needed. |

---

## D. SLA Pages (`src/pages/sla/`)

### D1. `src/pages/sla/main.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `SlaPage` |
| **Root wrapper** | `<div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-sm px-4 md:px-8 py-4 flex justify-center">` |
| **PageHeader** | ❌ No |
| **Card surface** | `bg-gray-50 rounded-lg p-4`, `bg-blue-50 border border-blue-200 rounded-lg` — custom per section |
| **Typography** | `text-sm` base on root (conflict), `text-gray-*` color refs |
| **Double-constraint risk** | ✅ **YES — min-h-screen, px-4 md:px-8, flex justify-center all violate the container contract** |
| **Action** | 1. Remove entire root wrapper. 2. Use `<div className="sd-page-stack">`. 3. Add `<PageHeader title="SLA Policies">`. 4. Replace ad hoc info boxes with `PageCard`. 5. Typography pass. |

---

### D2. `src/pages/sla/add.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `AddSLAPolicyPage` |
| **Duplicate** | **D6** — heavily overlaps with edit.tsx |
| **Action** | Merge into `SlaEditor mode="create"` — Phase 4. In interim: card + typography pass. |

---

### D3. `src/pages/sla/edit.tsx`
*(D6 duplicate of add.tsx — see D2)*

---

### D4. `src/pages/sla/mini/PolicyForm.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Exports** | `Stepper`, `PolicyForm` |
| **Root wrapper** | `<div className="space-y-4">` |
| **Typography** | `text-sm font-medium` |
| **Duplicate** | Custom `Stepper` duplicates `ui/Stepper.tsx` |
| **Action** | Replace custom `Stepper` with `ui/Stepper.tsx`. Card pass on form sections. |

---

### D5. `src/pages/sla/mini/BusinessHoursComponent.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Duplicate** | **D6** — 3 business-hours surfaces exist |
| **Action** | Consolidate with `BusinessHoursForm.tsx` + `BusinessHoursInline.tsx` into one component with display/edit modes. |

### D6. `src/pages/sla/mini/BusinessHoursForm.tsx`
*(D6 duplicate — see D5)*

### D7. `src/pages/sla/mini/BusinessHoursInline.tsx`
*(D6 duplicate — see D5)*

### D8. `src/pages/sla/mini/HolidayComponent.tsx`
*(D6 duplicate — overlaps with HolidayForm.tsx)*

### D9. `src/pages/sla/mini/HolidayForm.tsx`
*(D6 duplicate — see D8)*

### D10. `src/pages/sla/mini/PoliciesComponent.tsx`
| Field | Value |
|---|---|
| **Status** | 🔴 High Variance |
| **Action** | Card pass + typography pass after SlaPage wrapper fix. |

---

## E. Layout & Sidebar

### E1. `src/components/layout/Header.tsx` (Sidebar)
| Field | Value |
|---|---|
| **Status** | 🟡 Mixed |
| **Exports** | `Header` |
| **Nav items** | Dashboard, Tickets, Tasks, Knowledge Base, Users (Agents, Contacts, Roles), Config (General, SLA, CSAT, Emails, Billing, Departments, Categories, Labels, Help Center, Domain, Integrations) |
| **Typography issues** | Flyout/what's-new drawer uses `text-xl`, `text-[16px]`, `text-[14px]`, `text-xs` — not tokenized |
| **Nav item scale** | Needs to be `text-[length:var(--font-label)]` = 14px/500 |
| **Sub-item scale** | Needs to be `text-[length:var(--font-meta)]` = 12px/400 |
| **Action** | Typography-only pass. No structural changes. Replace local size classes with token references. |

---

## F. Shared UI Primitives Status

| File | Status | Notes |
|---|---|---|
| `ui/Button.tsx` | 🟢 Stable | Tokenized, adopt everywhere |
| `ui/Input.tsx` | 🟢 Stable | Uses `--shell-radius`, `--text-primary` — good |
| `ui/Select.tsx` | 🟢 Stable | Use instead of raw selects |
| `ui/Modal.tsx` | 🟡 Mixed | Exists but not uniformly adopted |
| `ui/Drawer.tsx` | 🟡 Mixed | Exists but email integration uses bespoke drawers |
| `ui/Table.tsx` | 🟡 Mixed | 15px typography — needs 14px token alignment |
| `ui/DataTable.tsx` | 🔴 High Variance | **D11** — deprecated in favor of Table.tsx |
| `ui/Card.tsx` | 🟡 Mixed | Underused; `PageCard` now the preferred card |
| `ui/ToggleSwitch.tsx` | 🟢 Stable | Exists — Profile.tsx should use this instead of local Switch |
| `ui/Stepper.tsx` | 🟢 Stable | Exists — SLA PolicyForm.tsx should use this |
| `ui/Badge.tsx` | 🟢 Stable | Use for status labels |
| `ui/EmptyState.tsx` | 🟢 Stable | Use for empty list states |

---

## Summary: Priority Action Matrix

| Priority | File | Action |
|---|---|---|
| 🔴 P1 | `settings/Settings.tsx` | Remove root `px-4 md:px-8 py-4` (active contract violation) |
| 🔴 P1 | `sla/main.tsx` | Remove `min-h-screen px-4 md:px-8 py-4 flex justify-center` |
| 🔴 P1 | `users/mini/NewAgent.tsx` + `EditAgent.tsx` | Merge into `AgentForm` (D9) |
| 🟡 P2 | `config/Gen.tsx` | PageHeader + surface-card + typography |
| 🟡 P2 | `users/Agents.tsx` | PageHeader + PageCard + typography |
| 🟡 P2 | `users/Customers.tsx` | PageHeader + PageCard + typography |
| 🟡 P2 | `users/Roles.tsx` | PageHeader + typography |
| 🟡 P2 | `users/Profile.tsx` | Remove local Switch/StatCard, PageHeader |
| 🟡 P2 | `layout/Header.tsx` | Typography token pass (sidebar nav) |
| 🟡 P2 | `sla/main.tsx` (post P1) | PageHeader + PageCard for sections |
| 🟢 P3 | `config/csat.tsx` | Typography token pass (card surface OK) |
| 🟢 P3 | `config/HelpCenter.tsx` | Remove text-sm root, PageHeader, PageCard |
| 🟢 P3 | `config/integrations.tsx` | surface-card + typography |
| 🔴 P3 | `config/slack-setup.tsx` | `IntegrationSetupScaffold` (D7) |
| 🔴 P3 | `config/teams-setup.tsx` | `IntegrationSetupScaffold` (D7) |
| 🔴 P3 | `config/telegram-setup.tsx` | `IntegrationSetupScaffold` (D7) |
| 🔴 P3 | `config/safari-sms-setup.tsx` | `IntegrationSetupScaffold` (D7) |
| 🔴 P4 | D5 email cluster (10 files) | Phase C consolidation |
