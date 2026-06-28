---
title: "Backup and Restore"
description: "Back up and restore SafariDesk PostgreSQL data, uploads, and configuration for self-hosted deployments"
---

# SafariDesk Backup and Restore

SafariDesk production backups must cover:

- PostgreSQL database
- Uploaded files
- `.env`
- Release version or image tag

The repository includes backup and restore scripts in:

```text
deploy/scripts/
```

Related pages:

- [Installation](./installation.md)
- [Production Deployment](./production.md)
- [Update Guide](./update.md)
- [Troubleshooting](./troubleshooting.md)

---

## What Must Be Backed Up

| Data | Location | Required | Notes |
|---|---|---:|---|
| Database | `postgresdata` Docker volume | Yes | Contains application records, users, tickets, settings, migrations state. |
| Uploads | `uploads` Docker volume mounted at `/mnt/safaridesk` | Yes | Contains uploaded files and media. |
| Environment | `.env` | Yes | Contains secrets, domains, database password, image tag, integration keys. |
| Release version | `SAFARIDESK_IMAGE_TAG` in `.env` | Yes | Needed for repeatable restore. |
| Static files | `staticfiles` Docker volume | No | Can be regenerated with `collectstatic`. |
| Redis | `redisdata` Docker volume | Usually no | Used for queues/cache. Back up only if your operations require it. |
| Logs | `gunicorn_logs`, `celery_logs` | Optional | Useful for audits and troubleshooting. |

Do not rely on container filesystems for persistence.

---

## Backup Script

Create a backup:

```bash
sh deploy/scripts/backup.sh
```

The script writes to:

```text
data/backups/
```

Expected output files:

```text
data/backups/db-YYYYmmdd-HHMMSS.sql
data/backups/uploads-YYYYmmdd-HHMMSS.tar.gz
```

The database backup command runs inside the `db` container and uses the actual container environment:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

The uploads backup command reads `/mnt/safaridesk` through the `backend` container.

---

## Custom Backup Directory

Set `BACKUP_DIR` to write backups somewhere else:

```bash
BACKUP_DIR=/srv/safaridesk-backups sh deploy/scripts/backup.sh
```

Make sure the target directory exists or can be created by the current user.

---

## Back Up `.env`

The script does not copy `.env`.

Back it up separately using your secret-management or server-backup process.

Manual example:

```bash
cp .env data/backups/env-$(date +%Y%m%d-%H%M%S)
```

Protect this file. It can contain:

- Django secrets
- Database password
- SMTP password
- OAuth secrets
- AI provider keys
- License key
- Stripe keys
- Twilio credentials

---

## Verify a Backup

List backup files:

```bash
ls -lh data/backups
```

Check the SQL file is not empty:

```bash
head -20 data/backups/db-YYYYmmdd-HHMMSS.sql
```

Check the uploads archive:

```bash
tar -tzf data/backups/uploads-YYYYmmdd-HHMMSS.tar.gz | head
```

For production, periodically test restore on a separate non-production host.

---

## Restore Database Only

Stop background processing before restore:

```bash
docker compose stop worker beat channels backend
```

Restore the database:

```bash
sh deploy/scripts/restore.sh data/backups/db-YYYYmmdd-HHMMSS.sql
```

Start services:

```bash
docker compose up -d
```

Run health checks:

```bash
sh deploy/scripts/healthcheck.sh http://localhost
```

---

## Restore Database and Uploads

Stop services that can write data:

```bash
docker compose stop worker beat channels backend
```

Restore database and uploads:

```bash
sh deploy/scripts/restore.sh data/backups/db-YYYYmmdd-HHMMSS.sql data/backups/uploads-YYYYmmdd-HHMMSS.tar.gz
```

Start services:

```bash
docker compose up -d
```

Collect static files:

```bash
sh deploy/scripts/collectstatic.sh
```

Run health checks:

```bash
sh deploy/scripts/healthcheck.sh http://localhost
```

---

## Restore Behavior

The restore script:

1. Runs `psql` inside the `db` container.
2. Reads the SQL backup from the host.
3. Optionally clears `/mnt/safaridesk/*` inside the backend container.
4. Extracts the uploads archive into `/mnt/safaridesk`.

Important:

- Upload restore replaces current upload contents.
- Database restore imports into the current database.
- Test restore before relying on the process for production incidents.

---

## Restore to a New Host

1. Install Docker and Docker Compose.
2. Clone the SafariDesk monorepo.
3. Restore the production `.env`.
4. Confirm `SAFARIDESK_IMAGE_TAG` matches the backup.
5. Start database and Redis:

```bash
docker compose up -d db redis
```

6. Restore database and uploads:

```bash
sh deploy/scripts/restore.sh data/backups/db-YYYYmmdd-HHMMSS.sql data/backups/uploads-YYYYmmdd-HHMMSS.tar.gz
```

7. Start the full stack:

```bash
docker compose up -d
```

8. Collect static files:

```bash
sh deploy/scripts/collectstatic.sh
```

9. Verify:

```bash
sh deploy/scripts/healthcheck.sh http://localhost
```

---

## Backup Before Updates

Always back up before:

- Pulling a new release
- Running migrations
- Changing image tags
- Changing database settings
- Changing upload storage
- Running large data imports

Recommended pre-update command:

```bash
sh deploy/scripts/backup.sh
```

See [Update Guide](./update.md).

---

## Backup Scheduling

The repository does not install a scheduler by default.

Use host cron, systemd timers, or your infrastructure backup tool.

Example cron entry:

```cron
15 2 * * * cd /opt/safaridesk && /bin/sh deploy/scripts/backup.sh >> /var/log/safaridesk-backup.log 2>&1
```

Move backups off the application server after creation.

Recommended remote targets:

- Object storage
- Encrypted backup server
- Managed backup service
- Company disaster-recovery storage

Placeholder links:

- [S3 backup example](../TODO-s3-backups.md)
- [Systemd timer example](../TODO-systemd-backups.md)

---

## Retention

Choose a retention policy before production use.

Example:

- Hourly backups for 24 hours
- Daily backups for 14 days
- Weekly backups for 8 weeks
- Monthly backups for 12 months

The repository does not currently include automatic pruning. Add pruning only after confirming backups are safely copied off-server.

---

## Restore Checklist

- [ ] Correct backup files selected.
- [ ] `.env` restored.
- [ ] `SAFARIDESK_IMAGE_TAG` matches the backup.
- [ ] Current database backed up before restore.
- [ ] Write services stopped.
- [ ] Database restored.
- [ ] Uploads restored if needed.
- [ ] Services restarted.
- [ ] Static files collected.
- [ ] Health checks pass.
- [ ] Login works.
- [ ] Uploads open.
- [ ] Worker and beat are running.
