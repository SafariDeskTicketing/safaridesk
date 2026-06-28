---
title: "Architecture"
description: "Self-hosted SafariDesk architecture, Docker services, routing, storage, and runtime dependencies"
---

# SafariDesk Self-Hosted Architecture

SafariDesk self-hosting runs from the monorepo root using Docker Compose.

The default deployment uses one public Nginx entrypoint and keeps the application, database, Redis, WebSocket, and background worker services private inside the Docker network.

Related pages:

- [Installation](./installation.md)
- [Configuration](./configuration.md)
- [Docker Images and Releases](./docker-images-and-releases.md)
- [Production Deployment](./production.md)
- [Update Guide](./update.md)
- [Backup and Restore](./backup-restore.md)
- [Troubleshooting](./troubleshooting.md)

---

## Deployment Model

The consolidated repository contains both application codebases:

- `frontend/` contains the Vite React frontend.
- `backend/` contains the Django backend, API, Channels server, Celery app, and migrations.
- `deploy/nginx/` contains reverse proxy routing.
- `deploy/scripts/` contains maintenance scripts.
- `docs/self-hosting/` contains deployment documentation.

The self-hosted deployment is started from the repository root:

```bash
docker compose up -d
```

The root `docker-compose.yml` defines all required services.

---

## Docker Services

SafariDesk uses eight Compose services by default.

| Service | Image | Purpose | Public |
|---|---|---|---|
| `nginx` | `nginx:1.27-alpine` | Public reverse proxy for frontend, API, WebSockets, uploads, and static files | Yes |
| `frontend` | `safaridesk/safaridesk-frontend` | Serves the built React/Vite frontend through internal Nginx | No |
| `backend` | `safaridesk/safaridesk-backend` | Runs Django API with Gunicorn on port `8100` | No |
| `channels` | `safaridesk/safaridesk-backend` | Runs Django Channels/Daphne WebSocket server on port `8101` | No |
| `worker` | `safaridesk/safaridesk-backend` | Runs Celery background jobs | No |
| `beat` | `safaridesk/safaridesk-backend` | Runs Celery scheduled jobs | No |
| `db` | `pgvector/pgvector:pg16` | PostgreSQL database with pgvector support | No |
| `redis` | `redis:7-alpine` | Redis for Celery, cache, and Channels | No |

Only `nginx` publishes a host port by default.

Application images:

- Frontend image: `safaridesk/safaridesk-frontend`
- Backend image: `safaridesk/safaridesk-backend`

Infrastructure images:

- Nginx: `nginx:1.27-alpine`
- PostgreSQL with pgvector: `pgvector/pgvector:pg16`
- Redis: `redis:7-alpine`

---

## Architecture Diagram

```text
Browser
  |
  v
Nginx :80
  |-- /              -> frontend:80
  |-- /api/          -> backend:8100
  |-- /ws/           -> channels:8101
  |-- /uploads/      -> backend:8100
  |-- /static/       -> staticfiles volume
  |-- /swagger/      -> backend:8100
  |-- /redoc/        -> backend:8100
  |
  v
Internal Docker network
  |
  |-- backend  -> db + redis + uploads + staticfiles
  |-- channels -> db + redis + uploads
  |-- worker   -> db + redis + uploads
  |-- beat     -> db + redis + uploads
  |-- db       -> postgresdata volume
  |-- redis    -> redisdata volume
```

---

## Public and Private Network Boundaries

Public by default:

- `nginx` on `${HTTP_PORT:-80}`

Private inside Docker Compose:

- `frontend:80`
- `backend:8100`
- `channels:8101`
- `db:5432`
- `redis:6379`
- `worker`
- `beat`

Do not expose PostgreSQL, Redis, the backend API port, or the Channels port directly to the internet.

---

## Routing

The default self-hosted deployment uses same-domain routing.

| Public path | Target service | Notes |
|---|---|---|
| `/` | `frontend:80` | React application |
| `/api/` | `backend:8100` | Django API |
| `/ws/` | `channels:8101` | WebSocket connections |
| `/uploads/` | `backend:8100` | Uploaded media served through backend media routing |
| `/static/` | `staticfiles` volume mounted into `nginx` | Collected Django static files |
| `/swagger/` | `backend:8100` | API documentation, if enabled |
| `/redoc/` | `backend:8100` | API documentation, if enabled |

Same-domain routing is the recommended default because it avoids most CORS, CSRF, WebSocket origin, and upload URL problems.

---

## Storage

SafariDesk uses Docker volumes for persistent and shared data.

| Volume | Mounted by | Purpose |
|---|---|---|
| `postgresdata` | `db` | PostgreSQL data |
| `redisdata` | `redis` | Redis data |
| `uploads` | `backend`, `channels`, `worker`, `beat` | Uploaded files and media |
| `staticfiles` | `backend`, `channels`, `nginx` | Django collected static files |
| `gunicorn_logs` | `backend` | Gunicorn logs |
| `celery_logs` | `worker`, `beat` | Celery logs |
| `backups` | scripts / future backup workflows | Backup storage |

The backend media root is configured through:

```env
MEDIA_ROOT=/mnt/safaridesk
MEDIA_URL=/uploads/
```

Uploads must persist across container restarts, image updates, and application upgrades.

---

## Database

The `db` service uses:

```text
pgvector/pgvector:pg16
```

The backend connects to PostgreSQL using:

```env
DB_HOST=db
DB_PORT=5432
DB_NAME=safaridesk
DB_USER=safaridesk
DB_PASSWORD=change-me-db-password
```

The database service is internal only. Backups should be created with the scripts in `deploy/scripts/`.

---

## Redis, Celery, and WebSockets

Redis is used by:

- Celery worker queueing
- Celery result backend
- Django Channels
- Backend cache features where configured

The default Redis service is:

```text
redis:7-alpine
```

Runtime services:

- `channels` runs Daphne for WebSockets.
- `worker` runs Celery workers.
- `beat` runs Celery Beat scheduled tasks.

These services use the same backend image as the Django API but run different commands.

---

## Environment Files

Self-hosting uses one root `.env` file.

Start from:

```bash
cp .env.example .env
```

Important environment groups:

- App identity
- Docker image namespace and tag
- Domains and URLs
- Security
- Database
- Redis and Celery
- Email and SMTP
- Admin bootstrap
- OAuth and mail integrations
- Integrations
- AI providers
- Billing and licensing
- Optional ports

See [Configuration](./configuration.md) for the full variable reference.

---

## Docker Image Strategy

SafariDesk publishes two application images:

```text
safaridesk/safaridesk-frontend
safaridesk/safaridesk-backend
```

The backend image is reused by four services:

- `backend`
- `channels`
- `worker`
- `beat`

The image namespace and tag are controlled by:

```env
DOCKERHUB_NAMESPACE=safaridesk
SAFARIDESK_IMAGE_TAG=latest
```

For production, pin `SAFARIDESK_IMAGE_TAG` to a released version instead of using `latest`.

See [Docker Images and Releases](./docker-images-and-releases.md) for release and tag details.

---

## Health Checks

Compose health checks are configured for:

- `nginx`
- `frontend`
- `backend`
- `db`
- `redis`

The backend health check calls:

```text
/api/v1/health/
```

Nginx waits for the backend health check before treating the backend dependency as ready.

---

## Licensing

The environment file includes licensing settings:

```env
SAFARIDESK_LICENSE_KEY=
SAFARIDESK_LICENSE_SERVER_URL=
SAFARIDESK_LICENSE_VIOLATION_DAYS=5
```

Licensing behavior depends on the edition, deployment type, and configured license server.

Document final license server URLs and entitlement behavior here before publishing the official production docs.

Placeholder license links:

- [License setup](../TODO-license-setup.md)
- [Enterprise terms](../TODO-enterprise-terms.md)

---

## Production Notes

For production deployments:

- Use a Linux host.
- Keep only ports `80` and `443` public.
- Put TLS in front of Nginx or extend the Nginx deployment to terminate TLS.
- Pin Docker image tags.
- Use strong secrets in `.env`.
- Back up `postgresdata` and `uploads`.
- Run migrations after upgrades.

See [Production Deployment](./production.md) and [Backup and Restore](./backup-restore.md).
