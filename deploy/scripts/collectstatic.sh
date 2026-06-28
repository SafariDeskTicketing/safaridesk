#!/bin/sh
set -eu

docker compose exec backend python manage.py collectstatic --noinput
