# SafariDesk — Master Progress Tracker

**This is the one file to check for "where are we."** `AUDIT_TRACKER.md` has the full findings detail, `FIXES_LOG.md` has before/after for every fix, `CLAUDE.md` is the rubric every fix is checked against. This file is the status dashboard across all of it, plus every known not-yet-done item in one place — nothing here is being silently dropped.

**Rubric confirmation:** yes, `CLAUDE.md` is being used — every entry in `FIXES_LOG.md` cites which rule it satisfies, and findings are only reported when they map to a concrete rule or a reproducible failure (the "Review Discipline" section). This file follows the same discipline: nothing gets checked off without a reason.

**Working mode:** incremental, no stop-and-check between steps. I'll keep moving through this list and update checkboxes as I go; flag here only the handful of items that are genuinely your call (marked 🙋 below), everything else I decide and execute.

---

## Phase status

| Phase | Status |
|---|---|
| Audit (architecture ×2, bugs/security ×2, feature inventory, design, infra) | ✅ Done |
| Backend security fixes (all confirmed-live CRITICAL/HIGH) | ✅ Done |
| Backend dead-code cleanup (SLA, Request workflow, middleware, Telegram reconnect) | ✅ Done |
| Frontend bug fixes (token-refresh race, search race, WS leaks) | ✅ Done, type-checked clean |
| **`all.tsx` → proper architecture rewrite** | 🔄 **In progress — see breakdown below** |
| `TasksPage.tsx` (same god-component shape, unaudited) | ⬜ Not started |
| Backend architecture cleanup (god-files, dead app, layering) | ⬜ Not started |
| Frontend hygiene (dead files, duplicate libs, config corruption) | ⬜ Not started |
| Infra hardening (TLS, resource limits, network segmentation, CI) | ⬜ Not started |
| Migration squash | ⬜ Blocked on architecture fixes landing first |
| UI polish (Impeccable) | ⬜ Deferred — yours to drive on looks, I support on bugs |

---

## `all.tsx` rewrite — incremental plan

Target: replace the 4,064-line `all.tsx` with a properly decomposed version built on `TicketsPage.tsx`'s React Query architecture, preserving every feature the catalog found (13 views, token search, bulk actions, inline detail panel w/ 4 tabs, hover preview, Copilot hook, per-ticket action modals, URL sync, real-time invalidation). Each step verified against the running local instance before moving to the next; no feature dropped silently.

- [ ] 1. Data layer: `useTicketsQuery` hook (React Query, queryKey embeds all filters/view/sort/page, `placeholderData` for seamless pagination, invalidate-on-`ticket_event` instead of manual refetch)
- [ ] 2. Filter-option hooks: agents/departments/categories/labels as small cached queries (replacing the ref-based manual-fetch pattern)
- [ ] 3. Search module: debounced server search + the token mini-language (`status:open priority:high` etc.) as its own pure function/hook, unit-testable in isolation
- [ ] 4. View config: the 13 views (+ admin vs agent visibility, legacy `?status=` redirects) as a typed config module
- [ ] 5. Sort state: per-view sort memory as its own small hook
- [ ] 6. Ticket list rendering: `TicketRow`/`TicketTable` components, memoized, replacing inline JSX in the god component
- [ ] 7. Column filter dropdowns: extracted component with the viewport-aware positioning logic
- [ ] 8. Selection + bulk actions: hook for selection state + the `beforeunload`/`useBlocker` guard, archive/delete/restore/export wired through it
- [ ] 9. Inline detail panel: split-view layout component, wiring the existing `TicketActivityStream`/`TicketAttachments`/`TicketTasks`/`SlaInfo` children (these already exist separately, just need clean wiring)
- [ ] 10. Per-ticket action modals: assign/status/priority/department/category/watchers/comment/reopen — wire existing modal components through the new data layer instead of inline state spaghetti
- [ ] 11. Hover preview card: extracted component
- [ ] 12. Copilot integration + URL sync: wire the two remaining cross-cutting behaviors
- [ ] 13. Final swap: point the route at the new file, delete old `all.tsx` and dead `TicketsPage.tsx`, full smoke test against running instance, update `AUDIT_TRACKER.md`/`FIXES_LOG.md`

## `TasksPage.tsx` (3,187 lines) — same treatment, after `all.tsx`
- [ ] Audit for the same race-condition patterns found in `all.tsx` (no debounce, no cancellation — flagged as likely but never checked)
- [ ] Decompose using the same pattern established by the `all.tsx` rewrite

---

## Backend architecture cleanup (not yet started)

- [ ] 🙋 **Tenant isolation: make the default manager scoped, not opt-in.** The big one — `Ticket.objects.filter()`/`.all()` should require a business context by default instead of relying on every call site remembering `.for_business()`. This is a real architectural change (touches `FilterManager` in `shared/models/BaseModel.py`, used by every tenant-scoped model) — flagging for your input since it changes a pattern used everywhere, worth confirming the approach before a sweeping change.
- [ ] No formal RBAC — ties to the Roles & Permissions frontend/backend mismatch below. Needs a real Role/Permission model + DRF `BasePermission` classes.
- [ ] Check old backups/replicas for lingering plaintext Slack/Teams tokens (predates the encryption migration)
- [ ] Insecure `SECRET_KEY`/`DEBUG` defaults in `settings/base.py` (dev/prod override correctly, but it's a landmine)
- [ ] No global rate limiting beyond customer magic-link login — check staff login/password-reset
- [ ] SLA breach-checking cron redundancy: legacy django-cron `RunSLACommand` (runs every 1 min via `os.system`) vs. Celery Beat `check_sla_breaches` — confirm only one is actually scheduled, delete the other
- [ ] Cron jobs shell out via `os.system()` — should be real Celery tasks/management command calls, not subprocess shells
- [ ] Delete the empty `main` Django app
- [ ] `shared/services/channel_ticket_service.py` imports from `tenant` — fix the layering inversion
- [ ] Decompose god-files: `TicketView.py` (4,493 lines), `TicketModel.py` (1,198), `KnowledgeBaseView.py` (1,821), `TaskView.py` (1,657), `AdminView.py` (1,062) — push logic into the service layer
- [ ] `BaseEntity.business` FK is nullable — tighten once tenant-scoping work above lands
- [ ] Thread-local tenant stamping fragile under Celery/async — audit background jobs for rows saved without a current user/business
- [ ] Delete `backend/req.txt` (pasted spec prose, not a requirements file) and `backend/=9.0.0` (stray file)
- [ ] Clean up ~40 dead commented-out MySQL config lines in `dev.py`
- [ ] Clean up duplicate shadowed `add_maintenance`/`link_ticket` method definitions in `AssetViews.py`
- [ ] `CsatWebhookView.py` — add a startup check that refuses to boot if `CSAT_WEBHOOK_SECRET` is unset outside dev
- [ ] Re-enable Twilio webhook signature validation in `TwilioView.py` (currently commented out)
- [ ] 🙋 `DashboardView.py`/`AgentView.py` unscoped class-level querysets (same latent shape as the original `TicketView` finding, not currently live) — decide: harden preemptively everywhere this pattern appears, or only as routes get added? Flagging since it's a standing policy choice, not a one-off fix.

## Frontend hygiene (not yet started)

- [ ] Delete `src/utils/fetchCache.ts` (redundant hand-rolled cache, React Query already configured) once the `all.tsx` rewrite removes its only real usage
- [ ] Fix corrupted `tsconfig.app.json` `include` array (references files outside the project)
- [ ] Reduce the 228 `: any` annotations across 63 files (ongoing, not a single fix)
- [ ] 🙋 Pick one rich-text editor (Quill vs Tiptap) and one chart library (Recharts vs ApexCharts), remove the other — flagging since this is a "which do we keep" call, not purely technical
- [ ] Delete dead `src/utils/axiosConfig.ts`
- [ ] 🙋 Pick one package manager (yarn vs npm) — `yarn.lock`-based `packageManager` field is set but `package-lock.json` is also committed
- [ ] Delete stray `frontend/C:Tempdev_log.txt`, add a gitignore rule to stop it recurring
- [ ] Expand `ui-scale-baseline.json` typography lint beyond its current 5-directory scope, or document it as partial
- [ ] Delete abandoned `AdminCrudPage.tsx` (38-line generic-CRUD attempt, never adopted)

## Feature gaps worth a product decision (not bugs — things that may be intentionally incomplete)

- [ ] Assets page: nav link exists, route commented out in `App.tsx`, backend fully built — this is a quick fix, will do opportunistically
- [ ] Slack ticket-mapping management UI missing (setup works, no UI to manage mappings after)
- [ ] Teams notification-mapping UI missing (same shape as Slack)
- [ ] 🙋 Twilio SMS/WhatsApp: backend fully built, no frontend setup page — worth building the UI, or is this integration not prioritized?
- [ ] Email filtering/blocklist: backend exists, unclear if any UI exposes rule management
- [ ] Agent Copilot: frontend wiring into the ticket UI unconfirmed (partial per inventory)
- [ ] Export jobs: backend exists, frontend trigger point unconfirmed
- [ ] Account/business deletion: backend exists, frontend entry point unconfirmed
- [ ] License enforcement: likely gated banners rather than a dedicated page — unconfirmed
- [ ] 🙋 Platform super-admin console (`SafariAdmin`) has no React frontend — confirm this is intentionally a separate internal tool, not a half-migrated feature
- [ ] Dashboard has no real-time push — confirmed gap, fetch-on-load only despite WebSocket infra existing for everything else

## Infra hardening (audited, nothing implemented yet)

- [ ] No TLS/HTTPS anywhere — needs certbot/ACME or documented external termination
- [ ] No resource limits (`mem_limit`/`cpus`) on any container
- [ ] No network segmentation — `db`/`redis` share a network with internet-facing services
- [ ] `backend/.dockerignore` doesn't exclude `.env*` variants
- [ ] All containers run as root — add non-root `USER` to every Dockerfile
- [ ] `backend/Dockerfile` ships its build toolchain into the production image (frontend already does this right — multi-stage)
- [ ] Delete dead `Procfile` and `supervisor.conf` (confirmed unused — compose already does one-process-per-container correctly)
- [ ] No CI/CD pipeline at all — no lint/test/build gate before deploy
- [ ] `Dockerfile.dev`/`nginx.dev.conf` — wire into a real dev compose file and fix its own stale-hostname bug, or delete
- [ ] Pin/lock `requirements.txt` dependencies (only Django is pinned today); remove `uv` as a listed dependency (it's a tool, not a dep)
- [ ] Add nginx security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS once TLS exists) + gzip

## Planned, blocked on other work

- [ ] Squash Django migrations into one `0001_initial` per app — after the architecture cleanup above lands (squashing before would mean redoing it)
- [ ] `/impeccable` UI polish pass — after all functional/bug work is in; yours to drive on visual direction

---

## 🙋 Items flagged for your input (everything else above, I'm deciding and executing)

1. Tenant isolation default-scoping change — confirm the approach before I touch a pattern used everywhere.
2. `DashboardView.py`/`AgentView.py` latent unscoped-queryset shape — harden everywhere now, or only reactively?
3. Quill vs Tiptap, Recharts vs ApexCharts — which to keep.
4. yarn vs npm as the one package manager.
5. Twilio SMS/WhatsApp — build the missing frontend, or deprioritize?
6. SafariAdmin console — confirm intentionally separate, not abandoned.

Everything else on this page, I'll work through without waiting.
