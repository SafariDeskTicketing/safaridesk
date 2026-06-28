.PHONY: up down build logs migrate collectstatic bootstrap createsuperuser shell test compose-check backup restore

up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f --tail=200

migrate:
	docker compose exec backend python manage.py install_pgvector
	docker compose exec backend python manage.py migrate --noinput

collectstatic:
	docker compose exec backend python manage.py collectstatic --noinput

bootstrap:
	docker compose exec backend python manage.py safari
	docker compose exec backend python manage.py sync_email_templates

createsuperuser:
	docker compose exec backend sh -c 'python manage.py safariadmin_user --email "$$SUPERUSER_EMAIL" --username "$$SUPERUSER_USERNAME" --password "$$SUPERUSER_PASSWORD"'

shell:
	docker compose exec backend python manage.py shell

test:
	docker compose exec backend python manage.py test

compose-check:
	docker compose config

backup:
	sh deploy/scripts/backup.sh

restore:
	sh deploy/scripts/restore.sh
