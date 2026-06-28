---
title: "Docker Images and Releases"
description: "SafariDesk Docker image names, tags, Docker Hub publishing, release versioning, upgrades, and rollback expectations"
---

# Docker Images and Releases

SafariDesk publishes two application Docker images for self-hosting:

```text
safaridesk/safaridesk-frontend
safaridesk/safaridesk-backend
```

The deployment also uses three upstream infrastructure images:

```text
nginx:1.27-alpine
pgvector/pgvector:pg16
redis:7-alpine
```

Related pages:

- [Installation](./installation.md)
- [Architecture](./architecture.md)
- [Configuration](./configuration.md)
- [Update Guide](./update.md)
- [Production Deployment](./production.md)

---

## Image Count

SafariDesk has two custom application images.

| Image | Built from | Used by services | Purpose |
|---|---|---|---|
| `safaridesk/safaridesk-frontend` | `frontend/Dockerfile` | `frontend` | Builds the Vite React app and serves static assets with Nginx inside the frontend container. |
| `safaridesk/safaridesk-backend` | `backend/Dockerfile` | `backend`, `channels`, `worker`, `beat` | Runs Django API, Daphne WebSockets, Celery worker, and Celery Beat with different commands. |

SafariDesk does not need separate images for `channels`, `worker`, or `beat`. Those services reuse the backend image.

---

## Compose Image References

The root `docker-compose.yml` reads these variables:

```env
DOCKERHUB_NAMESPACE=safaridesk
SAFARIDESK_IMAGE_TAG=latest
```

Rendered image names:

```text
${DOCKERHUB_NAMESPACE}/safaridesk-frontend:${SAFARIDESK_IMAGE_TAG}
${DOCKERHUB_NAMESPACE}/safaridesk-backend:${SAFARIDESK_IMAGE_TAG}
```

Example production values:

```env
DOCKERHUB_NAMESPACE=safaridesk
SAFARIDESK_IMAGE_TAG=v1.0.0
```

---

## Local Build vs Published Images

Use published images for normal self-hosting:

```bash
docker compose pull
docker compose up -d
```

Build from local source when developing or testing unreleased changes:

```bash
docker compose up -d --build
```

Both modes use the same Compose file.

---

## Publishing Model

SafariDesk application images are built and published manually by maintainers:

- `safaridesk/safaridesk-frontend`
- `safaridesk/safaridesk-backend`

This keeps the public repository simple and avoids requiring contributors or forks to configure Docker Hub credentials.

---

## Tagging Rules

Publish version tags for releases:

```text
safaridesk/safaridesk-frontend:v1.0.0
safaridesk/safaridesk-backend:v1.0.0
```

Publish `latest` only when the release should become the default:

```text
safaridesk/safaridesk-frontend:latest
safaridesk/safaridesk-backend:latest
```

Production deployments should use version tags such as:

```text
v1.0.0
v1.0.1
v1.1.0
```

Avoid `latest` for production because it can change between deployments.

---

## Release Process

Create a Git tag for the release.

Example:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The release should include:

- Frontend changes
- Backend changes
- Database migration notes
- Environment variable changes
- Docker image tags
- Upgrade steps
- Rollback notes

---

## Versioning Model

Use one SafariDesk version for the whole monorepo.

Good:

```text
SafariDesk v1.0.0
frontend image: safaridesk/safaridesk-frontend:v1.0.0
backend image:  safaridesk/safaridesk-backend:v1.0.0
```

Avoid separate frontend and backend versions for self-hosted releases.

One version is easier to support because it keeps these aligned:

- Frontend API expectations
- Backend API behavior
- WebSocket routes
- Database migrations
- Environment variable requirements
- Documentation
- Docker Compose examples

---

## Build Locally Before Publishing

Validate the Compose file:

```bash
cp .env.example .env
docker compose config --quiet
```

Build the images:

```bash
docker compose build frontend backend
```

Start the stack:

```bash
docker compose up -d
```

Run migrations and static collection:

```bash
sh deploy/scripts/migrate.sh
sh deploy/scripts/collectstatic.sh
```

Run health checks:

```bash
sh deploy/scripts/healthcheck.sh http://localhost
```

---

## Docker Hub Publishing

Build and push the release images:

```bash
docker login
docker build -t safaridesk/safaridesk-frontend:v1.0.0 -f frontend/Dockerfile frontend
docker build -t safaridesk/safaridesk-backend:v1.0.0 -f backend/Dockerfile backend
docker push safaridesk/safaridesk-frontend:v1.0.0
docker push safaridesk/safaridesk-backend:v1.0.0
```

Also publish `latest` only when the version should become the default:

```bash
docker tag safaridesk/safaridesk-frontend:v1.0.0 safaridesk/safaridesk-frontend:latest
docker tag safaridesk/safaridesk-backend:v1.0.0 safaridesk/safaridesk-backend:latest
docker push safaridesk/safaridesk-frontend:latest
docker push safaridesk/safaridesk-backend:latest
```

---

## Upgrade Image Tags

Update `.env`:

```env
SAFARIDESK_IMAGE_TAG=v1.0.1
```

Pull and restart:

```bash
docker compose pull
docker compose up -d
sh deploy/scripts/migrate.sh
sh deploy/scripts/collectstatic.sh
docker compose exec backend python manage.py sync_email_templates
```

See [Update Guide](./update.md) for the full process.

---

## Rollback Image Tags

If a release must be rolled back:

1. Stop traffic or put the site into maintenance mode if your infrastructure supports it.
2. Restore the database if the failed release ran non-reversible migrations.
3. Set `SAFARIDESK_IMAGE_TAG` back to the previous version.
4. Pull and restart.

Example:

```env
SAFARIDESK_IMAGE_TAG=v1.0.0
```

```bash
docker compose pull
docker compose up -d
```

See [Backup and Restore](./backup-restore.md) before attempting rollback across database migrations.

---

## Release Checklist

- [ ] Frontend build passes.
- [ ] Backend checks pass.
- [ ] Compose validation passes.
- [ ] Docker images build.
- [ ] Docker images push to Docker Hub.
- [ ] Release tag exists.
- [ ] Release notes include migrations.
- [ ] Release notes include env var changes.
- [ ] Installation docs still match Compose.
- [ ] Update docs are tested from the previous release.
- [ ] Rollback notes are included.
