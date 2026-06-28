#!/bin/sh
set -eu

BASE_URL="${1:-http://localhost}"

curl -fsS "$BASE_URL/" >/dev/null
curl -fsS "$BASE_URL/api/v1/health/" >/dev/null

echo "SafariDesk HTTP health checks passed for $BASE_URL"
