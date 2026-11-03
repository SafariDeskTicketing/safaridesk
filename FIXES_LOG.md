# SafariDesk Fix Log

Every fix below is checked against the rule it violates in `CLAUDE.md` before being marked done — not just "bug gone," but "rule satisfied." Findings reference `AUDIT_TRACKER.md`.

Format per fix: **Before** (what was wrong + how it was exploitable/broken) → **After** (what changed) → **Rule satisfied** (which `CLAUDE.md` rule) → **Verified** (how it was confirmed, e.g. against the local running instance).

---

## Fix batch 1 — pre-auth cross-tenant holes in `tenant/views/TicketView.py`, `SettingView.py`, `NotificationView.py`

### 1. Unauthenticated comment injection on any ticket
**Before:** `add_comment` action had `permission_classes = AllowAny` (via a `get_permissions()` override) and looked up the ticket with `get_object_or_404(Ticket, id=ticket_id)` — no auth, no business filter. Anyone could POST a comment, including `is_internal=true`, to any ticket in any business by guessing the id.
**After:** Removed the `AllowAny` override entirely (the view now uses the class-level `permission_classes = [IsAuthenticated]`); the ticket lookup now filters `business=request.user.business`.
**Rule satisfied:** CLAUDE.md Backend #1 (tenant scoping mandatory) + #2 (explicit permission_classes, no implicit AllowAny).
**Verified:** `POST /api/v1/ticket/comment/add/1` with no auth header → was reachable before, now returns `HTTP 401`.

### 2. Unauthenticated attachment/comment/activity data leak
**Before:** `loadAttachments` had the same `AllowAny` permission and `Ticket.objects.get(id=id)` with no business filter — leaked attachment filenames/URLs, comments, and activity for any ticket by id with zero auth.
**After:** Same permission fix as #1; added `business=request.user.business` to the lookup.
**Rule satisfied:** CLAUDE.md Backend #1, #2.
**Verified:** `GET /api/v1/ticket/get/attachments/1` with no auth → was reachable before, now `HTTP 401`.

### 3. Crash (not leak) on unauthenticated activity-stream access
**Before:** `loadActivityStream` was also `AllowAny` but correctly filtered by `business=request.user.business` — except `request.user` is `AnonymousUser` when unauthenticated, so it threw an unhandled `AttributeError` (500) instead of a clean rejection.
**After:** Resolved as a side effect of removing the `AllowAny` override — DRF now rejects unauthenticated requests before the view method ever runs.
**Rule satisfied:** CLAUDE.md Backend #2.
**Verified:** `GET /api/v1/ticket/get/activity-stream/1` with no auth → now `HTTP 401` (previously would 500).

### 4. Latent IDOR via default ModelViewSet actions (defense-in-depth, not currently live)
**Before:** `TicketView.queryset = Ticket.objects.all()` with no `get_queryset()` override — DRF's default `retrieve`/`update`/`partial_update`/`destroy` would have no business scoping if ever reached. **Correction to the original audit finding, after verifying the actual routes:** I checked `tenant/routes/ticket.py` and the root `urls.py` — there is no router registration and no `<int:pk>` path wired to TicketView's default actions (only explicit custom-action paths exist, none of which call `self.get_object()`). So this was **not actually exploitable today** via any live URL, unlike the originally reported severity — but it was a loaded landmine for the next person who adds a standard CRUD route or a router registration without thinking about tenant scoping.
**After:** Added `get_queryset()` returning `Ticket.objects.for_business()` (matching the pattern already used elsewhere in the same file, e.g. `list`, `ticket_counts`, `bulk_*`), plus an explicit `permission_classes = [IsAuthenticated]` class attribute.
**Rule satisfied:** CLAUDE.md Backend #1 ("scope at the manager/queryset level by default").
**Verified:** `python manage.py check` passes; no route currently exercises this path, so verified by code review against the existing `for_business()` convention rather than a live request.

### 5. Debug endpoint exfiltrating real ticket data to a hardcoded external email
**Before:** `TemplateTest` view (routed at `email/template/test`) did `Ticket.objects.get(id=2)` (no business filter, hardcoded id) and emailed the rendered template to a hardcoded `receiver_email="titus.eddys@gmail.com"` — any authenticated user of any tenant could trigger it.
**After:** Deleted the view and its route entirely — it had no legitimate product purpose, just leftover dev/test scaffolding. Cleaned up now-unused imports (`Ticket`, `Mailer`, `TemplateParser`) left behind in `SettingView.py`.
**Rule satisfied:** CLAUDE.md Backend #3 ("no debug/test endpoints in production routes").
**Verified:** `GET /api/v1/setting/email/template/test` → was reachable before, now `HTTP 404` (route no longer exists). `python manage.py check` passes.

### 6. Staff/superuser cross-tenant notification bypass
**Before:** `MarkNotificationAsReadView.get_queryset()` returned `Notification.objects.all()` for any `is_staff`/`is_superuser` account — such accounts could read/mark-read any user's notifications across all tenants.
**After:** Removed the bypass; now always `Notification.objects.filter(user=self.request.user)`, matching the sibling `NotificationListView`'s existing (correct) pattern and its own explanatory comment.
**Rule satisfied:** CLAUDE.md Backend #1 (tenant scoping mandatory — this was a tenant-boundary violation, not a legitimate admin override).
**Verified:** `GET /api/v1/notifications/mark-as-read/1/` with no auth → `HTTP 401` (unrelated to the fix itself, but confirms the route still resolves correctly after the change); `python manage.py check` passes.

**Not yet fixed (tracked, not forgotten):**
- The broader "no bare `.filter()`/`.all()` on tenant models anywhere in the app" sweep — this batch fixed the 4 CRITICAL confirmed-exploitable spots plus 1 HIGH; a full grep-and-fix pass across the rest of `tenant/views/*.py` and `shared/views/*.py` is still open.

---

## Fix batch 2 — `SlaView.py` scoping (⚠️ correction: this file turned out to be dead code)

**Before investigating:** followed up on the original audit's flag that `SlaView.py`'s `SLAPolicy`/`BusinessHours`/`Holiday` viewsets had no visible `get_queryset()` override. Reading the full file turned up a much bigger pattern than flagged: **every single `*DetailView` in the file (`SLAPolicyDetailView`, `BusinessHoursDetailView`, `HolidayDetailView`, `SLATrackerDetailView`, `SLAEscalationDetailView`) had zero business scoping** (bare `Model.objects.all()`, no `get_queryset()` override), and most `*ListCreateView`s only scoped by business inconsistently or not at all — including a real conditional-logic bug in `HolidayListCreateView` where the business filter was only applied when a `year` query param was also passed. Also found `pause_sla_tracker`/`resume_sla_tracker` function views with the same unscoped `get_object_or_404(SLATracker, id=tracker_id)` pattern.

**I fixed all of it** — added `get_queryset()` overrides scoping every model by `business=self.request.user.business` (SLAPolicy, BusinessHours, Holiday, SLATracker, SLAEscalation), fixed the Holiday conditional bug so the business filter always applies, and added the business filter to both tracker action views.

**⚠️ Then I checked route reachability (the same check that corrected the TicketView IDOR severity) and found: `tenant/routes/sla.py` — the file that wires every view I just fixed — is commented out at `RNSafarideskBack/urls.py:40`.** This entire module is dead code, superseded by `tenant/views/SlaXView.py` (wired via `tenant/routes/slax.py`, live). **These fixes close no live vulnerability** — they're correct hygiene (consistent with CLAUDE.md's scoping rule) on code nobody can currently reach, not an exploit closure. I'm logging this honestly rather than claiming a security win that didn't happen.

**I independently verified `SlaXView.py` (the actually-live module) myself, line by line — it's correctly scoped already:** `SLAViewSet.get_queryset()` and `HolidayViewSet.get_queryset()` both filter by `business=self.request.user.business`, as does the `business_hours` action and `SLAConfigurationView`. No fix needed there.

**Real finding worth your decision, not a code fix:** the live `SlaXView.py` module has no equivalent to `SLATracker` (pause/resume) or `SLAEscalation` CRUD at all — those only exist in the dead `SlaView.py`. Combined with the architecture audit's earlier finding that SLA breach-checking scheduling looks broken (cron/celery-beat mismatch), this suggests **SLA tracker/escalation functionality may never have been migrated to the current system and could be silently missing from the live product**, not just "scoping needs fixing." This needs a product decision: (a) delete the dead `SlaView.py`/`routes/sla.py` entirely since `SlaXView.py` superseded it, after confirming tracker/escalation features aren't needed, or (b) migrate tracker/escalation into `SlaXView.py` if that functionality is actually wanted. Flagging in `AUDIT_TRACKER.md` rather than deciding unilaterally.

**Rule satisfied:** CLAUDE.md Backend #5 ("one mechanism per concern... delete the old one in the same change") — not yet acted on, pending the product decision above.
**Verified:** `python manage.py check` passes; confirmed dead via `grep` on `RNSafarideskBack/urls.py` showing the import commented out.

---

## Fix batch 3 — full sweep of remaining `tenant/views/*.py` and `shared/views/*.py`

A background sweep agent checked every remaining view file (34 files) for the same unscoped-queryset pattern, this time explicitly verifying route reachability (via the exact `urls.py` include line) before asserting severity — learned the hard way in batch 1/2 that grep-pattern findings without that check produce wrong severity. Confirmed-live findings, all fixed:

### 1. Unauthenticated cross-tenant ticket creation — `tenant/views/PublicView.py`, `create()` (~line 116)
**Before:** `category_filters`/`department_filters` only got a `business` key added `if resolved_business:`. When no business resolved (direct API call, no `business_id` in body, host doesn't map to a tenant), the lookup ran completely unscoped — any `category_id`/`department_id` from any tenant could be used, and the created ticket got attached to whatever business the found department belonged to. No auth required (`AllowAny`).
**After:** Added an early fail-closed check — if `resolved_business` is `None` after all resolution attempts, return `400` before any category/department lookup runs.
**Rule satisfied:** CLAUDE.md Backend #1.
**Verified:** `POST /api/v1/public/create/` with no business context → was exploitable, now `HTTP 400` ("Unable to determine the business for this request").

### 2. Unauthenticated cross-tenant KB category leak — `tenant/views/KnowledgeBaseView.py`, `KBCategoryViewSet.tree()` (~line 265)
**Before:** Used `KBCategory.objects.for_business()` directly instead of this viewset's own (correctly-written) `get_queryset()`. `FilterManager.for_business()` silently degrades to `.all()` for `AnonymousUser`, and the `tree` action is `AllowAny` by default (not in the authenticated-action list) — so an unauthenticated request got the full KB category tree across every tenant, including internal-only categories.
**After:** Changed to reuse `self.get_queryset().filter(parent=None)` — the same method already correctly handling authenticated/public/internal-category scoping for every other action on this viewset.
**Rule satisfied:** CLAUDE.md Backend #1, #5 ("one mechanism per concern" — there was already a correct scoping method on the same class; the bug was not using it).
**Verified:** `GET /api/v1/kb/categories/tree/` unauthenticated, no `business_id` → returns `[]` (empty), not a cross-tenant leak.

### 3. Cross-tenant request mismatch — `tenant/views/PublicView.py`, `new_request()` (~line 564)
**Before:** `Department.objects.get(id=department_id)` with no business filter, while `business` was independently resolved from `businessId` — could attach a department from a different tenant to the created `Requests` row.
**After:** Added `business=business` to the department lookup.
**Rule satisfied:** CLAUDE.md Backend #1.
**Verified:** Code review + `python manage.py check` (no live two-tenant dataset in this fresh local DB to exercise the cross-tenant case directly).

### 4. Cross-tenant task-comment actions — `tenant/views/TaskView.py`, `like_comment`/`flag_comment`/`reply_to_comment` (~lines 1326-1420)
**Before:** All three did `get_object_or_404(TaskComment, id=comment_id, task_id=pk)` with no business filter — unlike every other action in the same file, which correctly uses `Task.objects.for_business()`. `reply_to_comment` is a cross-tenant **write** (creates a reply on another tenant's task) with zero authorization check.
**After:** Added `task__business=request.user.business` to all three lookups.
**Rule satisfied:** CLAUDE.md Backend #1.
**Verified:** `python manage.py check` passes; endpoints still correctly require auth (`401` unauthenticated, unchanged).

### 5 & 6. Cross-tenant asset-user and asset-ticket linking — `tenant/views/AssetViews.py`, `assign_user` (~line 423) and `link_ticket` (~line 500)
**Before:** `asset` was correctly scoped via `self.get_object()`, but the target `user_id` (assign_user) / `ticket_id` (link_ticket) from the request body was never validated against `asset.business` — Business A could link an arbitrary Business B user or ticket to their asset, and that cross-tenant data (name/email, or ticket ref/title) was then readable back through `AssetUserMappingViewSet`/the asset's ticket list.
**After:** Added an existence check scoped to `asset.business` before creating the mapping/linkage in both methods — returns `404` if the target doesn't belong to the asset's business.
**Rule satisfied:** CLAUDE.md Backend #1.
**Verified:** `python manage.py check` passes.
**Noted, not fixed:** this file has duplicate `add_maintenance`/`link_ticket` method definitions in the same class (the first copy of each is silently shadowed/dead Python, not a security issue, just confusing leftover code) — flagged in `AUDIT_TRACKER.md` as a cleanup item, not touched here to avoid scope creep mid-security-sweep.

### 7. Fail-open payment data leak — `shared/views/PaymentView.py`, `PaymentListView.get()` and `PaymentDetailView.get()`
**Before:** Business filter only applied `if hasattr(request.user, 'business') and request.user.business:` — an authenticated user with no business set would see every tenant's payment records (session/intent IDs, customer email, amount, metadata) instead of none.
**After:** Flipped to fail closed — no business means `Payment.objects.none()` (list) / `404` (detail), never an unscoped query.
**Rule satisfied:** CLAUDE.md Backend #1.
**Verified:** `GET /api/v1/payment/list/` unauthenticated → `401` (unchanged); fail-closed behavior confirmed by code review + `python manage.py check`.

**Confirmed dead/unreachable during this sweep (no action needed, logged for awareness):**
- `shared/views/TelegramView.py`/`shared/routes/telegram.py` — never `include()`-d in `urls.py` at all. Internally clean anyway.
- `tenant/views/RequestsView.py`/`RequestActionsView.py` — route commented out (`# REMOVED: Request workflow has been disabled (Issue #170)`), matches the dead "Request workflow" already noted in `AUDIT_TRACKER.md`.
- `tenant/routes/pay.py` — not included anywhere in `urls.py`.

**Flagged, not fixed (config-dependent or different bug class, needs a decision, not a queryset fix):**
- `tenant/views/CsatWebhookView.py` — if `CSAT_WEBHOOK_SECRET` is ever left unset, the secret check is skipped entirely, allowing unauthenticated CSAT mutation by guessable `ticket_id`.
- `shared/views/TwilioView.py` — Twilio webhook signature validation is commented out.
- `tenant/views/DashboardView.py` (`DashView`) and `tenant/views/AgentView.py` — same "unscoped class-level `queryset`, but no route currently exposes the vulnerable default action" pattern as the original `TicketView` finding. Not live today; would become live if a future route addition isn't scoping-aware. Not fixed in this batch (same defense-in-depth tradeoff as `TicketView` — flagging rather than preemptively hardening every instance of this shape found across the app).

All other files reviewed in the sweep (`AdminView`, `LicenseView`, `SafariSmsView`, `SlackView`, `TeamsView`, `TwilioWhatsAppView` reads, `AccountDeletionView`, `AuditLogView`, `ContactView`, `CopilotView`, `ReportsView`, `SlaXView`, `LabelView`, `MailIntegrationView`, `MailIntegrationOAuthCallbackView`, `MailgunWebhookView`, `NotificationSettingsView`, `CsatSurveyPublicView`, `DepartmentViewSet`, `EmailFilterView`, `ExportView`, `FileDownloadView`) were found already correctly scoped — no fix needed.

---

## Cleanup batch — dead-code decisions from batch 2's open questions, investigated and resolved

Before deleting anything, I traced the actual logic in each candidate rather than going on the audit's surface-level flag. Full before/after:

### Dead SLA system (`SlaView.py` + `routes/sla.py`) — deleted
**Investigation:** traced the live SLA breach-checking pipeline (`shared/workers/Sla.py`'s Celery Beat task, `Ticket.sla_analysis()`/`get_sla_status()`/`is_sla_breached` on the model) — all of it reads from the new system (`SLA`/`SLATarget`/`SLAViolation`), and `Ticket.sla` is a direct FK to the new `SLA` model. The new system is also strictly richer (conditional matching, multi-level escalations, a violation log) than the old `SLAPolicy`/`SLATracker`. The one place still touching the old system was `PublicView.create()` (still live), which wrote `SLATracker` rows that nothing ever reads back — pure waste.
**Action:** Deleted `tenant/views/SlaView.py` and `tenant/routes/sla.py` (confirmed no other references via grep). Removed the dead commented-out include line in `urls.py`. **Root-cause fixed `PublicView.create()`'s SLA logic**: replaced the old `SLAPolicy`/`SLATracker` block with the same auto-assignment logic `TicketView.create()` already uses for the new `SLA` system (there's even a `# REMOVED OLD CODE` comment in `TicketView.create()` marking where this migration already happened for the agent-side path — `PublicView.create()`, the customer/public path, was simply never migrated). Also updated the `sla_info` response block to read `ticket.sla`/`ticket.calculate_sla_due_times()` instead of the now-gone `ticket.sla_tracker`, so customers still get due-date info in the create-ticket response, just from the live system.
**Rule satisfied:** CLAUDE.md Backend #4 (fix root cause) + #5 (one mechanism per concern).
**Verified:** `python manage.py check` passes; `POST /api/v1/public/create/` still works (fails closed on missing business as fixed earlier); `GET /api/v1/sla/policies/` (the live new-system route) still returns `401` unaffected.

### Request workflow (`RequestsView.py`, `RequestActionsView.py`, `routes/req.py`, `PublicView.new_request()`) — deleted
**Investigation:** `urls.py` already had `# REMOVED: Request workflow has been disabled (Issue #170)` — a deliberate, tracked decision, not an accident. Checked the frontend: `CreateRequestModal.tsx` (the only caller of the still-live `new_request` endpoint) was never imported anywhere. Fully dead on both ends. Also found `tenant/views/RequestsView.py` was a *second*, completely orphaned file — never referenced by anything, not even the already-dead route.
**Action:** Deleted `tenant/views/RequestsView.py`, `tenant/views/RequestActionsView.py`, `tenant/routes/req.py`, the `PublicView.new_request()` method and its route, and on the frontend: `CreateRequestModal.tsx`, `RequestCard.tsx`, `RequestViewModal.tsx`, `RequestsPage.tsx`, the `CREATE_REQUEST` API constant, and a leftover commented-out route line in `App.tsx`. Cleaned up now-unused imports (`RequestViewSet` in `tenant/views/__init__.py`, `Requests` in `PublicView.py`).
**Rule satisfied:** CLAUDE.md Backend #5, Frontend #1.
**Verified:** `python manage.py check` passes; `POST /api/v1/requests/` and `POST /api/v1/public/request/new/` → `404` (confirmed gone).

### `tenant/routes/pay.py` — deleted
**Investigation:** imports `PaymentView` from `tenant.views.SettingView` — that class doesn't exist there (0 matches via grep). Was never `include()`-d in `urls.py`, so this never actually crashed anything, but it was broken, dead, and superseded by the Stripe-based `PaymentView` in `shared/views/` (already fixed in the security batch).
**Action:** Deleted.
**Verified:** `python manage.py check` passes (nothing referenced it).

### Dead tenant-resolution middleware (`shared/middleware/DomainMiddleware.py`) — deleted
**Investigation:** the original architecture audit flagged this as "two competing tenant-resolution middlewares" (`CustomDomainMiddleware` live, `DomainMiddleware` dead-but-still-referenced-elsewhere). Checked precisely with a word-boundary grep (`\bDomainMiddleware\b` excluding `CustomDomainMiddleware`): **zero references anywhere in the codebase**, including in the files the original audit cited (`domain_tasks.py`, `custom_domain_signals.py`, `CustomDomainView.py`) — those all import and use `CustomDomainMiddleware`, not `DomainMiddleware`. The original claim was a substring-grep false positive.
**Action:** Deleted `shared/middleware/DomainMiddleware.py` outright.
**Verified:** `python manage.py check` passes on a fresh rebuild.

### Telegram integration — reconnected, not deleted
**Investigation:** this one went the other way. 6 complete backend views (connect, detail, test-connection, send-test-message, webhook, chats), each correctly `IsAuthenticated` + scoped by `request.user.business` (verified myself, not just trusted the sweep's note) except the webhook (`AllowAny` — correct by design, that's how Telegram itself calls in). Matching frontend: `telegram-setup.tsx`, `TelegramIntegration.tsx` card component, a dedicated API service file, **and** it turned out the frontend route already existed (nested inside `src/pages/config.tsx`'s sub-router, which I missed on a first pass checking only `App.tsx`/`Routes.ts`) and is linked from `IntegrationsPage.tsx`'s integration-cards list. The *only* missing piece was the backend `include()` line in `urls.py` — everything else was already fully wired and just waiting for the backend to come online.
**Action:** Added `path("api/v1/integrations/telegram/", include("shared.routes.telegram"))` to `urls.py`. No frontend changes needed.
**Rule satisfied:** CLAUDE.md Backend #5 (this was the opposite of dead code — a real feature, cut off from its only missing piece).
**Verified:** `POST /api/v1/integrations/telegram/connect/` → `401` (reachable, requires auth — was `404` before).

---
