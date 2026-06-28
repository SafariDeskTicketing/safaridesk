---
title: "Troubleshooting"
description: "Troubleshoot SafariDesk self-hosted Docker Compose deployments, routing, API, WebSockets, static files, uploads, migrations, Redis, Celery, and email"
---

# SafariDesk Self-Hosted Troubleshooting

Use this page when a self-hosted SafariDesk deployment does not start, does not route traffic correctly, or behaves differently from the expected Docker Compose architecture.

Related pages:

- [Installation](./installation.md)
- [Architecture](./architecture.md)
- [Configuration](./configuration.md)
- [Production Deployment](./production.md)
- [Backup and Restore](./backup-restore.md)

---

## First Commands to Run

Run these from the monorepo root.

Check rendered Compose config:

```bash
docker compose config --quiet
```

Check service status:

```bash
docker compose ps
```

Show recent logs for every service:

```bash
docker compose logs --tail=200
```

Run HTTP health checks:

```bash
sh deploy/scripts/healthcheck.sh http://localhost
```

For production:

```bash
sh deploy/scripts/healthcheck.sh https://helpdesk.example.com
```

---

## Expected Services

The default stack should include:

```text
nginx
frontend
backend
channels
worker
beat
db
redis
```

Check:

```bash
docker compose config --services
```

If a service is missing, inspect `docker-compose.yml` and any extra Compose files passed with `-f`.

---

## Expected Public Ports

Only `nginx` should publish a host port by default.

Check:

```bash
docker compose ps
```

Expected public entrypoint:

```text
0.0.0.0:80->80/tcp
```

If PostgreSQL, Redis, backend, or Channels are publicly exposed, stop and fix the Compose configuration before production use.

---

## Containers Do Not Start

Check status:

```bash
docker compose ps -a
```

Check logs for failed services:

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 db
docker compose logs --tail=200 redis
```

Common causes:

| Symptom | Likely cause | Fix |
|---|---|---|
| `backend` exits on startup | Missing required `.env` variable | Compare `.env` with `.env.example`. |
| `db` unhealthy | Bad database password, corrupted volume, disk full | Check `docker compose logs db` and disk space. |
| `redis` unhealthy | Redis password mismatch | Check `REDIS_PASSWORD` and Celery URLs. |
| `nginx` unhealthy | Frontend/backend not reachable | Check `frontend`, `backend`, and `channels` status. |
| Image pull fails | Wrong Docker Hub namespace or tag | Check `DOCKERHUB_NAMESPACE` and `SAFARIDESK_IMAGE_TAG`. |

---

## Docker Image Pull Fails

Check configured images:

```bash
docker compose config | grep image:
```

Check `.env`:

```bash
grep DOCKERHUB_NAMESPACE .env
grep SAFARIDESK_IMAGE_TAG .env
```

Common fixes:

- Use `DOCKERHUB_NAMESPACE=safaridesk` for official images.
- Use a tag that exists on Docker Hub.
- Run `docker login` if images are private.
- Use `docker compose up -d --build` if building locally from source.

---

## Frontend Does Not Load

Check Nginx:

```bash
docker compose logs --tail=200 nginx
```

Check frontend:

```bash
docker compose logs --tail=200 frontend
```

Check HTTP response:

```bash
curl -I http://localhost/
```

Common causes:

| Symptom | Likely cause | Fix |
|---|---|---|
| Connection refused | Nginx not running or wrong `HTTP_PORT` | Run `docker compose ps`; check `.env`. |
| 502 from Nginx | Frontend container not reachable | Restart frontend and Nginx. |
| Blank page | Frontend bundle error | Check browser console and `frontend` build logs. |
| Old frontend behavior | Browser cache or old image tag | Hard refresh and confirm `SAFARIDESK_IMAGE_TAG`. |

---

## Frontend Cannot Reach API

The default same-domain frontend should call:

```text
/api/v1
```

Check frontend config in `.env`:

```env
VITE_API_URL=/api/v1
```

Check API through Nginx:

```bash
curl -fsS http://localhost/api/v1/health/
```

Check backend directly inside Compose:

```bash
docker compose exec backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/api/v1/health/', timeout=5); print('ok')"
```

Common causes:

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser calls old SaaS API URL | Frontend image built with old `VITE_API_URL` | Rebuild or publish frontend with correct build args. |
| API returns CORS error | Split-domain env values are incomplete | Set `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`. |
| API returns 400 host error | `ALLOWED_HOSTS` missing public host | Add public hostname to `ALLOWED_HOSTS`. |
| API returns 502 | Backend unhealthy | Check `docker compose logs backend`. |

---

## WebSockets Do Not Connect

WebSockets route through:

```text
/ws/
```

Nginx forwards WebSockets to:

```text
channels:8101
```

Check Channels logs:

```bash
docker compose logs --tail=200 channels
```

Check Redis logs:

```bash
docker compose logs --tail=200 redis
```

For same-domain deployment, leave these empty unless you need explicit URLs:

```env
VITE_WS_NOTIFICATIONS_URL=
VITE_CHAT_WS_BASE=
```

For split-domain deployment, use explicit WebSocket URLs:

```env
VITE_WS_NOTIFICATIONS_URL=wss://api.example.com/ws/notifications/
VITE_CHAT_WS_BASE=wss://api.example.com
```

Common causes:

| Symptom | Likely cause | Fix |
|---|---|---|
| WebSocket 502 | `channels` service down | Restart `channels`; check logs. |
| WebSocket closes immediately | Redis unavailable or auth mismatch | Check `REDIS_PASSWORD` and Channels logs. |
| Works locally, fails through TLS proxy | External proxy drops upgrade headers | Preserve `Upgrade` and `Connection` headers. |
| Browser uses `ws://` on HTTPS page | Wrong explicit Vite WebSocket URL | Use `wss://` in production. |

---

## Static Files 404

Django static files are served by root Nginx from the `staticfiles` volume:

```text
/static/
```

Collect static files:

```bash
sh deploy/scripts/collectstatic.sh
```

Restart Nginx:

```bash
docker compose restart nginx
```

Check the volume is mounted in the rendered config:

```bash
docker compose config | grep staticfiles
```

Common causes:

- `collectstatic` was not run.
- `staticfiles` volume was recreated.
- Nginx was started before files were collected.
- A custom Nginx config removed the `/static/` route.

---

## Uploads or Media 404

Uploads route through:

```text
/uploads/
```

The backend media root is:

```env
MEDIA_ROOT=/mnt/safaridesk
MEDIA_URL=/uploads/
```

Check backend volume mount:

```bash
docker compose exec backend sh -c 'ls -la /mnt/safaridesk | head'
```

Check Nginx route:

```bash
curl -I http://localhost/uploads/
```

Common causes:

| Symptom | Likely cause | Fix |
|---|---|---|
| Uploaded files vanish after restart | Uploads were stored outside the volume | Verify `uploads:/mnt/safaridesk` mount. |
| Generated links use wrong domain | `FILE_URL`, `AVATARS_URL`, or related URL values are wrong | Update `.env` URL values and restart backend services. |
| 502 on uploads | Backend is down | Check `docker compose logs backend`. |

---

## Migrations Fail

Run:

```bash
sh deploy/scripts/migrate.sh
```

If it fails, check:

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 db
```

Check database connectivity:

```bash
docker compose exec backend python manage.py dbshell
```

Common causes:

- Database service is unhealthy.
- `DB_PASSWORD` in `.env` does not match the existing database volume.
- Database volume was created with old credentials.
- Disk is full.
- A migration depends on data cleanup.
- pgvector extension installation failed.

If the database password was changed after the volume was created, changing `.env` alone does not change the existing PostgreSQL user password.

---

## Redis or Celery Problems

Check Redis:

```bash
docker compose logs --tail=200 redis
```

Check worker:

```bash
docker compose logs --tail=200 worker
```

Check beat:

```bash
docker compose logs --tail=200 beat
```

Restart background services:

```bash
docker compose restart redis worker beat
```

If `REDIS_PASSWORD` is set, Celery URLs must include the password:

```env
REDIS_PASSWORD=replace-with-redis-password
CELERY_BROKER_URL=redis://:replace-with-redis-password@redis:6379/0
CELERY_RESULT_BACKEND=redis://:replace-with-redis-password@redis:6379/0
```

---

## Email Does Not Send

Check email settings:

```bash
grep EMAIL_ .env
grep DEFAULT_FROM .env
```

Check backend and worker logs:

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 worker
```

Common causes:

- SMTP host or port is wrong.
- SMTP credentials are wrong.
- Provider requires app password.
- `EMAIL_USE_TLS` / `EMAIL_USE_SSL` mismatch.
- Outbound SMTP is blocked by the host provider.
- Worker is not running for async email jobs.

Placeholder provider links:

- [SMTP setup](../TODO-smtp.md)
- [Mailgun setup](../TODO-mailgun.md)

---

## Admin Login Fails

Create or recover the SafariAdmin user:

```bash
sh deploy/scripts/create-admin.sh
```

Check `.env`:

```bash
grep SUPERUSER_ .env
```

Direct command:

```bash
docker compose exec backend sh -c 'python manage.py safariadmin_user --email "$SUPERUSER_EMAIL" --username "$SUPERUSER_USERNAME" --password "$SUPERUSER_PASSWORD" --reset-password'
```

Then try logging in again with `SUPERUSER_EMAIL` and `SUPERUSER_PASSWORD`.

---

## Health Check Fails

The health script checks:

```text
/
/api/v1/health/
```

Run:

```bash
sh deploy/scripts/healthcheck.sh http://localhost
```

If `/` fails:

- Check `nginx`.
- Check `frontend`.
- Check `HTTP_PORT`.

If `/api/v1/health/` fails:

- Check `backend`.
- Check database connectivity.
- Check Nginx `/api/` route.

---

## Disk Space Problems

Check host disk:

```bash
df -h
```

Check Docker disk usage:

```bash
docker system df
```

Large data sources:

- PostgreSQL volume
- Uploads volume
- Backups in `data/backups`
- Docker image layers
- Container logs

Do not delete Docker volumes unless you have verified backups.

---

## Safe Restart Sequence

Restart application services:

```bash
docker compose restart backend channels worker beat frontend nginx
```

Restart all services:

```bash
docker compose restart
```

Stop and start:

```bash
docker compose down
docker compose up -d
```

Do not use `docker compose down -v` in production unless you intend to remove volumes and have a tested backup.

---

## Information to Collect for Support

Collect:

```bash
docker compose ps
docker compose config
docker compose logs --tail=300 backend
docker compose logs --tail=300 channels
docker compose logs --tail=300 worker
docker compose logs --tail=300 nginx
```

Also collect:

- SafariDesk version / `SAFARIDESK_IMAGE_TAG`
- Deployment URL
- Whether same-domain or split-domain routing is used
- Recent upgrade steps
- Whether migrations ran
- Whether backups exist

Do not share `.env` without removing secrets.
