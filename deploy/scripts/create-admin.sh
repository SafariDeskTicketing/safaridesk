#!/bin/sh
set -eu

docker compose exec backend sh -c 'python manage.py safariadmin_user --email "$SUPERUSER_EMAIL" --username "$SUPERUSER_USERNAME" --password "$SUPERUSER_PASSWORD"'
