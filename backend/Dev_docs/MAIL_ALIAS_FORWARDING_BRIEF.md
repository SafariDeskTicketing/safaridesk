# Mail Alias Forwarding Brief (Dev -> Prod)

## Purpose
Document the minimum setup needed to replicate alias mailbox forwarding (Mailgun inbound -> ticket creation) in production.

## Confirmed API Paths
- API base (app endpoints): `https://api.safaridesk.io/api/v1/`
- Public validate endpoint: `https://api.safaridesk.io/api/v1/public/validate/`
- Mailgun inbound webhook path in backend code: `/mailgun/inbound/mime` (not under `/api/v1`)
- Expected prod webhook URL: `https://api.safaridesk.io/mailgun/inbound/mime`

## High-Level Flow
1. Customer sends email to alias, for example `support@acme.safaridesk.io`.
2. Mailgun inbound domain receives the email.
3. Mailgun route matches recipient and forwards raw MIME to backend webhook.
4. Backend verifies Mailgun signature using `MAILGUN_SIGNING_KEY`.
5. Backend finds `MailIntegration` record by alias (`forwarding_address` / `email_address`) for provider `safaridesk`.
6. Backend queues Celery task `process_mailgun_inbound`.
7. Worker parses MIME and creates ticket or reply.

## Required Production Config

### 1) DNS / Mailgun Domain
- Inbound domain configured as `safaridesk.io`.
- Mailgun wildcard receiving is enabled for the domain.
- Root and wildcard subdomain MX records point to Mailgun inbound hosts.
- Domain region (US/EU) is consistent with account and API usage.

### 2) Mailgun Route
Use one route similar to:

```txt
match_recipient("^support@.+\.safaridesk\.io$")
forward("https://api.safaridesk.io/mailgun/inbound/mime")
stop()
```

Priority can remain `0` unless you intentionally use multiple routes.

### 3) Backend Environment Variables
- `APP_ENV=prod`
- `SAFARIDESK_FORWARDING_DOMAIN=safaridesk.io` (variable name is legacy but still used)
- `MAILGUN_SIGNING_KEY=<mailgun-webhook-signing-key>`
- `MAILGUN_API_KEY=<mailgun-api-key>`
- `MAILGUN_DOMAIN=safaridesk.io`
- `MAILGUN_API_BASE_URL=https://api.eu.mailgun.net`

### 4) Database Records (per alias integration)
- `mail_integrations.provider = safaridesk`
- `mail_integrations.forwarding_address = support@business-slug.safaridesk.io`
- `mail_integrations.email_address` usually same as forwarding alias
- `mail_integrations.is_active = true`

## Fast Prod Verification
1. Send a test email to one known alias.
2. Confirm Mailgun event shows `forward(...)` to `https://api.safaridesk.io/mailgun/inbound/mime` with HTTP 200.
3. Confirm backend logs show webhook hit and no signature error.
4. Confirm Celery worker runs `process_mailgun_inbound`.
5. Confirm ticket appears in prod UI.

## Common Breaks
- Route still points to `api.dev...` instead of prod.
- Using `/api/v1/mailgun/inbound/mime` (wrong for current backend; webhook is outside `/api/v1`).
- Wrong `MAILGUN_SIGNING_KEY` in prod.
- Alias exists in dev DB but not prod DB.
- Web app and Celery worker not sharing the same prod env/config.
