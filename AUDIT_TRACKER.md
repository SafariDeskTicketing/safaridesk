# SafariDesk Audit & Rebuild Tracker

Generated from architecture audits of `backend/` and `frontend/`, plus a full feature inventory. Use this to track the pass-by-pass rebuild: **Architecture → Bugs/Security → Performance → UI Polish (Impeccable)**.

---

## 🔴 Top-priority risk items (address in Bugs/Security pass)

- [ ] **Tenant isolation is opt-in, not enforced.** `Ticket.objects.filter()`/`.all()` returns rows across ALL tenants unless a view explicitly calls `.for_business()`/`.for_user()`/`.for_me()`. `tenant/views/TicketView.py` is 4,493 lines — huge surface area for a call site to forget scoping and leak cross-tenant data. **Fix: make the default manager scoped, not opt-in.**
- [ ] **No formal RBAC.** `pages/users/Roles.tsx` implies granular permission management, but no Role/Permission model or DRF `BasePermission` classes exist backend-wide — enforcement is informal role-string checks scattered across views. Frontend is ahead of backend here.
- [x] ✅ **RESOLVED (and corrected)** — ~~Two competing tenant-resolution middlewares~~. Re-checked directly: `DomainMiddleware` had **zero references anywhere**, not even in the files the original audit cited as using it — that claim was a substring-grep false positive (`DomainMiddleware` matches inside `CustomDomainMiddleware`). Deleted `shared/middleware/DomainMiddleware.py` outright. `CustomDomainMiddleware` was always the only real one.
- [ ] **Slack/Teams tokens were originally stored in plaintext**, retrofitted with encryption in migration `0019_encrypt_slack_teams_tokens.py`. Check old backups/replicas for lingering plaintext.
- [ ] **Insecure defaults at settings base**: `base.py` hardcodes `SECRET_KEY = "django-insecure-..."` and `DEBUG = True`. dev/prod override correctly, but it's a landmine for any future settings module.
- [ ] **No global rate limiting.** Only customer magic-link login has cache-counter rate limiting. Staff login/password-reset endpoints should be checked.
- [ ] **SLA breach checking may be silently non-functional.** `shared/cron.py` comment claims it moved to celery-beat, but no SLA-breach task exists in `celery.py`'s `beat_schedule`, and the django-cron equivalent is commented out. The only active SLA cron just shells out to `manage.py sla` every minute.
- [ ] Cron jobs use `os.system("python3 manage.py ...")` — fragile, no error observability, should be real Celery tasks.

---

## 🟡 Architecture cleanup items (Architecture pass)

**Backend**
- [ ] `main` Django app is dead weight — empty, should be removed.
- [ ] `shared/services/channel_ticket_service.py` imports from `tenant` — inverts intended layering (shared should not depend on tenant).
- [ ] God-files: `TicketView.py` (4,493 lines), `TicketModel.py` (1,198 lines), `KnowledgeBaseView.py` (1,821), `TaskView.py` (1,657), `AdminView.py` (1,062) — logic should be pushed into the service layer consistently.
- [ ] `BaseEntity.business` FK is nullable — tenant anchor field shouldn't silently allow tenant-less rows.
- [ ] Thread-local tenant stamping (`get_current_user()`) is fragile under Celery/async contexts.
- [ ] Naming inconsistency: PascalCase model/service files vs newer snake_case files — confirms isolated/vibecoded additions over time.
- [ ] `backend/req.txt` isn't a requirements file — it's pasted product spec prose. Delete/rename.
- [ ] `backend/=9.0.0` — stray 0-byte file from an unquoted `pip install 'pkg>=9.0.0'`. Delete.
- [ ] `dev.py` has ~40 lines of dead commented-out MySQL config.

**Frontend**
- [ ] Two competing ticket-list implementations: `TicketsPage.tsx` (563 lines, clean, React Query) vs `all.tsx` (4,064 lines, raw useState/useEffect, hand-rolled cache). Pick one.
- [ ] `TasksPage.tsx` is a 3,187-line god component (fetch + state + render all mixed).
- [ ] Triple caching: TanStack Query configured but only used in ~15/364 files; `src/utils/fetchCache.ts` is a redundant hand-rolled cache on top.
- [ ] `tsconfig.app.json`'s `include` array references files outside the project (`../CloseTicketModal.tsx`, `../OT/NotificationsPage copy.tsx`) — corrupted config from vibecoded edits.
- [ ] 228 `: any` annotations across 63 files despite `strict: true`.
- [ ] Duplicate libraries: Quill + Tiptap both installed for rich text; Recharts + ApexCharts both installed for charts. Pick one of each.
- [ ] `src/utils/axiosConfig.ts` is dead/deprecated — delete.
- [ ] `yarn.lock`-based `packageManager` pinned, but `package-lock.json` (npm) also committed — pick one package manager.
- [ ] `frontend/C:Tempdev_log.txt` — stray AI-tool artifact from an unescaped Windows path. Delete, add to `.gitignore`.
- [ ] `ui-scale-baseline.json` typography lint is real but only covers 5 of many directories — expand or document as partial.
- [ ] Dead code: `RequestsPage` and its components still exist despite being removed from nav.
- [ ] `AdminCrudPage.tsx` (38 lines) — abandoned generic-CRUD abstraction, never adopted.

---

## Feature Inventory

### Ticketing Core
- [ ] Ticket list/queue — frontend: `pages/ticket/all.tsx`, `ticket/TicketsPage.tsx` — backend: `TicketModel.py`, `TicketView.py` — **complete** (but duplicated, see above)
- [ ] Ticket detail/view — frontend: `pages/ticket/mini/ViewTicket.tsx` — backend: `TicketView.py` — complete
- [ ] Ticket create — frontend: `pages/ticket/create.tsx` — backend: `TicketView.py` — complete
- [ ] Ticket duplicate detection — backend only, not surfaced as distinct UI — partial
- [ ] Contacts/requesters linking — complete
- [ ] Labels/tags — complete
- [ ] **Assets — nav link exists, route is commented out in `App.tsx`. Backend fully built. BROKEN — quick fix.**
- [ ] Departments — complete
- [ ] Request workflow — **deprecated/orphaned**, backend + old frontend page still exist despite "REMOVED" from nav

### Tasks
- [ ] Task list/detail — complete

### SLA & Automation
- [ ] SLA policy list/add/edit — complete
- [ ] SLA breach tracking — **partial, possibly non-functional** (see risk items above)

### Slack / Teams / Telegram Integration
- [ ] Slack OAuth connect — complete
- [ ] Slack ticket mapping / auto-join — partial (no management UI for mappings)
- [ ] Slack token encryption — complete
- [ ] Teams connect — complete
- [ ] Teams notifications/sync — partial (no mapping UI)
- [ ] Teams token encryption — complete
- [ ] Telegram connect — complete

### SMS / WhatsApp
- [ ] Safari SMS setup — complete
- [ ] **Twilio SMS — backend-only, missing frontend setup page**
- [ ] **Twilio WhatsApp — backend-only, missing frontend setup page**

### Email/Channel Ingestion
- [ ] Mail integration setup — complete
- [ ] Email-to-ticket ingestion — complete (cron-driven, see fragility note)
- [ ] Email filtering/blocklist — partial, unclear if UI exposes rule management
- [ ] Mailgun inbound webhook — complete

### Chatbot / AI Copilot
- [ ] Customer-facing chatbot — complete (WebSocket-backed)
- [ ] Agent copilot (AI replies) — partial, frontend wiring unconfirmed
- [ ] AI usage tracking — backend-only (billing metric, not a gap)
- [ ] KB embeddings generation — complete

### Knowledge Base / Customer Portal
- [ ] Internal KB management — complete
- [ ] Public/customer KB — complete
- [ ] KB config — complete
- [ ] Customer self-service portal — complete
- [ ] Customer ticket submission — complete
- [ ] CSAT survey — complete

### Notifications
- [ ] In-app notifications — complete (real-time via Channels)
- [ ] Notification preferences — complete
- [ ] Multi-channel dispatch (email/SMS/Slack/Teams) — backend-only, by design

### Reporting & Exports
- [ ] Reports (tickets/tasks/agents) — complete
- [ ] Export jobs — partial, confirm frontend trigger exists
- [ ] Dashboard analytics/graphs — complete, **but no live-push (see Infrastructure gap below)**

### User Management & Auth
- [ ] Login/register/password flows — complete
- [ ] OTP/TOTP MFA — complete
- [ ] Agents/Users management — complete
- [ ] Customers management — complete
- [ ] **Roles & Permissions — frontend implies granular RBAC, backend enforcement is informal (see risk items)**
- [ ] Audit logs (tenant-level) — complete
- [ ] Profile/security settings — complete
- [ ] Business/tenant onboarding — complete (WS-driven live progress)
- [ ] Account/business deletion — partial, confirm UI entry point
- [ ] Custom domains — complete

### Billing & Licensing
- [ ] Billing page — complete
- [ ] License enforcement — partial, likely gated banners rather than a page

### Admin
- [ ] Platform super-admin console — backend-only, no React frontend (likely intentional separate tool — confirm)

---

## Internal / Infrastructure (non-user-facing)

- [ ] JWT auth + token revocation — complete
- [ ] **Role/permission enforcement — GAP, informal role-string checks only**
- [ ] Session/domain middleware — complete (but see dual-middleware risk item)
- [ ] **Rate limiting — partial, only on customer magic-link login**
- [ ] Caching layer — complete but informally used, invalidation strategy unverified
- [ ] Scheduled/background jobs (Celery Beat) — complete: deletion purges, inactive-business reports
- [ ] Legacy cron jobs (django-cron) — complete but fragile (shells out via `os.system`)
- [ ] Management commands (ops tooling) — complete
- [ ] **Real-time/WebSocket infrastructure — complete for notifications, chat, onboarding, ticket activity. GAP: no live push for dashboard — it's fetch-on-load only.**
- [ ] Token encryption at rest (Slack/Teams) — complete, recent hardening (verify key rotation strategy)
- [ ] Audit trail (platform-level, SafariAdmin) — backend-only, consistent with admin console being separate
- [ ] Email/webhook ingestion workers — complete, shares cron fragility

---

## 🔥 CONFIRMED EXPLOITABLE — backend bug/security audit (do not ship until fixed)

**CRITICAL — pre-auth or cross-tenant, trivially exploitable by guessing a numeric id**
1. ✅ **FIXED** — ~~Unauthenticated cross-tenant ticket comment injection~~ — `tenant/views/TicketView.py:631-633,3077-3104`. See `FIXES_LOG.md` #1.
2. ✅ **FIXED** — ~~Unauthenticated cross-tenant data leak (`loadAttachments`)~~ — `TicketView.py:884-908`. See `FIXES_LOG.md` #2.
3. ✅ **FIXED (defense-in-depth)** — ~~IDOR on the main `TicketView` ModelViewSet~~ — `TicketView.py:626-627`. **Correction after verifying routes: not actually reachable via any current URL** (no router/pk-path wires to the default actions), but hardened anyway since the next route added without scoping in mind would be immediately exploitable. See `FIXES_LOG.md` #4.
4. ✅ **FIXED** — ~~Debug endpoint exfiltrates real ticket data to a hardcoded external email~~ — `tenant/views/SettingView.py` (`TemplateTest`), routed at `tenant/routes/setting.py:26`. View and route deleted entirely. See `FIXES_LOG.md` #5.

**HIGH**
5. ✅ **FIXED** — ~~Staff/superuser notification bypass~~ — `NotificationView.py:35-40`. See `FIXES_LOG.md` #6.
6. ✅ **FIXED** — ~~Crash on unauthenticated `loadActivityStream`~~ — resolved as a side effect of fix #1/#2 (DRF now rejects unauthenticated requests before the view runs). See `FIXES_LOG.md` #3.
7. `SettingView.py:55` `Ticket.objects.get(id=2)` crash risk — resolved along with fix #4 (the whole view was deleted).

**MEDIUM**
8. ✅ **RESOLVED (and corrected)** — ~~`SlaView.py` scoping gap~~. Follow-up read found a much bigger unscoped-queryset pattern than originally flagged (every Detail view, plus a conditional-filter bug in Holiday) — all fixed, then discovered the whole file was dead (see Cleanup batch in `FIXES_LOG.md`). **Decision made and executed: deleted `SlaView.py`/`routes/sla.py`, and root-cause-fixed `PublicView.create()`'s SLA assignment to use the live new system instead** — it was the one place still writing to the dead old system. Tracker/escalation functionality isn't actually missing; it's handled by the new system's `SLAViolation`/`SLAEscalations` models, just implemented differently (violations recorded, not a live pause/resume timer).
9. `cron.py` shells out via `os.system()` for email/SLA sync — no error propagation, subprocess failures swallowed silently. Likely root cause of the "SLA breach checking may be non-functional" finding from the architecture pass.

No raw SQL injection found; `util/security/encryption.py` is sound (no hardcoded key/weak fallback, raises `ImproperlyConfigured` if unset).

**Fix priority for the bug/security pass: #1–#4 first (pre-auth, trivial to exploit), then #3's pattern check across the rest of the app.**

**✅ Full sweep completed (batch 3) — see `FIXES_LOG.md` for detail. Fixed and verified:**
- Unauthenticated cross-tenant ticket creation via `PublicView.create()` (category/department lookups ran fully unscoped when no business resolved).
- Unauthenticated cross-tenant KB category tree leak (`KBCategoryViewSet.tree()`).
- Cross-tenant department mismatch in `PublicView.new_request()`.
- Cross-tenant task-comment like/flag/reply (`TaskView.py`), including a cross-tenant write via `reply_to_comment`.
- Cross-tenant asset-user/asset-ticket linking (`AssetViews.py` `assign_user`/`link_ticket`).
- Fail-open payment data leak when a user has no business set (`PaymentView.py`).

**New tracked items from the sweep (not security fixes, decisions/cleanup needed):**
- [ ] `AssetViews.py` has duplicate `add_maintenance`/`link_ticket` method definitions in the same class — the first copy of each is silently shadowed (dead Python), not exploitable, just confusing leftover code. Clean up in the next hygiene pass.
- [ ] `CsatWebhookView.py` — if `CSAT_WEBHOOK_SECRET` is ever left unset, the secret check is skipped entirely, allowing unauthenticated CSAT mutation by guessable `ticket_id`. Config-dependent risk, not a code bug per se — worth a startup check that refuses to boot if the secret is unset in a non-dev environment.
- [ ] `shared/views/TwilioView.py` — Twilio webhook signature validation is commented out. Needs re-enabling once Twilio webhook signing is configured.
- [ ] `tenant/views/DashboardView.py` (`DashView`) and `tenant/views/AgentView.py` — same "unscoped class-level `queryset`, no route currently exposes the vulnerable default action" shape as the original `TicketView` finding. Latent, not live. Same defense-in-depth tradeoff — not hardened in this batch, flagged for a decision on whether to preemptively fix every instance of this shape found across the app or only as routes get added.
- [x] ✅ **RESOLVED** — `tenant/views/RequestsView.py`/`RequestActionsView.py`/`routes/req.py` and `tenant/routes/pay.py` deleted (confirmed intentionally-retired dead code / broken-import dead code respectively). `shared/views/TelegramView.py` **reconnected, not deleted** — it was a complete, correctly-scoped, fully-frontend-wired integration missing only its `urls.py` include line. See `FIXES_LOG.md` cleanup batch for full detail on all four.

---

## 🔥 Frontend bug/performance audit — confirmed findings

**HIGH — real bugs**
1. **Token-refresh race causes spurious logouts** — `src/services/http.ts:118-157`. No single-flight refresh; N concurrent 401s each call refresh independently. If the backend rotates refresh tokens, only the first succeeds and the rest log out a still-valid session.
2. **Search/filter race, no request cancellation** — `src/pages/ticket/all.tsx:1297-1368`/`1414`/`1518-1521`. No debounce, no `AbortController`. Typing "abc" fires 3 overlapping GETs; a late-arriving stale response can overwrite the correct current results.
3. **Notification WebSocket ping-interval leak** — `src/hooks/useNotificationWebSocket.ts:69-75`. Self-clearing logic checks the wrong (new) socket after reconnect; old intervals never clear. Compounds on every reconnect (up to 5x), never torn down on unmount.
4. **Notification WebSocket outlives unmount** — `useNotificationWebSocket.ts:103-116,155-162`. Unmount's `ws.current.close()` triggers `onclose`, which schedules a *new* reconnect that the cleanup never cancels — orphaned socket keeps reconnecting for a component that no longer exists.

**MEDIUM — real perf/UX impact**
5. **CONFIRMED (not ambiguous): `all.tsx` is the only live ticket-list implementation.** `TicketsPage.tsx` and `archive/TicketsPage.tsx` have zero imports anywhere in `src/` — fully dead, safe to delete outright.
6. Heavy Tiptap editor bundle loads as soon as the Tickets page opens (not code-split behind the "New Ticket" modal) — `all.tsx` → `CreateTicketModal.tsx` → `SafariDeskEditor` all statically imported into the one lazy-loaded route chunk.
7. No memoization or virtualization on ticket rows in `all.tsx` — not urgent at the default page size (10), but `limit` is user-configurable via localStorage with no visible upper bound, so a user who raised it gets full non-memoized re-renders on any state change.
8. Redundant double filtering — server already filters by `search`, then `all.tsx:597-612` re-filters client-side with different matching logic than the server, so visible rows can mismatch `totalCount`.
9. **`fetchCache.ts`'s global cache is never invalidated on logout/user switch** — stale ticket data from a previous user can be served on a shared machine before revalidation. Data-leak-adjacent, not just a perf issue.

Not yet audited: `TasksPage.tsx` line-by-line (likely has the same race-condition patterns as `all.tsx`, same team/era — worth the same check next).

---

## 🎨 Impeccable design/UX audit (static pass — code-only, no rendered app)

**Score: 10/20 ("Needs Work")** — A11y 2/4, Performance 2/4, Theming 3/4, Responsive 2/4, Implementation Integrity 1/4.

**Verdict: AI-slop signals present.** Two parallel styling systems coexist — `src/components/ui/` primitives are correctly token-based, but pages bypass them: 76 ad-hoc `bg-white rounded-* shadow-*` divs vs. only 4 files actually importing `<Card>`. Design system exists but isn't the default path.

**P0**
- `Input.tsx`/`Label.tsx` — plain `<label>` has no `htmlFor`, fails WCAG 1.3.1/4.1.2 on any form built on this primitive. → `/impeccable harden`

**P1**
- Zero `prefers-reduced-motion` handling anywhere despite real animated UI (modals, toasts, slide-ins). → `/impeccable animate`
- `--text-muted: #a4ada5` on white — est. ~2:1 contrast, well under WCAG AA 4.5:1, used broadly (unverified, needs rendered check). → `/impeccable harden`
- 88 `<img>` tags, 0 using `loading="lazy"`. → `/impeccable optimize`
- `Button.tsx` sizes (34/38/42px) all below the 44px touch-target minimum, used in 748 places app-wide. → `/impeccable layout`

**P2**
- Typography lint (`ui-scale-baseline.json`) covers only 5 of 40+ directories; **no spacing lint exists anywhere** — same root cause as the architecture audit's finding, confirmed to extend to styling generally.
- 441 raw hex codes bypass the HSL token system (mostly charts, but risks light/dark mismatches wherever it's UI chrome).
- Only 42% of `.tsx` files use any responsive prefix; 77 hardcoded `w-[Npx]` instances.

**P3**
- 429 inline `style={{...}}` objects, concentrated in the editor and KB pages — bypasses both Tailwind and tokens.
- 23 `<div onClick>` without `role`/`tabIndex` (small relative to 1,127 total onClick handlers, which mostly use real `<button>`).

**Positive**: token architecture is well-structured and semantic (not raw aliases); dark mode genuinely broad (175 files) and implemented consistently; native `<button>` dominates over clickable divs.

**Caveat (agent's own flag, worth taking seriously): A11y and Responsive scores are the least reliable of the five** — this was static code inspection, no rendered app, no real contrast measurement, no real breakpoint testing. A browser-based `/impeccable audit` with the dev server running is the real follow-up before trusting these two scores.

**Recommended order**: `/impeccable harden` → `/impeccable animate` → `/impeccable optimize` → `/impeccable layout` → `/impeccable distill` → `/impeccable colorize` → `/impeccable polish`. All of this belongs in the UI-polish pass (step 4), after architecture + bug/security fixes land — fixing `Input`/`Label` association or touch targets now would just get re-touched once the ticket-list consolidation (`all.tsx` vs dead `TicketsPage.tsx`) happens.

---

## 🏗️ Infra/deployment audit

**CRITICAL**
- [ ] **No TLS/HTTPS anywhere** — `deploy/nginx/*.conf` only `listen 80`, no certbot/ACME, no 443 blocks. Not "terminated upstream by design" — just missing.
- [ ] **No resource limits on any container** — no `mem_limit`/`cpus` anywhere. A runaway worker or query storm can OOM the whole host, taking down every service including the DB.
- [ ] **No network segmentation** — every service, including `db`/`redis`, sits on one default bridge network alongside internet-facing `nginx`/`frontend`. A compromised nginx/frontend has direct network reach to Postgres/Redis.
- [ ] **`backend/.dockerignore` doesn't exclude `.env*`** — latent risk: `COPY . /app/` would bake a `.env` into an image layer the first time anyone drops one in `backend/` before building. Nothing leaking today, but the gap is real.

**HIGH**
- [ ] **All backend/frontend containers run as root** — no `USER` directive in any of the 4 Dockerfiles.
- [ ] **`backend/Dockerfile` is single-stage** — build toolchain (`build-essential`, `-dev` libs) ships in the production image, unlike the frontend which already does this correctly.
- [ ] **Three process-management mechanisms, confirmed dead/live status**: `Procfile` references a module that doesn't exist (`api.wsgi` — dead, pure leftover). `supervisor.conf` is *also* dead in the real deployed topology — docker-compose runs backend/channels/worker/beat as 4 separate containers with their own `command:`, bypassing supervisor entirely. Only the compose per-service commands are live. **Delete `Procfile` and `supervisor.conf`** — the one-process-per-container compose model is already correct.
- [ ] **No CI/CD pipeline at all** — no `.github/workflows/`, no lint/test/build gate before deploy.
- [ ] **`Dockerfile.dev`/`nginx.dev.conf` are dead and rotted** — not referenced by any compose file or doc (actual dev workflow per docs is `docker compose up db redis` + running backend/frontend natively). Confirmed the exact same stale-hostname bug as the one I just fixed in prod's `nginx.conf` (`http://web:8100/...` — "web" isn't a real service name either). Since nobody runs it, nobody caught it. **Either wire it into a real `docker-compose.dev.yml` and fix it, or delete it.**

**MEDIUM**
- [ ] Only `Django==5.0.2` is pinned in `requirements.txt`; everything else unconstrained — reproducibility and supply-chain risk. `uv` listed as a runtime dependency is wrong (it's a package manager, not an app dep). `drf-yasg`/`django-cron` are aging — migrate to `drf-spectacular`/Celery Beat (already tracked above).
- [ ] Secrets via `env_file: .env` is fine at this scale (properly gitignored) — just the thing to upgrade if this ever goes multi-host.
- [ ] Zero security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS) and no gzip in any nginx config. SPA caching for `/assets/` and `/index.html` is actually correct, for contrast.

**LOW**
- [ ] `backend/req.txt` (pasted spec prose, not a requirements file) and `backend/=9.0.0` (stray 0-byte file) — already tracked above, delete both.

**Confirmed good, for contrast — not everything here is vibecoded:**
- Both frontend Dockerfiles are proper multi-stage builds (node builder → `nginx:alpine`, no node_modules/build tools shipped) — matches standard practice.
- Backend Dockerfile layer caching is correct (requirements installed before `COPY . /app/`).
- docker-compose healthchecks are real functional checks (pg_isready, redis-cli ping, actual HTTP health endpoint) with correct `depends_on: condition: service_healthy` — not a shortcut.
- `Makefile` is sane and minimal (migrate/backup/restore/logs/shell), no dangerous unguarded "nuke" targets.

**Recommended standard infra stack** (become the checklist for the infra fix pass): multi-stage builds everywhere, non-root `USER` in every container, one process per container (already true — just delete the dead alternatives), locked/pinned dependencies scanned by CI, a real CI pipeline (lint+test+build+image scan before deploy), TLS via certbot or an upstream LB with enforced HSTS, nginx security headers + gzip, resource limits on every service, network segmentation (public tier vs. data tier), a `.dockerignore` that excludes all `.env*` variants, and deleting dead config instead of letting it rot unexercised.

---

## Planned fix-phase actions (do NOT run yet — audit phase still in progress)

- [ ] **Squash all Django migrations into a single initial migration per app.** User confirmed: since we're rebuilding fresh, no need to preserve migration history as a chain of incremental schema edits (including the plaintext→encrypted Slack/Teams token migration). Collapse to one `0001_initial.py` per app reflecting final schema, after all model-level architecture fixes (tenant scoping, etc.) are decided — squashing before those fixes would mean redoing it.
- [ ] **Run `/impeccable` passes on the frontend** once bug/security/performance fixes are in and before final ship — Impeccable was installed specifically for this. Use `/impeccable audit` or `/impeccable critique` now (audit-only, no edits) to catalog AI-slop/design-system issues alongside the other audits; save `/impeccable polish` for the actual fix phase.

---

## Gaps Noticed (cross-referenced frontend ↔ backend)

1. **Assets page** — broken route, backend ready. Easy fix.
2. **Request workflow** — dead code on both sides, needs full removal or deliberate retirement.
3. **Twilio SMS/WhatsApp** — backend-only, no frontend.
4. **SafariAdmin console** — backend-only, confirm if intentionally separate.
5. **Roles & Permissions** — frontend-ahead-of-backend mismatch, prioritize.
6. **SLA breach scheduling** — possibly silently broken.
7. **Real-time dashboard updates** — confirmed missing, matches what you flagged.
8. **Rate limiting** — only on one endpoint.
9. **Export jobs / License enforcement UI** — frontend trigger points unconfirmed.
10. **Cron fragility** — `os.system()` calls instead of in-process commands/Celery tasks.
