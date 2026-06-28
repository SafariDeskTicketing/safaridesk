# Contributing to SafariDesk

Thanks for helping improve SafariDesk.

Before contributing, read the public [development guide](https://docs.safaridesk.io/local-development) and check the existing issues and pull requests.

## Local Development

Start from the repository root:

```bash
cp .env.example .env
docker compose up -d --build
sh deploy/scripts/migrate.sh
sh deploy/scripts/collectstatic.sh
sh deploy/scripts/create-admin.sh
```

Frontend code lives in `frontend/`. Backend code lives in `backend/`. Deployment assets live in `deploy/`.

## Pull Requests

- Keep changes focused.
- Include tests or validation notes when behavior changes.
- Update documentation source files when deployment, configuration, or release behavior changes.
- Do not commit `.env`, build output, local uploads, local backups, or dependency directories.

## Documentation

The public documentation site is published from the documentation source in this repository. Start with the [installation guide](https://docs.safaridesk.io/installation), [configuration reference](https://docs.safaridesk.io/configuration), and [troubleshooting guide](https://docs.safaridesk.io/troubleshooting).
