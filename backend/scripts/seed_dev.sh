#!/usr/bin/env bash
# Seed a throwaway business + users + tickets for local/manual testing.
# Never run this against a real environment: the management command itself
# refuses to run unless DEBUG=True or ALLOW_DEV_SEED=1 is set.
#
# Usage:
#   ./scripts/seed_dev.sh                 # seed (or top up) the dev tenant
#   ./scripts/seed_dev.sh --reset         # wipe and recreate it
#   ./scripts/seed_dev.sh --with-slack    # also create a fake Slack integration row
#
# Inside docker-compose instead of a local venv:
#   docker-compose exec backend ./scripts/seed_dev.sh "$@"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

python manage.py seed_dev_data "$@"
