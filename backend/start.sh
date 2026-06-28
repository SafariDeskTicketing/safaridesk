#!/bin/bash

# Exit on any error
set -e

echo "Starting SafariDesk application..."

# Apply database migrations
echo "Applying database migrations..."
python3 manage.py collectstatic --noinput --clear
python3 manage.py migrate --noinput

# Run custom setup command
echo "Running custom setup..."
python3 manage.py safari

# Sync email templates (removes stale DB entries, e.g. request templates)
echo "Syncing email templates..."
python3 manage.py sync_email_templates

# Create log directories if they don't exist
echo "Ensuring log directories exist..."
mkdir -p /var/log/gunicorn
mkdir -p /var/log/celery

# Set proper permissions for log files
touch /var/log/gunicorn.log /var/log/gunicorn_error.log /var/log/celery.log /var/log/celery_error.log /var/log/cron.log /var/log/cron_error.log
chmod 644 /var/log/gunicorn.log /var/log/gunicorn_error.log /var/log/celery.log /var/log/celery_error.log /var/log/cron.log /var/log/cron_error.log

echo "Starting Supervisor..."

exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf