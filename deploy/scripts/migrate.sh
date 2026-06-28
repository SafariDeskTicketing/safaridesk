#!/bin/sh
set -eu

docker compose exec backend python manage.py install_pgvector
docker compose exec backend python manage.py migrate --noinput
