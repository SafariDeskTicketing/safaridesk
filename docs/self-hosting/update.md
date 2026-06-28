---
title: "Update Guide"
description: "Update a self-hosted SafariDesk deployment, run migrations, refresh static files, and roll back safely"
---

# SafariDesk Update Guide

Use this page to update a self-hosted SafariDesk deployment.

The safest update flow is:

1. Read release notes.
2. Back up the database and uploads.
3. Pull the new code or images.
4. Restart services.
5. Run migrations.
6. Collect static files.
7. Run post-update commands.
8. Verify the deployment.

Related pages:

- [Docker Images and Releases](./docker-images-and-releases.md)
- [Backup and Restore](./backup-restore.md)
- [Configuration](./configuration.md)
- [Troubleshooting](./troubleshooting.md)

---

## Before Updating

Check the current image tag:

```bash
grep SAFARIDESK_IMAGE_TAG .env
```

Check running containers:

```bash
docker compose ps
```

Create a backup:

```bash
sh deploy/scripts/backup.sh
```

Confirm backup files exist:

```bash
ls -lh data/backups
```

Read the release notes for:

- Database migrations
- New environment variables
- Removed environment variables
- Frontend build changes
- License changes
- Manual post-update commands
- Rollback warnings

Placeholder release notes link:

- [Release notes](../TODO-release-notes.md)

---

## Update Using Published Images

Edit `.env` and set the target image tag:

```env
SAFARIDESK_IMAGE_TAG=v1.0.1
```

Pull images:

```bash
docker compose pull
```

Start the new containers:

```bash
docker compose up -d
```

Run migrations:

```bash
sh deploy/scripts/migrate.sh
```

Collect static files:

```bash
sh deploy/scripts/collectstatic.sh
```

Sync email templates:

```bash
docker compose exec backend python manage.py sync_email_templates
```

Run health checks:

```bash
sh deploy/scripts/healthcheck.sh http://localhost
```

For production:

```bash
sh deploy/scripts/healthcheck.sh https://helpdesk.example.com
```

---

## Update From Source

Use this flow when building local images from the monorepo source.

Pull code:

```bash
git pull
```

Review changes to `.env.example`:

```bash
git diff HEAD@{1} -- .env.example
```

Build and restart:

```bash
docker compose up -d --build
```

Run migrations:

```bash
sh deploy/scripts/migrate.sh
```

Collect static files:

```bash
sh deploy/scripts/collectstatic.sh
```

Sync email templates:

```bash
docker compose exec backend python manage.py sync_email_templates
```

---

## Updating With the Production Override

If production uses `docker-compose.prod.yml`, include it consistently:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The helper scripts currently call plain `docker compose`. If your operational standard always uses extra Compose files, either run the direct commands manually or export `COMPOSE_FILE` before using scripts.

Example:

```bash
export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
sh deploy/scripts/migrate.sh
sh deploy/scripts/collectstatic.sh
```

---

## Environment Variable Changes

When a release changes `.env.example`, update `.env` manually.

Compare:

```bash
diff -u .env.example .env
```

If `diff` is not available, inspect both files directly.

Do not overwrite `.env` with `.env.example`; that can erase production secrets.

Changes to backend variables usually require a restart:

```bash
docker compose restart backend channels worker beat
```

Changes to `VITE_*` variables require a rebuilt frontend image because Vite bakes them into the frontend bundle.

Local rebuild:

```bash
docker compose up -d --build frontend
```

Published-image deployments need a newly published frontend image with the updated build args.

---

## Database Migrations

Run migrations after the new backend image is running:

```bash
docker compose exec backend python manage.py install_pgvector
docker compose exec backend python manage.py migrate --noinput
```

The helper script runs both:

```bash
sh deploy/scripts/migrate.sh
```

If migrations fail:

1. Stop and inspect the error.
2. Do not repeatedly rerun destructive commands.
3. Check database connectivity.
4. Check the release notes for manual migration steps.
5. Restore from backup if the database is left in a bad state.

---

## Static Files

After an update, collect static files:

```bash
docker compose exec backend python manage.py collectstatic --noinput
```

Or:

```bash
sh deploy/scripts/collectstatic.sh
```

Nginx serves collected files from the `staticfiles` volume at:

```text
/static/
```

If admin or API documentation assets 404 after update, run `collectstatic` again and restart Nginx:

```bash
sh deploy/scripts/collectstatic.sh
docker compose restart nginx
```

---

## Post-Update Verification

Check containers:

```bash
docker compose ps
```

Check health:

```bash
sh deploy/scripts/healthcheck.sh http://localhost
```

Check logs:

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 channels
docker compose logs --tail=200 worker
docker compose logs --tail=200 beat
docker compose logs --tail=200 nginx
```

Verify in the browser:

- Login works.
- Frontend loads without asset errors.
- API calls succeed.
- WebSockets connect.
- Uploads display.
- Email sending still works if configured.
- Background jobs are processed.

---

## Rollback

Rollback depends on whether the failed update ran database migrations.

If migrations did not run:

1. Set `SAFARIDESK_IMAGE_TAG` back to the previous tag.
2. Pull images.
3. Restart services.

```env
SAFARIDESK_IMAGE_TAG=v1.0.0
```

```bash
docker compose pull
docker compose up -d
```

If migrations did run:

1. Review whether the migrations are backward-compatible.
2. If they are not backward-compatible, restore the database backup from before the update.
3. Restore uploads if the update changed uploaded file layout.
4. Set `SAFARIDESK_IMAGE_TAG` to the previous version.
5. Pull and restart.

Restore example:

```bash
sh deploy/scripts/restore.sh data/backups/db-YYYYmmdd-HHMMSS.sql data/backups/uploads-YYYYmmdd-HHMMSS.tar.gz
```

See [Backup and Restore](./backup-restore.md).

---

## Update Checklist

- [ ] Release notes reviewed.
- [ ] `.env.example` compared with `.env`.
- [ ] Database and uploads backed up.
- [ ] Target image tag selected.
- [ ] Images pulled or rebuilt.
- [ ] Services restarted.
- [ ] pgvector install command run.
- [ ] Migrations run.
- [ ] Static files collected.
- [ ] Email templates synced.
- [ ] Health checks pass.
- [ ] Frontend reaches API.
- [ ] WebSockets work.
- [ ] Uploads work.
- [ ] Worker and beat are running.
- [ ] Rollback path is known.
