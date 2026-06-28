# Uninstall

Stop containers while keeping data:

```bash
docker compose down
```

Remove containers and named volumes:

```bash
docker compose down -v
```

Removing volumes deletes PostgreSQL data, Redis data, uploads, static files, and backups stored in Docker volumes.
