---
title: "Installation"
description: "Install SafariDesk self-hosted from the consolidated monorepo with Docker Compose"
---

# SafariDesk Self-Hosted Installation

This page installs SafariDesk from the monorepo root using Docker Compose.

The default install uses published Docker Hub images:

- `safaridesk/safaridesk-frontend`
- `safaridesk/safaridesk-backend`

The same Compose file can also build both application images locally from source.

Related pages:

- [Architecture](./architecture.md)
- [Configuration](./configuration.md)
- [Docker Images and Releases](./docker-images-and-releases.md)
- [Production Deployment](./production.md)
- [Backup and Restore](./backup-restore.md)
- [Troubleshooting](./troubleshooting.md)

---

## Requirements

Production host:

- Linux server
- Docker Engine
- Docker Compose plugin
- Ports `80` and `443` available
- At least 4 GB RAM
- At least 20 GB persistent disk

Recommended production host:

- Ubuntu 22.04 or newer
- 8 GB RAM
- 4 CPU cores
- A real domain name
- TLS certificate handled by a host reverse proxy, load balancer, or future TLS-enabled Nginx profile

Supported for local testing:

- macOS with Docker Desktop
- Windows with Docker Desktop
- Linux workstation with Docker Engine

---

## Repository Layout

Run all commands from the repository root:

```text
safaridesk/
  docker-compose.yml
  .env.example
  frontend/
  backend/
  deploy/
  docs/
```

Do not run the self-hosting commands from inside `frontend/` or `backend/`.

---

## Step 1: Clone the Repository

Use the final public monorepo URL when it is available.

Placeholder:

```bash
git clone TODO_REPLACE_WITH_MONOREPO_URL safaridesk
cd safaridesk
```

If the repository is already present, move into the monorepo root:

```bash
cd safaridesk
```

---

## Step 2: Create the Environment File

Copy the example file:

```bash
cp .env.example .env
```

Open `.env` and change at least these values before exposing the deployment publicly:

```env
DOMAIN_NAME=helpdesk.example.com
APP_BASE_URL=https://helpdesk.example.com
FRONTEND_URL=https://helpdesk.example.com
FRONTEND_URL_BASE=https://helpdesk.example.com
API_BASE_URL=https://helpdesk.example.com
FILE_BASE_URL=https://helpdesk.example.com

SECRET_KEY=replace-with-a-long-random-value
SECRET_ENCRYPTION_KEY=replace-with-a-long-random-value
DB_PASSWORD=replace-with-a-strong-password
SUPERUSER_USERNAME=admin
SUPERUSER_PASSWORD=replace-with-a-strong-admin-password
SUPERUSER_EMAIL=admin@example.com

ALLOWED_HOSTS=helpdesk.example.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://helpdesk.example.com
CSRF_TRUSTED_ORIGINS=https://helpdesk.example.com
```

For a local-only first run, the default `localhost` values are enough to start the stack.

See [Configuration](./configuration.md) for the full variable reference.

---

## Step 3: Select Docker Image Tags

By default, `.env.example` uses:

```env
DOCKERHUB_NAMESPACE=safaridesk
SAFARIDESK_IMAGE_TAG=latest
```

For production, use a pinned release tag after releases are published:

```env
SAFARIDESK_IMAGE_TAG=v1.0.0
```

Use `latest` only for local testing or when you intentionally want the newest published default-branch image.

---

## Step 4: Start the Stack

Pull published images:

```bash
docker compose pull
```

Start the services:

```bash
docker compose up -d
```

Check that containers are running:

```bash
docker compose ps
```

Expected services:

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

Only `nginx` should publish a host port by default.

---

## Step 5: Initialize the Database

Install the pgvector extension and run migrations:

```bash
docker compose exec backend python manage.py install_pgvector
docker compose exec backend python manage.py migrate --noinput
```

Or use the helper script:

```bash
sh deploy/scripts/migrate.sh
```

---

## Step 6: Collect Static Files

Collect Django static files into the shared `staticfiles` volume:

```bash
docker compose exec backend python manage.py collectstatic --noinput
```

Or use the helper script:

```bash
sh deploy/scripts/collectstatic.sh
```

Nginx serves collected static files at:

```text
/static/
```

---

## Step 7: Create the Admin User

The admin user is created from these `.env` values:

```env
SUPERUSER_USERNAME=admin
SUPERUSER_PASSWORD=change-me-admin-password
SUPERUSER_EMAIL=admin@example.com
```

Create or recover the admin user:

```bash
sh deploy/scripts/create-admin.sh
```

Equivalent direct command:

```bash
docker compose exec backend sh -c 'python manage.py safariadmin_user --email "$SUPERUSER_EMAIL" --username "$SUPERUSER_USERNAME" --password "$SUPERUSER_PASSWORD"'
```

---

## Step 8: Run Optional Bootstrap Commands

The backend includes additional management commands for seed data and email templates.

Run the core SafariDesk setup command:

```bash
docker compose exec backend python manage.py safari
```

Sync email templates:

```bash
docker compose exec backend python manage.py sync_email_templates
```

These commands are useful after initial setup and after upgrades that change default email templates.

---

## Step 9: Open SafariDesk

For local installation:

```text
http://localhost
```

For production:

```text
https://helpdesk.example.com
```

Log in with the admin credentials configured in `.env`.

---

## Step 10: Verify the Install

Run the HTTP health check:

```bash
sh deploy/scripts/healthcheck.sh http://localhost
```

For production, use the public URL:

```bash
sh deploy/scripts/healthcheck.sh https://helpdesk.example.com
```

Check backend logs:

```bash
docker compose logs --tail=200 backend
```

Check Nginx logs:

```bash
docker compose logs --tail=200 nginx
```

Check worker logs:

```bash
docker compose logs --tail=200 worker
```

---

## Build Locally Instead of Pulling Images

If you want to build from the checked-out source code:

```bash
docker compose up -d --build
```

This builds:

- `frontend/Dockerfile`
- `backend/Dockerfile`

The same backend image is used by:

- `backend`
- `channels`
- `worker`
- `beat`

---

## Common First-Install Checks

Confirm the rendered Compose file is valid:

```bash
docker compose config --quiet
```

Confirm only Nginx publishes a port:

```bash
docker compose ps
```

Confirm the API health endpoint works through Nginx:

```bash
curl -fsS http://localhost/api/v1/health/
```

Confirm the frontend is reachable:

```bash
curl -fsS http://localhost/
```

---

## Next Steps

After installation:

- Review [Production Deployment](./production.md) before exposing SafariDesk publicly.
- Review [Configuration](./configuration.md) and replace every placeholder secret.
- Review [Backup and Restore](./backup-restore.md) before adding production data.
- Pin a release tag using [Docker Images and Releases](./docker-images-and-releases.md).
