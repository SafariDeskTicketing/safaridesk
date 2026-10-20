---
title: "Configuration"
description: "SafariDesk self-hosted environment variables, domains, secrets, database, Redis, email, integrations, AI, and licensing"
---

# SafariDesk Self-Hosted Configuration

SafariDesk self-hosting is configured through one root `.env` file.

Start from:

```bash
cp .env.example .env
```

Do not commit `.env`.

Related pages:

- [Installation](./installation.md)
- [Architecture](./architecture.md)
- [Production Deployment](./production.md)
- [Docker Images and Releases](./docker-images-and-releases.md)
- [Slack Integration Setup](./slack-integration.md)
- [Troubleshooting](./troubleshooting.md)

---

## Configuration Rules

Use these rules for production:

- Replace every `change-me-*` value.
- Keep secrets out of Git.
- Use one public hostname unless you intentionally configure split-domain routing.
- Keep `DEBUG=false`.
- Keep PostgreSQL and Redis private inside Docker Compose.
- Pin `SAFARIDESK_IMAGE_TAG` to a release tag.
- Back up `.env` securely with your infrastructure secrets, not in this repository.

---

## Minimum Production Values

At minimum, update these before public deployment:

```env
DOMAIN_NAME=helpdesk.example.com
APP_BASE_URL=https://helpdesk.example.com
FRONTEND_URL=https://helpdesk.example.com
FRONTEND_URL_BASE=https://helpdesk.example.com
API_BASE_URL=https://helpdesk.example.com
FILE_BASE_URL=https://helpdesk.example.com

SECRET_KEY=replace-with-a-long-random-django-secret
SECRET_ENCRYPTION_KEY=replace-with-a-long-random-encryption-secret
DB_PASSWORD=replace-with-a-strong-database-password
SUPERUSER_PASSWORD=replace-with-a-strong-admin-password

ALLOWED_HOSTS=helpdesk.example.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://helpdesk.example.com
CSRF_TRUSTED_ORIGINS=https://helpdesk.example.com

DEFAULT_FROM_EMAIL=noreply@example.com
INACTIVE_TENANT_ADMIN_EMAIL=admin@example.com
```

For production image pinning:

```env
SAFARIDESK_IMAGE_TAG=v1.0.0
```

---

## Same-Domain URL Configuration

Same-domain deployment is the default and recommended setup.

Example:

```text
https://helpdesk.example.com/
https://helpdesk.example.com/api/
https://helpdesk.example.com/ws/
https://helpdesk.example.com/uploads/
```

Recommended `.env` values:

```env
DOMAIN_NAME=helpdesk.example.com
APP_BASE_URL=https://helpdesk.example.com
FRONTEND_URL=https://helpdesk.example.com
FRONTEND_URL_BASE=https://helpdesk.example.com
API_BASE_URL=https://helpdesk.example.com
FILE_BASE_URL=https://helpdesk.example.com
MEDIA_URL=/uploads/
FILE_URL=https://helpdesk.example.com/uploads/files
AVATARS_URL=https://helpdesk.example.com/uploads/avatars
TASK_FILE_URL=https://helpdesk.example.com/uploads/task-files
KB_IMAGE_URL=https://helpdesk.example.com/uploads/kb/images
```

Frontend public variables should stay path-based:

```env
VITE_API_URL=/api/v1
VITE_WS_NOTIFICATIONS_URL=
VITE_CHAT_WS_BASE=
VITE_SITE_URL=/site
```

When `VITE_WS_NOTIFICATIONS_URL` and `VITE_CHAT_WS_BASE` are empty, the frontend derives WebSocket URLs from the browser origin.

---

## Split-Domain URL Configuration

Split-domain deployment is supported for advanced deployments.

Example:

```text
https://app.example.com/
https://api.example.com/api/
wss://api.example.com/ws/
```

Example `.env` values:

```env
DOMAIN_NAME=api.example.com
APP_BASE_URL=https://app.example.com
FRONTEND_URL=https://app.example.com
FRONTEND_URL_BASE=https://app.example.com
API_BASE_URL=https://api.example.com
FILE_BASE_URL=https://api.example.com

VITE_API_URL=https://api.example.com/api/v1
VITE_WS_NOTIFICATIONS_URL=wss://api.example.com/ws/notifications/
VITE_CHAT_WS_BASE=wss://api.example.com

ALLOWED_HOSTS=api.example.com,app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
CSRF_TRUSTED_ORIGINS=https://app.example.com,https://api.example.com
```

Use `deploy/nginx/split-domain.conf` as the starting point if you need this model.

---

## App Identity

| Variable | Required | Secret | Default | Purpose |
|---|---:|---:|---|---|
| `APP_ENV` | Yes | No | `prod` | Selects backend settings through `RNSafarideskBack/settings/__init__.py`. |
| `SAFARIDESK_VERSION` | No | No | `dev` | Runtime version label. Set to the release tag in production. |
| `SAFARIDESK_DEPLOYMENT_TYPE` | No | No | `self_hosted` | Deployment type used by licensing and runtime checks. |
| `SAFARIDESK_EDITION` | No | No | `community` | Edition label. |
| `SAFARIDESK_INSTANCE_ID` | Recommended | No | empty | Stable instance identifier for licensing and support. |

Production example:

```env
APP_ENV=prod
SAFARIDESK_VERSION=v1.0.0
SAFARIDESK_DEPLOYMENT_TYPE=self_hosted
SAFARIDESK_EDITION=enterprise
SAFARIDESK_INSTANCE_ID=replace-with-stable-instance-id
```

---

## Docker Images

| Variable | Required | Secret | Default | Purpose |
|---|---:|---:|---|---|
| `DOCKERHUB_NAMESPACE` | Yes | No | `safaridesk` | Docker Hub namespace used by Compose image references. |
| `SAFARIDESK_IMAGE_TAG` | Yes | No | `latest` | Image tag used for frontend and backend application images. |

Production example:

```env
DOCKERHUB_NAMESPACE=safaridesk
SAFARIDESK_IMAGE_TAG=v1.0.0
```

See [Docker Images and Releases](./docker-images-and-releases.md).

---

## Domains and URLs

| Variable | Required | Secret | Example | Purpose |
|---|---:|---:|---|---|
| `DOMAIN_NAME` | Yes | No | `helpdesk.example.com` | Primary hostname. |
| `APP_BASE_URL` | Yes | No | `https://helpdesk.example.com` | Public application base URL. |
| `FRONTEND_URL` | Yes | No | `https://helpdesk.example.com` | Frontend URL used by backend-generated links. |
| `FRONTEND_URL_BASE` | Yes | No | `https://helpdesk.example.com` | Base frontend URL used by worker-generated links. |
| `API_BASE_URL` | Yes | No | `https://helpdesk.example.com` | Backend API base URL used by backend settings. |
| `FILE_BASE_URL` | Yes | No | `https://helpdesk.example.com` | Base URL for generated file links. |
| `MEDIA_URL` | Yes | No | `/uploads/` | Public media route. |
| `MEDIA_ROOT` | Yes | No | `/mnt/safaridesk` | Container path for uploaded media. |
| `FILE_URL` | Yes | No | `https://helpdesk.example.com/uploads/files` | Generated file URL prefix. |
| `AVATARS_URL` | Yes | No | `https://helpdesk.example.com/uploads/avatars` | Generated avatar URL prefix. |
| `TASK_FILE_URL` | Yes | No | `https://helpdesk.example.com/uploads/task-files` | Generated task file URL prefix. |
| `KB_IMAGE_URL` | Yes | No | `https://helpdesk.example.com/uploads/kb/images` | Generated knowledge base image URL prefix. |

Use `https://` values in production.

---

## Frontend Public Config

These variables are passed as Docker build args to `frontend/Dockerfile` and are baked into the Vite frontend build.

| Variable | Required | Secret | Same-domain value | Purpose |
|---|---:|---:|---|---|
| `VITE_API_URL` | Yes | No | `/api/v1` | API base used by the frontend Axios client. |
| `VITE_WS_NOTIFICATIONS_URL` | No | No | empty | Explicit notifications WebSocket URL. Leave empty for same-domain auto-detection. |
| `VITE_CHAT_WS_BASE` | No | No | empty | Explicit chat WebSocket base. Leave empty for same-domain auto-detection. |
| `VITE_SITE_URL` | No | No | `/site` | Site route used by the frontend. |
| `VITE_ALLOW_OTP` | No | No | `false` | Frontend OTP feature flag. |

Important: changing `VITE_*` values requires rebuilding the frontend image.

---

## Security

| Variable | Required | Secret | Production value | Purpose |
|---|---:|---:|---|---|
| `DEBUG` | Yes | No | `false` | Disables Django debug mode. |
| `SECRET_KEY` | Yes | Yes | long random string | Django secret key. |
| `SECRET_ENCRYPTION_KEY` | Recommended | Yes | long random string | Application encryption secret where used by backend features. |
| `ALLOWED_HOSTS` | Yes | No | `helpdesk.example.com,localhost,127.0.0.1` | Comma-separated Django allowed hosts. |
| `CORS_ALLOW_ALL_ORIGINS` | Yes | No | `false` | Must remain false in production. |
| `CORS_ALLOWED_ORIGINS` | Yes | No | `https://helpdesk.example.com` | Comma-separated allowed frontend origins. |
| `CORS_ALLOWED_ORIGIN_REGEXES` | No | No | empty | Optional regex origins. Avoid unless needed. |
| `CSRF_TRUSTED_ORIGINS` | Yes | No | `https://helpdesk.example.com` | Comma-separated CSRF trusted origins. |

Generate secrets with your password manager or a secure random generator.

Example:

```bash
openssl rand -base64 48
```

---

## Database

| Variable | Required | Secret | Default | Purpose |
|---|---:|---:|---|---|
| `DB_ENGINE` | Yes | No | `django.db.backends.postgresql` | Django database backend. |
| `DB_NAME` | Yes | No | `safaridesk` | PostgreSQL database name. |
| `DB_USER` | Yes | No | `safaridesk` | PostgreSQL username. |
| `DB_PASSWORD` | Yes | Yes | `change-me-db-password` | PostgreSQL password. |
| `DB_HOST` | Yes | No | `db` | Compose service name for PostgreSQL. |
| `DB_PORT` | Yes | No | `5432` | PostgreSQL port inside Compose. |

Do not expose PostgreSQL directly to the internet.

---

## Redis and Celery

| Variable | Required | Secret | Default | Purpose |
|---|---:|---:|---|---|
| `REDIS_HOST` | Yes | No | `redis` | Compose service name for Redis. |
| `REDIS_PORT` | Yes | No | `6379` | Redis port inside Compose. |
| `REDIS_PASSWORD` | No | Yes | empty | Optional Redis password. |
| `CELERY_BROKER_URL` | Yes | Maybe | `redis://redis:6379/0` | Celery broker URL. Include password if Redis password is set. |
| `CELERY_RESULT_BACKEND` | Yes | Maybe | `redis://redis:6379/0` | Celery result backend URL. Include password if Redis password is set. |

If you set `REDIS_PASSWORD`, update Celery URLs too.

Example:

```env
REDIS_PASSWORD=replace-with-redis-password
CELERY_BROKER_URL=redis://:replace-with-redis-password@redis:6379/0
CELERY_RESULT_BACKEND=redis://:replace-with-redis-password@redis:6379/0
```

---

## Email and SMTP

| Variable | Required | Secret | Example | Purpose |
|---|---:|---:|---|---|
| `EMAIL_HOST` | Yes | No | `smtp.example.com` | SMTP host. |
| `EMAIL_PORT` | Yes | No | `587` | SMTP port. |
| `EMAIL_USE_TLS` | Yes | No | `true` | Use STARTTLS. |
| `EMAIL_USE_SSL` | Yes | No | `false` | Use implicit SSL. Usually false when TLS is true. |
| `EMAIL_HOST_USER` | Usually | No | `smtp-user` | SMTP username. |
| `EMAIL_HOST_PASSWORD` | Usually | Yes | `smtp-password` | SMTP password. |
| `DEFAULT_FROM_EMAIL` | Yes | No | `noreply@example.com` | Default sender address. |
| `DEFAULT_FROM_NAME` | Yes | No | `SafariDesk` | Default sender name. |
| `INACTIVE_TENANT_ADMIN_EMAIL` | Yes | No | `admin@example.com` | Administrative notification address. |

Use either TLS or SSL according to your provider. Do not set both to true unless your SMTP provider explicitly requires it.

---

## Admin Bootstrap

| Variable | Required | Secret | Purpose |
|---|---:|---:|---|
| `SUPERUSER_USERNAME` | Yes | No | Username for the initial SafariAdmin user. |
| `SUPERUSER_PASSWORD` | Yes | Yes | Password for the initial SafariAdmin user. |
| `SUPERUSER_EMAIL` | Yes | No | Email for the initial SafariAdmin user. |
| `SUPERUSER_FIRST_NAME` | No | No | First name metadata. |
| `SUPERUSER_LAST_NAME` | No | No | Last name metadata. |
| `SUPERUSER_PHONE_NUMBER` | No | No | Phone metadata. |
| `CORE_USERNAME` | Yes | No | Core user seed value used by backend setup. |
| `CORE_PASSWORD` | Yes | Yes | Core user password. |
| `CORE_EMAIL` | Yes | No | Core user email. |
| `CORE_FIRST_NAME` | No | No | Core first name metadata. |
| `CORE_LAST_NAME` | No | No | Core last name metadata. |
| `CORE_PHONE_NUMBER` | No | No | Core phone metadata. |

Create the admin user with:

```bash
sh deploy/scripts/create-admin.sh
```

---

## Mail Integrations and OAuth

| Variable | Required | Secret | Purpose |
|---|---:|---:|---|
| `MAIL_INTEGRATION_OAUTH_SUCCESS_URL` | Optional | No | Frontend redirect after mail OAuth success. |
| `MAIL_INTEGRATION_OAUTH_ERROR_URL` | Optional | No | Frontend redirect after mail OAuth failure. |
| `GOOGLE_OAUTH_CLIENT_ID` | Optional | No | Google OAuth client ID. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Optional | Yes | Google OAuth secret. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Optional | No | Google OAuth callback URL. |
| `MICROSOFT_OAUTH_CLIENT_ID` | Optional | No | Microsoft OAuth client ID. |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | Optional | Yes | Microsoft OAuth secret. |
| `MICROSOFT_OAUTH_REDIRECT_URI` | Optional | No | Microsoft OAuth callback URL. |
| `SAFARIDESK_FORWARDING_DOMAIN` | Optional | No | Mail forwarding domain. |
| `MAILGUN_SIGNING_KEY` | Optional | Yes | Mailgun webhook signing key. |
| `MAILGUN_API_KEY` | Optional | Yes | Mailgun API key. |
| `MAILGUN_DOMAIN` | Optional | No | Mailgun domain. |
| `MAILGUN_API_BASE_URL` | Optional | No | Mailgun API base URL. |

Placeholder provider links:

- [Google OAuth setup](../TODO-google-oauth.md)
- [Microsoft OAuth setup](../TODO-microsoft-oauth.md)
- [Mailgun setup](../TODO-mailgun.md)

---

## Integrations

| Variable | Required | Secret | Purpose |
|---|---:|---:|---|
| `SLACK_CLIENT_ID` | Optional | No | Slack OAuth client ID. |
| `SLACK_CLIENT_SECRET` | Optional | Yes | Slack OAuth secret. |
| `SLACK_SIGNING_SECRET` | Optional | Yes | Slack request signing secret. |
| `SLACK_REDIRECT_URI` | Optional | No | Slack OAuth redirect URI. |
| `SLACK_OAUTH_SCOPES` | Optional | No | Comma-separated bot scopes requested on connect. Must include `channels:history` or inbound messages will never create tickets — see [Slack Integration Setup](./slack-integration.md). |
| `TEAMS_APPLICATION_ID` | Optional | No | Microsoft Teams app ID. |
| `TEAMS_DIRECTORY_ID` | Optional | No | Microsoft directory ID. |
| `TEAMS_CLIENT_SECRET` | Optional | Yes | Teams client secret. |
| `TEAMS_REDIRECT_URI` | Optional | No | Teams redirect URI. |
| `TWILIO_ACCOUNT_SID` | Optional | No | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | Optional | Yes | Twilio auth token. |
| `TWILIO_PHONE_NUMBER` | Optional | No | Twilio sender phone number. |
| `TWILIO_SENDER_ID` | Optional | No | Twilio sender ID. |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional | No | Twilio messaging service SID. |
| `TWILIO_WHATSAPP_NUMBER` | Optional | No | Twilio WhatsApp number. |
| `TWILIO_WHATSAPP_TEMPLATE_SID` | Optional | No | Twilio WhatsApp template SID. |

Leave unused integrations empty.

---

## AI Providers

| Variable | Required | Secret | Default | Purpose |
|---|---:|---:|---|---|
| `GEMINI_API_KEY` | Optional | Yes | empty | Gemini API key. |
| `GEMINI_MODEL` | Optional | No | `gemini-2.0-flash` | Gemini model name. |
| `GEMINI_MAX_RETRIES` | Optional | No | `3` | Retry count. |
| `GEMINI_RETRY_DELAY` | Optional | No | `1.0` | Retry delay in seconds. |
| `GEMINI_TIMEOUT` | Optional | No | `30` | Request timeout in seconds. |
| `EMBEDDING_MODEL` | Optional | No | `gemini-embedding-001` | Embedding model name. |
| `EMBEDDING_OUTPUT_DIM` | Optional | No | `1536` | Embedding dimensionality. |
| `AI_DEFAULT_MONTHLY_TOKEN_CAP` | Optional | No | `1000000` | Default monthly AI token cap. |
| `AI_DEFAULT_HARD_CAP_ENABLED` | Optional | No | `true` | Whether hard cap is enabled by default. |
| `AI_DEFAULT_OVERAGE_ENABLED` | Optional | No | `false` | Whether overage is enabled by default. |
| `AI_DEFAULT_OVERAGE_PRICE_PER_1K_USD` | Optional | No | `0.002000` | Overage price metadata. |

Leave `GEMINI_API_KEY` empty if AI features are not enabled.

---

## Billing and Licensing

| Variable | Required | Secret | Purpose |
|---|---:|---:|---|
| `STRIPE_SECRET_KEY` | Optional | Yes | Stripe secret key. |
| `STRIPE_PUBLISHABLE_KEY` | Optional | No | Stripe publishable key. |
| `STRIPE_RETURN_URL` | Optional | No | Stripe return URL. |
| `SAFARIDESK_LICENSE_KEY` | Optional | Yes | SafariDesk license key. |
| `SAFARIDESK_LICENSE_SERVER_URL` | Optional | No | License validation server URL. |
| `SAFARIDESK_LICENSE_VIOLATION_DAYS` | Optional | No | Grace period in days. |

Placeholder links:

- [Stripe setup](../TODO-stripe.md)
- [License setup](../TODO-license.md)

---

## Optional Ports

| Variable | Required | Secret | Default | Purpose |
|---|---:|---:|---|---|
| `HTTP_PORT` | No | No | `80` | Host port published by the root `nginx` service. |
| `HTTPS_PORT` | No | No | `443` | Reserved for TLS-enabled deployment patterns. The current root Compose file does not publish this port by default. |

Example for local testing on a busy host:

```env
HTTP_PORT=8080
```

Then open:

```text
http://localhost:8080
```

---

## Docker Log Container Names

The environment file includes container names used by backend admin log features:

```env
LOG_CONTAINER_WEB=safaridesk_backend
LOG_CONTAINER_CELERY=safaridesk_worker
LOG_CONTAINER_CELERY_BEAT=safaridesk_beat
LOG_CONTAINER_CHANNELS=safaridesk_channels
```

The Docker socket is not mounted into the backend by default for security reasons. Features that require host Docker access must be treated as an explicit operational exception, not a default self-hosting requirement.

---

## Rebuild Requirements

Changes to these variables require a frontend rebuild because they are baked into the Vite build:

- `VITE_API_URL`
- `VITE_WS_NOTIFICATIONS_URL`
- `VITE_CHAT_WS_BASE`
- `VITE_SITE_URL`
- `VITE_ALLOW_OTP`

Rebuild locally:

```bash
docker compose up -d --build frontend
```

When using published images, update these values in the image build pipeline before publishing a new frontend image.

Most backend `.env` changes only require restarting services:

```bash
docker compose up -d
```

For secrets and connection strings, restart all backend runtime services:

```bash
docker compose restart backend channels worker beat
```
