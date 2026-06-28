# SafariDesk

Open-source help desk software for teams that need ticket operations, mailbox visibility, SLA reporting, and a clean self-hosted deployment path.

<p>
  <a href="https://docs.safaridesk.io/installation">Installation</a>
  |
  <a href="https://docs.safaridesk.io/production">Production</a>
  |
  <a href="https://docs.safaridesk.io/configuration">Configuration</a>
  |
  <a href="https://docs.safaridesk.io/docker-images-and-releases">Docker Images</a>
  |
  <a href="https://docs.safaridesk.io/troubleshooting">Troubleshooting</a>
</p>

![SafariDesk dashboard overview](docs/assets/dashboard-overview-light.png)

SafariDesk combines a modern support workspace with a self-hosting-friendly deployment model. The monorepo includes the React frontend, Django backend, Docker Compose stack, Nginx routing, operational scripts, and local documentation sources used for the public docs site.

## Features

- Ticket queues with ownership, departments, categories, and SLA-aware operations.
- Real-time operational dashboards for backlog, unassigned work, SLA breaches, workload distribution, reopened tickets, CSAT, and mailbox health.
- Knowledge base, task tracking, reporting, user management, and workspace configuration.
- Mailbox and integration health monitoring for connected support channels.
- WebSocket support for live notification and chat workflows.
- Background job processing with Celery and Redis.
- PostgreSQL with pgvector support for data and AI-enabled workflows.
- Docker Compose deployment with Nginx, frontend, backend, Channels, worker, beat, Redis, and PostgreSQL services.
- Two application images for self-hosting: `safaridesk/safaridesk-frontend` and `safaridesk/safaridesk-backend`.

## Getting Started

Run SafariDesk locally from the repository root:

```bash
cp .env.example .env
docker compose pull
docker compose up -d
sh deploy/scripts/migrate.sh
sh deploy/scripts/collectstatic.sh
sh deploy/scripts/create-admin.sh
docker compose exec backend python manage.py safari
docker compose exec backend python manage.py sync_email_templates
```

Open SafariDesk at `http://localhost`.

For a production-ready setup, read the [installation guide](https://docs.safaridesk.io/installation) and [production deployment guide](https://docs.safaridesk.io/production) before exposing the service publicly.

## Screenshots

### Dashboard Overview

![SafariDesk dashboard overview in dark mode](docs/assets/dashboard-overview-dark.png)

### Operations View

![SafariDesk operations dashboard](docs/assets/dashboard-operations-light.png)

## Self-Hosting

SafariDesk is designed to run from one repository and one root Compose file.

```text
frontend/  React and Vite application
backend/   Django API, Channels, Celery, migrations, and templates
deploy/    Nginx configs and operational scripts
docs/      Source files for the public documentation site
data/      Local backup and runtime data targets
```

The default deployment keeps only `nginx` public. Backend, Channels, PostgreSQL, Redis, worker, and beat stay private on the Docker network.

Use the [configuration reference](https://docs.safaridesk.io/configuration) for environment variables, domains, secrets, email, OAuth, AI providers, licensing, and Docker image tags.

## Docker Images

The first official release is `v1.0.0`.

```text
safaridesk/safaridesk-frontend:v1.0.0
safaridesk/safaridesk-backend:v1.0.0
```

The backend image is reused by the `backend`, `channels`, `worker`, and `beat` services with different commands.

Read the [Docker images and releases guide](https://docs.safaridesk.io/docker-images-and-releases) for image tags, release versioning, upgrades, and rollback notes.

## Contributing

Contributions are welcome. Read the [contributing guide](CONTRIBUTING.md) before opening issues or pull requests.

## Security

Please read the [security policy](SECURITY.md) before reporting vulnerabilities.

## License

SafariDesk is released under the terms in the [license](LICENSE).
