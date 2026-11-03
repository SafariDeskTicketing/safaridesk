# SafariDesk — Project Standards

This file is the standing rubric for all design, implementation, and review work on this repo. It exists because this codebase was vibecoded (features added in isolation, no consistent conventions) and is being brought up to a professional standard. **Every review or implementation pass must check against the concrete rules below — not freelance opinions.** If a finding doesn't violate a rule here or cause a measurable defect (crash, data leak, wrong output, broken build), it doesn't belong in a review. See "Review Discipline" at the bottom.

Full audit history and findings live in `AUDIT_TRACKER.md`. This file is the *rules*; that file is the *findings log*.

---

## Backend (Django)

1. **Tenant scoping is mandatory, not opt-in.** Every queryset touching a tenant-scoped model (Ticket, Task, Comment, Contact, KnowledgeBase, etc.) must go through business-scoped access — never a bare `Model.objects.all()`/`.filter()` reachable from a view without a business/tenant filter. This was the #1 confirmed security hole in this codebase (unauth cross-tenant reads/writes on `TicketView.py`). New code: scope at the manager/queryset level by default, not per-call-site opt-in.
2. **Every view/viewset must declare explicit `permission_classes`.** No implicit DRF `AllowAny` default. If an endpoint is genuinely public (webhooks, public KB), say so explicitly and justify it in a comment — don't let it happen by omission.
3. **No debug/test endpoints in production routes.** If you need a one-off script to test something, write a management command or a local script — never a routed view with hardcoded ids/emails (found: a `TemplateTest` view that emailed real ticket data to a hardcoded Gmail address).
4. **Business logic lives in `services/`, not in views.** Views parse the request and call a service; the service does the work. `TicketView.py` at 4,493 lines is the anti-pattern to avoid — if a view file is approaching four figures of lines, that's a signal logic needs to move down into services.
5. **One mechanism per concern.** Don't let two systems coexist for the same job (found: two tenant-resolution middlewares, one dead; cron *and* celery-beat both half-wired for SLA breach checking). When replacing a mechanism, delete the old one in the same change — don't leave it referenced-but-unwired.
6. **Scheduled/background work goes through Celery tasks, not `os.system()` shell-outs.** Shell-outs swallow errors silently and give no observability.
7. **Secrets only via environment variables**, loaded through `python-decouple` (already the established pattern). Never hardcode a key/token/email in source. `SECRET_KEY`/`DEBUG` must not have insecure defaults at the shared settings base — only in environment-specific files that are guaranteed to override.
8. **One requirements file.** `requirements.txt` is authoritative; dependency versions should be pinned for reproducibility.
9. **Migrations reflect the current schema cleanly.** Since this project has no live users yet, squash migrations per app into a single `0001_initial` after a model change lands, rather than carrying a long incremental chain that just documents vibecoding history.

## Frontend (React + TypeScript)

1. **One canonical implementation per feature.** Do not let two components do the same job (found: `TicketsPage.tsx` vs `all.tsx`, both implementing the ticket list differently). If you're replacing an implementation, delete the old one in the same change.
2. **Server state goes through TanStack Query — no hand-rolled fetch caches.** `useState`/`useEffect` + raw `http.get` for server data is the anti-pattern; a second caching layer on top of React Query (found: `fetchCache.ts`) is redundant and a staleness-bug source.
3. **No `any`.** `strict: true` in `tsconfig` means something only if types are actually used. If a type is genuinely unknown, model it narrowly or use `unknown` with a guard — not `any`.
4. **God components are a defect, not a style preference.** A component mixing data-fetching, business logic, and rendering in one multi-thousand-line file (found: `all.tsx` at 4,064 lines, `TasksPage.tsx` at 3,187) must be decomposed: fetch in a hook, logic in a function, rendering in focused subcomponents.
5. **Reuse `src/components/ui/` primitives — don't hand-roll.** A `bg-white rounded-* shadow-*` div doing the job of `<Card>` is design-system drift, confirmed widespread in this codebase (76 ad-hoc instances vs. 4 files actually using `<Card>`).
6. **One library per job.** Don't install two editors or two chart libraries for the same purpose (found: Quill+Tiptap, Recharts+ApexCharts) — pick one, remove the other.
7. **Async correctness is required, not optional:** every fetch triggered by user input (search, filters) needs debounce + cancellation (`AbortController`) to prevent stale-response races; every concurrent-401 path needs single-flight token refresh; every WebSocket hook must clear its own intervals/timeouts on both reconnect and unmount.
8. **Accessibility floor** (confirmed gaps to not repeat): every `<label>`/input pair must be properly associated (`htmlFor`/`id`), every custom interactive `<div>` needs `role`+`tabIndex`, every meaningful animation needs a `prefers-reduced-motion` fallback, interactive elements must meet a 44px touch target.
9. **`tsconfig` `include` must only reference files inside the project.** Never let a stray path like `"../NotificationsPage copy.tsx"` end up in a tracked config file — that's a sign of an accidental editor/AI-tool edit, not a deliberate change.

## Infrastructure / Deployment

1. **One process per container.** Already correct in `docker-compose.yml` (backend/channels/worker/beat as four separate containers with their own command) — this IS the standard, keep it. Do not reintroduce supervisord/multi-process-per-container; `Procfile` and `supervisor.conf` are dead leftovers from before this was fixed and must be deleted, not revived.
2. **Every Dockerfile is multi-stage, final image has no build toolchain.** Frontend already does this correctly (node builder → `nginx:alpine`). Backend does not — `build-essential`/`-dev` libs must not persist into the runtime image. Compile in a `builder` stage, copy only the installed packages into the runtime stage.
3. **Every container runs as a non-root `USER`.** No exceptions without a specific, documented reason.
4. **No dead Dockerfiles/configs left to rot.** If `Dockerfile.dev`/`nginx.dev.conf`/a compose file isn't wired into an actual documented workflow, delete it — unexercised config drifts silently (confirmed: the same stale-upstream-hostname bug existed in both the live `nginx.conf` I fixed and the dead `nginx.dev.conf` nobody runs).
5. **`.dockerignore` must explicitly exclude all `.env*` variants** (except `.env.example`) in every buildable directory — don't rely on one never existing in the build context.
6. **Every service gets resource limits** (`mem_limit`/`cpus` at minimum). An unbounded container can OOM the host and take every other service down with it.
7. **Data-tier services (`db`, `redis`) must not share a network with internet-facing services (`nginx`, `frontend`).** Segment into at least a public-facing network and a data network.
8. **TLS is not optional.** Either terminate it properly (certbot/ACME, enforced HSTS) or document explicitly that an external LB/CDN does it — never silently absent.
9. **nginx configs carry standard security headers and gzip** — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP, HSTS (once TLS exists), `gzip on` with real `gzip_types`. SPA caching rules for `/assets/` (immutable) vs `/index.html` (no-store) are already correct — keep that pattern.
10. **Dependencies are pinned/locked, not left loose.** `Django==5.0.2` pinned is correct; everything else in `requirements.txt` needs the same treatment (pip-compile/uv lock). A package manager (`uv`) is a tool, never a listed runtime dependency.
11. **No deploy without a CI gate.** Lint + test + build (+ image scan) must run before anything ships — currently absent entirely.

Full findings and severity ranking: `AUDIT_TRACKER.md` → "🏗️ Infra/deployment audit".

## Security baseline (non-negotiable, apply to any new code)

- No cross-tenant data access without an explicit, reviewed business filter.
- No secret, token, or credential ever hardcoded or logged in plaintext.
- No endpoint reachable without an explicit, intentional permission decision.
- Encrypt anything that's a third-party credential at rest (established pattern: `util/security/encryption.py`, Fernet via `SECRET_ENCRYPTION_KEY`) — follow the existing pattern, don't invent a new one.

## Review Discipline

When reviewing code (yours or someone else's) against this file:

1. **Every finding must cite which rule above it violates, or name a concrete, reproducible failure** (crash with input X, wrong output for case Y, data leak scenario Z). "This could be cleaner" is not a finding unless it maps to a rule.
2. **Don't pad a review to look thorough.** If a change is clean against these standards, say so and stop — a short "no issues" review is a correct review, not an incomplete one.
3. **Severity matters.** A pre-auth cross-tenant data leak and a missing `aria-label` are not the same priority — rank CRITICAL (security/data-loss/crash) → HIGH (real bug) → MEDIUM (standards violation with real but bounded impact) → LOW (polish), and don't let LOW items crowd out CRITICAL ones in a report.
4. **New code is held to these rules at write-time, not just at review-time.** When implementing a feature, check it against the relevant section above before considering it done — that's cheaper than catching it in review.
