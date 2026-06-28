---
title: "Production Deployment"
description: "Prepare a production SafariDesk self-hosted deployment with Docker Compose, DNS, TLS, firewall rules, persistence, backups, and operational checks"
---

# SafariDesk Production Deployment

This page covers production deployment for the Docker Compose setup in the monorepo root.

Use [Installation](./installation.md) first for the base install. Use this page before exposing SafariDesk to real users.

Related pages:

- [Architecture](./architecture.md)
- [Configuration](./configuration.md)
- [Docker Images and Releases](./docker-images-and-releases.md)
- [Update Guide](./update.md)
- [Backup and Restore](./backup-restore.md)
- [Troubleshooting](./troubleshooting.md)

---

## Recommended Production Model

Recommended:

```text
Internet
  |
  v
Host TLS proxy or load balancer :443
  |
  v
SafariDesk nginx service :80
  |-- frontend
  |-- backend
  |-- channels
  |-- staticfiles
  |-- uploads
```

In this model:

- The host, cloud load balancer, or external reverse proxy terminates TLS.
- The SafariDesk `nginx` service receives HTTP traffic from that trusted layer.
- Internal services remain private inside Docker Compose.

The current root Compose file publishes only HTTP:

```yaml
ports:
  - "${HTTP_PORT:-80}:80"
```

The `HTTPS_PORT` value exists in `.env.example` for future TLS deployment patterns, but the current root Compose file does not publish `443` by default.

---

## Host Requirements

Minimum:

- Linux server
- Docker Engine
- Docker Compose plugin
- 4 GB RAM
- 20 GB disk
- Port `80` available

Recommended:

- Ubuntu 22.04 or newer
- 8 GB RAM
- 4 CPU cores
- 50 GB or more disk for database, uploads, logs, and backups
- Domain name
- TLS certificate
- Automated backups
- Monitoring for disk, memory, CPU, and container restarts

---

## DNS

Same-domain deployment needs one DNS record.

Example:

```text
helpdesk.example.com -> your server public IP
```

The public routes are:

```text
https://helpdesk.example.com/
https://helpdesk.example.com/api/
https://helpdesk.example.com/ws/
https://helpdesk.example.com/uploads/
https://helpdesk.example.com/static/
```

Split-domain deployment is possible, but same-domain deployment is recommended for self-hosting.

---

## Firewall Rules

Public inbound:

| Port | Purpose |
|---:|---|
| `80` | HTTP, required if SafariDesk Nginx is public or if a host TLS proxy forwards to it. |
| `443` | HTTPS, required if TLS terminates on the host or load balancer. |

Do not expose these service ports publicly:

| Port | Service |
|---:|---|
| `5432` | PostgreSQL |
| `6379` | Redis |
| `8100` | Backend Gunicorn |
| `8101` | Channels Daphne |
| `80` on `frontend` | Internal frontend container |

Check published ports:

```bash
docker compose ps
```

Only `safaridesk_nginx` should show a host port by default.

---

## Production Environment

Set production values in `.env`.

Example same-domain values:

```env
DOMAIN_NAME=helpdesk.example.com
APP_BASE_URL=https://helpdesk.example.com
FRONTEND_URL=https://helpdesk.example.com
FRONTEND_URL_BASE=https://helpdesk.example.com
API_BASE_URL=https://helpdesk.example.com
FILE_BASE_URL=https://helpdesk.example.com
MEDIA_URL=/uploads/
MEDIA_ROOT=/mnt/safaridesk
FILE_URL=https://helpdesk.example.com/uploads/files
AVATARS_URL=https://helpdesk.example.com/uploads/avatars
TASK_FILE_URL=https://helpdesk.example.com/uploads/task-files
KB_IMAGE_URL=https://helpdesk.example.com/uploads/kb/images

DEBUG=false
ALLOWED_HOSTS=helpdesk.example.com,localhost,127.0.0.1
CORS_ALLOW_ALL_ORIGINS=false
CORS_ALLOWED_ORIGINS=https://helpdesk.example.com
CSRF_TRUSTED_ORIGINS=https://helpdesk.example.com
```

Use strong secrets:

```env
SECRET_KEY=replace-with-long-random-value
SECRET_ENCRYPTION_KEY=replace-with-long-random-value
DB_PASSWORD=replace-with-strong-db-password
SUPERUSER_PASSWORD=replace-with-strong-admin-password
```

Pin a release image:

```env
SAFARIDESK_IMAGE_TAG=v1.0.0
```

---

## Start Production Services

Pull images:

```bash
docker compose pull
```

Start with the production override:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The production override sets restart policy to `always` for core services.

Run migrations:

```bash
sh deploy/scripts/migrate.sh
```

Collect static files:

```bash
sh deploy/scripts/collectstatic.sh
```

Create the admin user:

```bash
sh deploy/scripts/create-admin.sh
```

Run optional bootstrap commands:

```bash
docker compose exec backend python manage.py safari
docker compose exec backend python manage.py sync_email_templates
```

---

## TLS

The current Compose setup does not terminate TLS inside the SafariDesk Nginx container.

Use one of these production patterns:

1. Host-level reverse proxy terminates TLS and forwards to `localhost:${HTTP_PORT}`.
2. Cloud load balancer terminates TLS and forwards to the server.
3. Future Compose TLS profile mounts certificates into Nginx.

Placeholder TLS links:

- [Host Nginx TLS setup](../TODO-host-nginx-tls.md)
- [Caddy TLS setup](../TODO-caddy-tls.md)
- [Cloudflare proxy notes](../TODO-cloudflare.md)

When TLS is enabled, all public `.env` URLs should use `https://`.

---

## Volumes and Persistence

Production data lives in Docker volumes:

| Volume | Data |
|---|---|
| `postgresdata` | PostgreSQL database |
| `redisdata` | Redis persistence |
| `uploads` | Uploaded files and media |
| `staticfiles` | Collected Django static files |
| `gunicorn_logs` | Backend logs |
| `celery_logs` | Worker and beat logs |
| `backups` | Reserved backup volume |

At minimum, back up:

- PostgreSQL database
- `uploads` volume
- `.env`

Static files can be regenerated with:

```bash
sh deploy/scripts/collectstatic.sh
```

---

## Backup Before Real Usage

Create a first backup after installation:

```bash
sh deploy/scripts/backup.sh
```

Expected files:

```text
data/backups/db-YYYYmmdd-HHMMSS.sql
data/backups/uploads-YYYYmmdd-HHMMSS.tar.gz
```

Move production backups to durable storage outside the application server.

See [Backup and Restore](./backup-restore.md).

---

## Operational Checks

Check containers:

```bash
docker compose ps
```

Check rendered config:

```bash
docker compose config --quiet
```

Check public health:

```bash
sh deploy/scripts/healthcheck.sh https://helpdesk.example.com
```

Check backend health directly from inside Compose:

```bash
docker compose exec backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/api/v1/health/', timeout=5); print('ok')"
```

Check logs:

```bash
docker compose logs --tail=200 nginx
docker compose logs --tail=200 backend
docker compose logs --tail=200 channels
docker compose logs --tail=200 worker
docker compose logs --tail=200 beat
```

---

## WebSocket Verification

WebSockets are routed through:

```text
/ws/
```

The Nginx route forwards to:

```text
channels:8101
```

If WebSockets fail in production, verify that the external proxy preserves upgrade headers:

```text
Upgrade
Connection
Host
X-Forwarded-For
X-Forwarded-Proto
```

See [Troubleshooting](./troubleshooting.md).

---

## Security Checklist

- [ ] `DEBUG=false`
- [ ] `SECRET_KEY` changed
- [ ] `SECRET_ENCRYPTION_KEY` changed
- [ ] `DB_PASSWORD` changed
- [ ] `SUPERUSER_PASSWORD` changed
- [ ] `ALLOWED_HOSTS` is not `*`
- [ ] `CORS_ALLOW_ALL_ORIGINS=false`
- [ ] `CORS_ALLOWED_ORIGINS` matches the public app URL
- [ ] `CSRF_TRUSTED_ORIGINS` matches the public app URL
- [ ] PostgreSQL is not publicly exposed
- [ ] Redis is not publicly exposed
- [ ] Backend port `8100` is not publicly exposed
- [ ] Channels port `8101` is not publicly exposed
- [ ] Docker socket is not mounted into backend containers
- [ ] Image tag is pinned
- [ ] Backups are configured

---

## Production Deployment Checklist

- [ ] DNS points to the deployment host.
- [ ] TLS is configured.
- [ ] `.env` contains production URLs.
- [ ] `.env` contains production secrets.
- [ ] `docker compose config --quiet` passes.
- [ ] `docker compose pull` succeeds.
- [ ] Containers start.
- [ ] Migrations run.
- [ ] Static files collect.
- [ ] Admin user exists.
- [ ] Frontend loads.
- [ ] API health route works.
- [ ] WebSockets work.
- [ ] Uploads work.
- [ ] Celery worker starts.
- [ ] Celery Beat starts.
- [ ] Email settings are tested.
- [ ] Backup and restore have been tested.
