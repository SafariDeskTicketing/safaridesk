# SafariDesk

SafariDesk is consolidated here as a self-hosting-friendly monorepo.

```text
frontend/  React + Vite application
backend/   Django API, Channels, Celery, migrations, templates
deploy/    Nginx and operational scripts
docs/      Self-hosting and development documentation
```

## Quickstart

Using published Docker Hub images:

```bash
cp .env.example .env
docker compose pull
docker compose up -d
docker compose exec backend python manage.py install_pgvector
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py collectstatic --noinput
docker compose exec backend python manage.py safari
```

To build locally from source instead, use `docker compose up -d --build`.

Open `http://localhost`.

Only Nginx is public by default. Backend, Channels, PostgreSQL, Redis, Celery, and Celery Beat stay on the private Compose network.

SafariDesk publishes two custom Docker images:

- `safaridesk/safaridesk-frontend`
- `safaridesk/safaridesk-backend`

The `backend`, `channels`, `worker`, and `beat` services all use the backend image with different commands.

Docker Hub publishing is handled by `.github/workflows/docker-build.yml`. Configure these GitHub settings before pushing release tags:

- Secret: `DOCKERHUB_USERNAME`
- Secret: `DOCKERHUB_TOKEN`
- Variable: `DOCKERHUB_NAMESPACE`, defaults to `safaridesk`

## Documentation

- Self-hosting install: `docs/self-hosting/installation.md`
- Architecture: `docs/self-hosting/architecture.md`
- Configuration: `docs/self-hosting/configuration.md`
- Docker images and releases: `docs/self-hosting/docker-images-and-releases.md`
- Production deployment: `docs/self-hosting/production.md`
- Update guide: `docs/self-hosting/update.md`
- Backup and restore: `docs/self-hosting/backup-restore.md`
- Troubleshooting: `docs/self-hosting/troubleshooting.md`
- Development setup: `docs/development/local-development.md`
